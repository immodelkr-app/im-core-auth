import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import StatCard from "@/components/admin/StatCard";

export const metadata: Metadata = { title: "대시보드" };
// 30초마다 서버에서 재검증 (실시간에 가까운 데이터)
export const revalidate = 30;

// ── 실데이터 조회 함수들 ──────────────────────────────────────
async function getDashboardStats() {
  const supabase = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: totalMembers },
    { count: newTodayMembers },
    { data: todayPointsData },
    { data: appMappingData },
    { data: recentTransactions },
    { data: memberList },
  ] = await Promise.all([
    // 총 통합 회원 수
    supabase.from("master_users").select("*", { count: "exact", head: true }),
    // 오늘 신규 가입자
    supabase.from("master_users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    // 오늘 지급된 포인트 합계
    supabase.from("point_transactions")
      .select("amount")
      .eq("type", "earn")
      .gte("created_at", todayStart.toISOString()),
    // 앱별 매핑 현황
    supabase.from("app_user_mapping").select("app_name"),
    // 최근 거래 내역 5건
    supabase.from("point_transactions")
      .select("id, master_user_id, source_app, type, amount, description, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    // 통합 회원 목록 (최신 50명) + 연동 앱 정보
    supabase.from("master_users")
      .select(`
        id, phone_number, name, integrated_points, created_at,
        app_user_mapping ( app_name, local_user_id )
      `)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const todayPoints = (todayPointsData ?? []).reduce((sum, tx) => sum + tx.amount, 0);

  const mocaCount = (appMappingData ?? []).filter((m) => m.app_name === "MOCA").length;
  const imffCount = (appMappingData ?? []).filter((m) => m.app_name === "IMFF").length;
  const total = mocaCount + imffCount || 1;

  return {
    totalMembers:     totalMembers ?? 0,
    newTodayMembers:  newTodayMembers ?? 0,
    todayPoints,
    mocaCount,
    imffCount,
    totalMapped: mocaCount + imffCount,
    mocaPercent: Math.round((mocaCount / total) * 100),
    imffPercent: Math.round((imffCount / total) * 100),
    recentTransactions: recentTransactions ?? [],
    memberList: memberList ?? [],
  };
}

// 시간 포맷
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const SUMMARY_STATS = [
    {
      title: "현재 총 통합 회원 수",
      value: `${stats.totalMembers.toLocaleString()}명`,
      subtitle: `오늘 +${stats.newTodayMembers}명`,
      trend: "up" as const,
      color: "purple" as const,
      animationDelay: "delay-100",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      title: "오늘 누적 지급 포인트",
      value: `${stats.todayPoints.toLocaleString()}P`,
      subtitle: stats.todayPoints > 0 ? "실시간 집계" : "오늘 지급 없음",
      trend: stats.todayPoints > 0 ? ("up" as const) : ("neutral" as const),
      color: "violet" as const,
      animationDelay: "delay-200",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "오늘 신규 가입 회원",
      value: `${stats.newTodayMembers}명`,
      subtitle: "자정 기준",
      trend: "neutral" as const,
      color: "indigo" as const,
      animationDelay: "delay-300",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      ),
    },
    {
      title: "앱 연동 총 건수",
      value: `${stats.totalMapped.toLocaleString()}건`,
      subtitle: `MOCA ${stats.mocaCount} · IMFF ${stats.imffCount}`,
      trend: "neutral" as const,
      color: "pink" as const,
      animationDelay: "delay-400",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-screen-xl mx-auto space-y-8">
      {/* 페이지 헤더 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold tracking-widest uppercase text-violet-500">Overview</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 leading-tight">
          통합 어드민 <span className="gradient-text">대시보드</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">아임모델 통합 인증 시스템 — MOCA, IMFF, 모델뷰티 실시간 현황</p>
      </div>

      {/* 요약 카드 */}
      <section aria-label="요약 통계">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {SUMMARY_STATS.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </section>

      {/* 하단 2단 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 앱별 연동 현황 */}
        <section aria-label="앱별 연동 현황"
          className="lg:col-span-2 glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 animate-fade-in-up delay-300">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">앱별 연동 현황</h2>
              <p className="text-xs text-gray-500 mt-0.5">실제 매핑 데이터 기준</p>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-violet-100 text-violet-700">
              총 {stats.totalMapped}건
            </span>
          </div>
          <div className="space-y-4">
            {[
              { name: "MOCA",  count: stats.mocaCount, percent: stats.mocaPercent, color: "bg-purple-500" },
              { name: "IMFF",  count: stats.imffCount, percent: stats.imffPercent, color: "bg-violet-500" },
            ].map((app) => (
              <div key={app.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${app.color}`} />
                    <span className="text-sm font-medium text-gray-700">{app.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{app.count.toLocaleString()}건</span>
                    <span className="text-xs text-gray-400">{app.percent}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${app.color} transition-all duration-1000 ease-out`}
                    style={{ width: `${app.percent}%` }}
                    role="progressbar" aria-valuenow={app.percent} aria-valuemin={0} aria-valuemax={100} />
                </div>
              </div>
            ))}
          </div>
          {stats.totalMapped === 0 && (
            <p className="text-center text-sm text-gray-400 mt-8">아직 앱 연동 데이터가 없습니다.</p>
          )}
        </section>

        {/* 최근 거래 내역 */}
        <section aria-label="최근 포인트 거래 내역"
          className="lg:col-span-3 glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 animate-fade-in-up delay-400">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">최근 포인트 거래 내역</h2>
              <p className="text-xs text-gray-500 mt-0.5">실시간 DB 데이터</p>
            </div>
          </div>

          {stats.recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 mb-3 opacity-40">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">아직 포인트 거래 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentTransactions.map((tx) => (
                <div key={tx.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 transition-colors duration-150">
                  <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                    tx.type === "earn" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                  }`}>
                    {tx.type === "earn" ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" clipRule="evenodd"
                          d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" clipRule="evenodd"
                          d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {tx.description ?? "포인트 거래"}
                      </span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        tx.source_app === "MOCA"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-violet-100 text-violet-700"
                      }`}>{tx.source_app}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(tx.created_at)}</p>
                  </div>
                  <div className={`shrink-0 text-sm font-bold ${
                    tx.type === "earn" ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {tx.type === "earn" ? "+" : "-"}{tx.amount.toLocaleString()}P
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── 통합 회원 목록 ── */}
      <section aria-label="통합 회원 목록"
        className="glass-card rounded-2xl overflow-hidden shadow-xl shadow-purple-100 animate-fade-in-up delay-500">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <h2 className="text-base font-bold text-gray-900">통합 회원 목록</h2>
            <p className="text-xs text-gray-400 mt-0.5">최근 가입순 · 최대 50명</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/admin/export?type=members"
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </a>
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-violet-100 text-violet-700">
              총 {stats.totalMembers.toLocaleString()}명
            </span>
          </div>
        </div>
        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60" style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["이름", "전화번호", "통합 포인트", "연동 앱", "가입일"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.memberList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                    아직 등록된 회원이 없습니다.
                  </td>
                </tr>
              ) : (
                stats.memberList.map((member) => {
                  const phone = member.phone_number.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
                  const apps = (member.app_user_mapping as { app_name: string }[] ?? []);
                  const joinDate = new Date(member.created_at).toLocaleDateString("ko-KR", {
                    year: "numeric", month: "2-digit", day: "2-digit",
                  });
                  return (
                    <tr key={member.id}
                      className="transition-colors duration-150 hover:bg-purple-50/40"
                      style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {/* 이름 */}
                      <td className="px-6 py-3.5">
                        <Link href={`/admin/members/${member.id}`} className="flex items-center gap-2.5 group/member">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-bold">
                              {(member.name ?? "?").slice(0, 1)}
                            </span>
                          </div>
                          <span className="font-medium text-gray-800 group-hover/member:text-violet-600 transition-colors">
                            {member.name ?? <span className="text-gray-300">미입력</span>}
                          </span>
                        </Link>
                      </td>
                      {/* 전화번호 */}
                      <td className="px-6 py-3.5 font-mono text-gray-600">{phone}</td>
                      {/* 포인트 */}
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-amber-600">
                          {member.integrated_points.toLocaleString()}
                          <span className="text-xs ml-0.5 text-gray-400">P</span>
                        </span>
                      </td>
                      {/* 연동 앱 배지 */}
                      <td className="px-6 py-3.5">
                        <div className="flex gap-1.5">
                          {apps.length === 0 ? (
                            <span className="text-xs text-gray-300">없음</span>
                          ) : (
                            apps.map((a) => (
                              <span key={a.app_name}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  a.app_name === "MOCA"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-violet-100 text-violet-700"
                                }`}>
                                {a.app_name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      {/* 가입일 */}
                      <td className="px-6 py-3.5 text-xs text-gray-400">{joinDate}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
