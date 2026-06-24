import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/imff
 *
 * 어드민 전용: IMFF 앱 연동 회원 목록 + 통계 반환
 * IMFF는 Firebase 기반이므로 등급 조회 없이 im-core-auth DB 데이터만 반환합니다.
 */
export async function GET() {
  const supabase = createAdminClient();

  // ── IMFF 연동 회원 목록 ──────────────────────────────────────
  const { data: users, error: usersError } = await supabase
    .from("app_user_mapping")
    .select(`
      local_user_id,
      nickname,
      created_at,
      role,
      master_users (
        id,
        phone_number,
        name,
        integrated_points,
        created_at
      )
    `)
    .eq("app_name", "IMFF")
    .order("created_at", { ascending: false })
    .limit(100);

  if (usersError) {
    return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
  }

  // ── IMFF 통계 ────────────────────────────────────────────────
  const { count: totalImff } = await supabase
    .from("app_user_mapping")
    .select("*", { count: "exact", head: true })
    .eq("app_name", "IMFF");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayImff } = await supabase
    .from("app_user_mapping")
    .select("*", { count: "exact", head: true })
    .eq("app_name", "IMFF")
    .gte("created_at", todayStart.toISOString());

  const { data: pointStats } = await supabase
    .from("point_transactions")
    .select("amount, type")
    .eq("source_app", "IMFF");

  const totalEarned = pointStats
    ?.filter((t) => t.type === "earn")
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  const totalSpent = pointStats
    ?.filter((t) => t.type === "spend")
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  return NextResponse.json({
    success: true,
    stats: {
      totalImff: totalImff ?? 0,
      todayImff: todayImff ?? 0,
      totalEarned,
      totalSpent,
    },
    users: users ?? [],
  });
}
