"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Notice = {
  id: string;
  source: string;
  title: string;
  org: string | null;
  region: string | null;
  category: string | null;
  apply_start: string | null;
  deadline: string | null;
  amount: string | null;
  target: string | null;
  url: string | null;
  description: string | null;
  match_score: number;
  biz_age: string | null;
  eligible: boolean | null;
  collected_at: string;
};

const REGIONS = ["전체", "서울", "경기", "안산", "용인", "수원", "인천", "전국"];
const INPUT = "w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400";

/** 접수 상태는 저장하지 않고 마감일로 계산 (KST 기준 오늘) */
function statusOf(deadline: string | null, today: string): { label: string; bg: string; text: string } {
  if (!deadline) return { label: "마감일 원문 확인", bg: "rgba(59,130,246,0.12)", text: "#2563eb" };
  if (deadline < today) return { label: "마감", bg: "rgba(107,114,128,0.12)", text: "#4b5563" };
  const days = (new Date(deadline).getTime() - new Date(today).getTime()) / 86400000;
  if (days <= 7) return { label: `마감 D-${days}`, bg: "rgba(239,68,68,0.12)", text: "#dc2626" };
  return { label: "접수중", bg: "rgba(16,185,129,0.12)", text: "#059669" };
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors"
      style={{
        backgroundColor: active ? "rgba(124,58,237,0.1)" : "transparent",
        borderColor: active ? "#7c3aed" : "var(--color-border)",
        color: active ? "#7c3aed" : "var(--color-text-secondary)",
      }}>
      {children}
    </button>
  );
}

