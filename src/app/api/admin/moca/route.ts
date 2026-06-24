import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMocaClient } from "@/lib/supabase/moca";

/**
 * GET /api/admin/moca
 *
 * 어드민 전용: MOCA 앱 연동 회원 목록 + 통계 반환
 * 등급(grade)은 MOCA 앱 Supabase DB에서 실시간 조회합니다.
 * (등급 권한은 MOCA 앱에 있으므로 im-core-auth에 복사하지 않음)
 */
export async function GET() {
  const supabase     = createAdminClient();
  const mocaSupabase = createMocaClient();

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

  // ── MOCA DB에서 등급 실시간 조회 ─────────────────────────────
  // local_user_id = MOCA users 테이블의 id (UUID)
  const localIds = (users ?? []).map((u) => u.local_user_id);
  let gradeMap: Record<string, string | null> = {};

  if (localIds.length > 0) {
    const { data: mocaUsers } = await mocaSupabase
      .from("users")
      .select("id, grade")
      .in("id", localIds);

    if (mocaUsers) {
      gradeMap = Object.fromEntries(mocaUsers.map((u) => [u.id, u.grade ?? null]));
    }
  }

  // ── grade 필드 병합 ───────────────────────────────────────────
  const usersWithGrade = (users ?? []).map((u) => ({
    ...u,
    grade: gradeMap[u.local_user_id] ?? null,
  }));

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
    ?.filter((t) => t.type === "spend")
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
