import type { Metadata } from "next";
import Link from "next/link";
import StatCard from "@/components/admin/StatCard";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "imBrain 지원사업" };
// 매번 DB 최신값으로 (proxy.ts가 어드민만 들어오게 막고 있음)
export const dynamic = "force-dynamic";

const SECTIONS = [
  { icon: "🏢", title: "사업자 프로필", desc: "업종·지역·매출 정보", href: "/admin/brain/profile" },
  { icon: "🔎", title: "지원사업 공고 검색", desc: "K-Startup 모집중 공고 · 매칭률 순", href: "/admin/brain/notices" },
  { icon: "✍️", title: "제안서 작성", desc: "Claude가 공고 맞춤 제안서 초안 작성", href: "/admin/brain/proposal" },
];

function kstDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function formatKST(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });
}

const ICON = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export default async function BrainPage() {
  const supabase = createAdminClient();
  const today = kstDate();
  const weekLater = kstDate(7);
  const open = `deadline.is.null,deadline.gte.${today}`;

  const [openCount, closingCount, top, recent, proposalCount, profile, lastCollected] = await Promise.all([
    supabase.from("brain_notices").select("id", { count: "exact", head: true }).or(open),
    supabase.from("brain_notices").select("id", { count: "exact", head: true }).gte("deadline", today).lte("deadline", weekLater),
    supabase.from("brain_notices").select("id, title, org, region, deadline, match_score").or(open)
      .order("match_score", { ascending: false }).order("deadline", { ascending: true, nullsFirst: false }).limit(5),
    supabase.from("brain_proposals").select("id, notice_id, notice_title, created_by, created_at")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("brain_proposals").select("id", { count: "exact", head: true }),
    supabase.from("brain_company_profile").select("updated_at").eq("id", 1).maybeSingle(),
    supabase.from("brain_notices").select("collected_at").order("collected_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const failed = [openCount, closingCount, top, recent, proposalCount].find((r) => r.error);

  const stats = [
    { title: "접수중 공고", value: `${openCount.count ?? 0}건`, subtitle: lastCollected.data ? `마지막 수집 ${formatKST(lastCollected.data.collected_at)}` : "아직 수집 전", color: "purple" as const,
      icon: ICON("M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z") },
    { title: "7일 내 마감", value: `${closingCount.count ?? 0}건`, subtitle: "서두를 공고", color: "pink" as const,
      icon: ICON("M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z") },
    { title: "작성한 초안", value: `${proposalCount.count ?? 0}건`, subtitle: "Claude 제안서", color: "violet" as const,
      icon: ICON("M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z") },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>🧠 imBrain 지원사업</h1>
        <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 14 }}>정부·지자체 지원사업 탐색과 제안서 자동 작성</p>
      </div>

      {failed?.error && (
        <p role="alert" className="glass-card" style={{ borderRadius: 12, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
          일부 데이터를 불러오지 못했습니다: {failed.error.message}
        </p>
      )}

      {!profile.data && (
        <Link href="/admin/brain/profile" className="glass-card" style={{ display: "block", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, fontWeight: 600, color: "#d97706" }}>
          ⚠️ 사업자 프로필이 아직 저장되지 않았습니다. 제안서를 쓰려면 먼저 저장해 주세요 →
        </Link>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        {stats.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20, marginBottom: 24 }}>
        <section className="glass-card" style={{ borderRadius: 16, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>추천 공고 TOP 5</h2>
            <Link href="/admin/brain/notices" style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>전체 보기 →</Link>
          </div>
          {(top.data ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>공고가 없습니다. 공고 검색에서 &quot;최신 공고 수집&quot;을 눌러주세요.</p>
          ) : (
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {top.data!.map((n) => (
                <li key={n.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ width: 40, textAlign: "center", fontSize: 16, fontWeight: 800, color: "#7c3aed", flexShrink: 0 }}>{n.match_score}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{n.org} · {n.region} · 마감 {n.deadline ?? "상시"}</div>
                  </div>
                  <Link href={`/admin/brain/proposal?notice=${n.id}`} className="px-3 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90 shrink-0"
                    style={{ backgroundColor: "var(--color-accent)" }} aria-label={`${n.title} 제안서 작성`}>
                    제안서
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="glass-card" style={{ borderRadius: 16, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>최근 작성한 초안</h2>
            <Link href="/admin/brain/proposal" style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>전체 보기 →</Link>
          </div>
          {(recent.data ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>아직 작성한 초안이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {recent.data!.map((p) => (
                <li key={p.id}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.notice_title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{formatKST(p.created_at)} · {p.created_by}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {SECTIONS.map((s) => (
          <Link key={s.title} href={s.href}>
            <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px", height: "100%" }}>
              <div style={{ fontSize: 28 }} aria-hidden="true">{s.icon}</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", margin: "8px 0 4px" }}>{s.title} →</h2>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