export default function BrainNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [region, setRegion] = useState("전체");
  const [hideClosed, setHideClosed] = useState(true);
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [selected, setSelected] = useState<Notice | null>(null);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD

  const load = useCallback(
    () => fetch("/api/admin/brain/notices")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setNotices(json.notices);
      }),
    [],
  );

  useEffect(() => {
    fetch("/api/admin/brain/notices")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setNotices(json.notices);
      })
      .catch((e) => setMessage({ ok: false, text: `불러오기 실패: ${e.message}` }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const json = await fetch("/api/admin/brain/notices", { method: "POST" }).then((r) => r.json());
      if (!json.success) throw new Error(json.error);
      await load();
      setMessage({ ok: json.errors.length === 0, text: `K-Startup ${json.kstartup}건 · 안산문화재단 ${json.ansanart}건 · 경기문화재단 ${json.ggcf}건 · 서울문화재단 ${json.sfac}건 · 용인문화재단 ${json.yicf}건 수집${json.errors.length ? ` (일부 실패: ${json.errors.join(" / ")})` : ""}` });
    } catch (e) {
      setMessage({ ok: false, text: `수집 실패: ${(e as Error).message}` });
    } finally {
      setSyncing(false);
    }
  }

  const categories = useMemo(
    () => ["전체", ...[...new Set(notices.map((n) => n.category).filter((c): c is string => !!c))].sort()],
    [notices],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices
      .filter((n) => !hideClosed || !n.deadline || n.deadline >= today)
      .filter((n) => !eligibleOnly || n.eligible !== false)
      .filter((n) => category === "전체" || n.category === category)
      .filter((n) => region === "전체" || n.region === region || `${n.title} ${n.org ?? ""}`.includes(region))
      .filter((n) => !q || `${n.title} ${n.org ?? ""} ${n.description ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.match_score - a.match_score || (a.deadline ?? "9").localeCompare(b.deadline ?? "9"));
  }, [notices, query, category, region, hideClosed, eligibleOnly, today]);

  const lastCollected = notices.reduce<string | null>((m, n) => (!m || n.collected_at > m ? n.collected_at : m), null);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <Link href="/admin/brain" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>← imBrain</Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: "4px 0 0" }}>🔎 지원사업 공고 검색</h1>
          <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 14 }}>
            K-Startup 모집중 공고 + 안산·경기·서울·용인문화재단 공모 · 글로벌아임 매칭률 순
            {lastCollected && ` · 마지막 수집 ${new Date(lastCollected).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`}
          </p>
        </div>
        <button type="button" onClick={handleSync} disabled={syncing}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
          style={{ backgroundColor: "var(--color-accent)" }}>
          {syncing ? "수집 중..." : "최신 공고 수집"}
        </button>
      </div>

      {message && (
        <div role="status" className="glass-card" style={{ borderRadius: 12, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: message.ok ? "#059669" : "#dc2626" }}>
          {message.text}
        </div>
      )}

      <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="search" aria-label="공고 검색" placeholder="공고명, 기관명, 내용으로 검색..." className={INPUT}
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginRight: 4 }}>분야</span>
          {categories.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginRight: 4 }}>지역</span>
          {REGIONS.map((r) => <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>)}
          <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} style={{ accentColor: "#7c3aed" }} />
            업력 조건 맞는 공고만
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} style={{ accentColor: "#7c3aed" }} />
            마감 공고 숨기기
          </label>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
        총 <strong>{filtered.length.toLocaleString()}</strong>건
      </p>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 16 }} />
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ borderRadius: 16, padding: 48, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 14 }}>
          {notices.length === 0 ? "아직 수집된 공고가 없습니다. 우측 상단 \"최신 공고 수집\"을 눌러주세요." : "조건에 맞는 공고가 없습니다."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((n) => {
            const st = statusOf(n.deadline, today);
            return (
              <button key={n.id} type="button" onClick={() => setSelected(n)} className="glass-card text-left hover:opacity-90 transition-opacity"
                style={{ borderRadius: 14, padding: "16px 20px", display: "flex", gap: 16, alignItems: "center", width: "100%" }}>
                <div style={{ width: 56, flexShrink: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: n.match_score >= 85 ? "#7c3aed" : "var(--color-text-primary)" }}>{n.match_score}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>매칭</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.text }}>{st.label}</span>
                    {n.category && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "var(--color-surface-subtle)", color: "var(--color-text-secondary)" }}>{n.category}</span>}
                    {n.region && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}>{n.region}</span>}
                    {n.eligible === false && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#dc2626" }}>업력 미충족</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                    {n.org} · 마감 {n.deadline ?? "원문 확인"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div role="dialog" aria-modal="true" aria-label={selected.title} onClick={() => setSelected(null)}
          onKeyDown={(e) => e.key === "Escape" && setSelected(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,10,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "85vh", overflowY: "auto", padding: 28, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: 0, lineHeight: 1.4 }}>{selected.title}</h2>
              <button type="button" aria-label="닫기" onClick={() => setSelected(null)} autoFocus
                style={{ fontSize: 20, color: "#666", lineHeight: 1, alignSelf: "flex-start" }}>×</button>
            </div>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "18px 0", padding: 16, borderRadius: 12, background: "#f7f7fb", fontSize: 13 }}>
              {[
                ["기관", selected.org],
                ["접수 기간", `${selected.apply_start ?? "?"} ~ ${selected.deadline ?? "상시"}`],
                ["분야 / 지역", `${selected.category ?? "-"} / ${selected.region ?? "-"}`],
                ["매칭률", `${selected.match_score}%`],
                ["업력 조건", `${selected.biz_age ?? "제한 없음"}${selected.eligible === false ? " (미충족)" : ""}`],
              ].map(([k, v]) => (
                <div key={k}><dt style={{ color: "#777", fontSize: 12 }}>{k}</dt><dd style={{ fontWeight: 600, color: "#222", margin: 0 }}>{v}</dd></div>
              ))}
            </dl>
            {selected.target && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>신청 대상</h3>
                <p style={{ fontSize: 13, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: "0 0 16px" }}>{selected.target}</p>
              </>
            )}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#222", margin: "0 0 6px" }}>공고 내용</h3>
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{selected.description ?? "요약 없음 — 원문 공고를 확인해 주세요."}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
              {selected.url && (
                <a href={selected.url} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-sm font-semibold border hover:opacity-80"
                  style={{ borderColor: "#ddd", color: "#333" }}>
                  원문 공고 보기 ↗
                </a>
              )}
              <Link href={`/admin/brain/proposal?notice=${selected.id}`}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: "var(--color-accent)" }}>
                이 공고로 제안서 작성 →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
