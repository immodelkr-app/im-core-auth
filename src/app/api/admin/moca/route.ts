import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/moca
 *
 * 어드민 전용: MOCA 앱 연동 회원 목록 + 통계 반환
 * MOCA 앱에서 로그인/등급변경 시 sync 및 grade-update를 통해 마스터 계정 DB에 등급이 동기화됩니다.
 */
export async function GET() {
  const supabase = createAdminClient();

  // ── MOCA 연동 회원 목록 (im-core-auth DB) ─────────────────────
  const { data: users, error: usersError } = await supabase
    .from("app_user_mapping")
    .select(`
      local_user_id,
      nickname,
      created_at,
      master_users (
        id,
        phone_number,
        name,
        grade,
        integrated_points,
        created_at
      )
    `)
    .eq("app_name", "MOCA")
    .order("created_at", { ascending: false })
    .limit(100);

  if (usersError) {
    return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
  }

  // ── grade 및 nickname 병합 ───────────────────────────────────────
  const usersWithGrade = (users ?? []).map((u) => {
    const masterObj = Array.isArray(u.master_users)
      ? u.master_users[0]
      : (u.master_users as { name?: string; phone_number?: string; grade?: string } | null);

    const masterName = masterObj?.name ?? null;
    const fallbackNickname = u.nickname || masterName || null;

    return {
      ...u,
      nickname: fallbackNickname,
      grade: masterObj?.grade ?? "NORMAL",
      master_users: masterObj ?? u.master_users,
    };
  });

  // ── MOCA 통계 ────────────────────────────────────────────────
  const { count: totalMoca } = await supabase
    .from("app_user_mapping")
    .select("*", { count: "exact", head: true })
    .eq("app_name", "MOCA");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayMoca } = await supabase
    .from("app_user_mapping")
    .select("*", { count: "exact", head: true })
    .eq("app_name", "MOCA")
    .gte("created_at", todayStart.toISOString());

  const { data: pointStats } = await supabase
    .from("point_transactions")
    .select("amount, type")
    .eq("source_app", "MOCA");

  const totalEarned = pointStats
    ?.filter((t) => t.type === "earn")
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  const totalSpent = pointStats
    ?.filter((t) => t.type === "use")
    .reduce((sum, t) => sum + t.amount, 0) ?? 0;

  return NextResponse.json({
    success: true,
    stats: {
      totalMoca: totalMoca ?? 0,
      todayMoca: todayMoca ?? 0,
      totalEarned,
      totalSpent,
    },
    users: usersWithGrade,
  });
}
