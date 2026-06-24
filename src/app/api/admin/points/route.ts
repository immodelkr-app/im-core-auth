import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rewardUserPoint, deductUserPoint, PointError } from "@/lib/points";
import { logAdminAction, getClientIp } from "@/lib/audit";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";
import type { AppName } from "@/types/database";

export async function GET() {
  const supabase = createAdminClient();

  // 전체 포인트 통계
  const { data: earnData } = await supabase
    .from("point_transactions")
    .select("amount, source_app")
    .eq("type", "earn");

  const { data: useData } = await supabase
    .from("point_transactions")
    .select("amount, source_app")
    .eq("type", "use");

  const totalEarned = (earnData ?? []).reduce((s, t) => s + t.amount, 0);
  const totalUsed   = (useData  ?? []).reduce((s, t) => s + t.amount, 0);
  const mocaEarned  = (earnData ?? []).filter(t => t.source_app === "MOCA").reduce((s, t) => s + t.amount, 0);
  const imffEarned  = (earnData ?? []).filter(t => t.source_app === "IMFF").reduce((s, t) => s + t.amount, 0);

  // 거래 내역 전체 (최신 200건, 유저 이름/전화번호 포함)
  const { data: transactions, error } = await supabase
    .from("point_transactions")
    .select(`
      id, source_app, type, amount, description, created_at,
      master_users ( phone_number, name )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    stats: { totalEarned, totalUsed, mocaEarned, imffEarned, netPoints: totalEarned - totalUsed },
    transactions: transactions ?? [],
  });
}

export async function POST(request: Request) {
  // ── RBAC: manager 이상만 포인트 조작 가능 ──
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);
  if (!hasRole(role, "manager")) {
    return forbiddenResponse("포인트 지급/차감은 매니저 이상만 가능합니다.");
  }

  try {
    const body = await request.json();
    const { masterUserId, type, amount, description, appSource } = body;

    if (!masterUserId || !type || !amount || !appSource) {
      return NextResponse.json(
        { success: false, error: "필수 파라미터가 누락되었습니다. (masterUserId, type, amount, appSource)" },
        { status: 400 }
      );
    }

    if (type !== "earn" && type !== "use") {
      return NextResponse.json(
        { success: false, error: "type은 'earn' 또는 'use' 여야 합니다." },
        { status: 400 }
      );
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "금액은 1 이상의 정수여야 합니다." },
        { status: 400 }
      );
    }

    const appName = appSource as AppName;
    if (appName !== "MOCA" && appName !== "IMFF") {
      return NextResponse.json(
        { success: false, error: "appSource는 'MOCA' 또는 'IMFF' 여야 합니다." },
        { status: 400 }
      );
    }

    const params = {
      masterUserId,
      appSource: appName,
      amount: parsedAmount,
      description: description || undefined,
    };

    let result;
    if (type === "earn") {
      result = await rewardUserPoint(params);
    } else {
      result = await deductUserPoint(params);
    }

    // ── 감사 로그 기록 ──
    await logAdminAction({
      adminEmail: user?.email ?? "unknown",
      adminId: user?.id ?? "unknown",
      action: type === "earn" ? "POINT_GRANT" : "POINT_DEDUCT",
      targetType: "USER",
      targetId: masterUserId,
      detail: {
        amount: parsedAmount,
        appSource: appName,
        description: description || null,
        newBalance: result.newBalance,
      },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("포인트 수동 처리 에러:", error);
    if (error instanceof PointError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "서버 내부 에러가 발생했습니다." },
      { status: 500 }
    );
  }
}
