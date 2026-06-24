import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction, getClientIp } from "@/lib/audit";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";

// GET: 쿠폰 목록 + 통계
export async function GET() {
  const supabase = createAdminClient();

  const [{ data: coupons, error }, { data: issued }] = await Promise.all([
    supabase.from("coupon_master")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("user_coupons")
      .select("coupon_code, is_used"),
  ]);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // 쿠폰별 발급/사용 통계 집계
  const statsMap: Record<string, { issued: number; used: number }> = {};
  (issued ?? []).forEach((uc) => {
    if (!statsMap[uc.coupon_code]) statsMap[uc.coupon_code] = { issued: 0, used: 0 };
    statsMap[uc.coupon_code].issued++;
    if (uc.is_used) statsMap[uc.coupon_code].used++;
  });

  const totalIssued = (issued ?? []).length;
  const totalUsed   = (issued ?? []).filter(u => u.is_used).length;

  return NextResponse.json({
    success: true,
    stats: {
      totalCoupons: (coupons ?? []).length,
      activeCoupons: (coupons ?? []).filter(c => c.is_active).length,
      totalIssued,
      totalUsed,
    },
    coupons: (coupons ?? []).map(c => ({
      ...c,
      issuedCount: statsMap[c.coupon_code]?.issued ?? 0,
      usedCount:   statsMap[c.coupon_code]?.used   ?? 0,
    })),
  });
}

// POST: 쿠폰 생성
export async function POST(request: Request) {
  // ── RBAC: manager 이상만 쿠폰 생성 가능 ──
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);
  if (!hasRole(role, "manager")) {
    return forbiddenResponse("쿠폰 생성은 매니저 이상만 가능합니다.");
  }

  const supabase = createAdminClient();
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const { coupon_code, coupon_name, discount_type, discount_value, validity_days } = body as Record<string, unknown>;

  if (!coupon_code || !coupon_name || !discount_type || !discount_value || !validity_days) {
    return NextResponse.json({ success: false, error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("coupon_master").insert({
    coupon_code, coupon_name, discount_type, discount_value: Number(discount_value),
    validity_days: Number(validity_days), is_active: true,
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // ── 감사 로그 기록 ──
  await logAdminAction({
    adminEmail: user?.email ?? "unknown",
    adminId: user?.id ?? "unknown",
    action: "COUPON_CREATE",
    targetType: "COUPON",
    targetId: String(coupon_code),
    detail: { coupon_name, discount_type, discount_value: Number(discount_value), validity_days: Number(validity_days) },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

// PATCH: 쿠폰 활성/비활성 토글
export async function PATCH(request: Request) {
  // ── RBAC: manager 이상만 쿠폰 상태 변경 가능 ──
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);
  if (!hasRole(role, "manager")) {
    return forbiddenResponse("쿠폰 상태 변경은 매니저 이상만 가능합니다.");
  }

  const supabase = createAdminClient();
  const { coupon_code, is_active } = await request.json() as { coupon_code: string; is_active: boolean };
  const { error } = await supabase.from("coupon_master")
    .update({ is_active })
    .eq("coupon_code", coupon_code);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // ── 감사 로그 기록 ──
  await logAdminAction({
    adminEmail: user?.email ?? "unknown",
    adminId: user?.id ?? "unknown",
    action: "COUPON_TOGGLE",
    targetType: "COUPON",
    targetId: coupon_code,
    detail: { is_active },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}
