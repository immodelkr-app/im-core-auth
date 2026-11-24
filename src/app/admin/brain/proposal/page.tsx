"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Notice = { id: string; title: string; org: string | null; deadline: string | null; match_score: number };
type Proposal = { id: string; notice_title: string; memo: string | null; content: string; model: string | null; created_by: string | null; created_at: string };

const INPUT = "w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400";
const ERROR_MARK = "[[ERROR]]";

function formatKST(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function ProposalWriter() {
  const params = useSearchParams();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [noticeId, setNoticeId] = useState(params.get("notice") ?? "");
  const [filter, setFilter] = useState("");
  const [memo, setMemo] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  useEffect(() => {
    fetch("/api/admin/brain/notices").then((r) => r.json()).then((j) => j.success && setNotices(j.notices)).catch(() => {});
    fetch("/api/admin/brain/proposals").then((r) => r.json()).then((j) => j.success && setProposals(j.proposals)).catch(() => {});
  }, []);

  const openNotices = useMemo(() => {
    const q = filter.trim();
    return notices
      .filter((n) => !n.deadline || n.deadline >= today || n.id === noticeId)
      .filter((n) => !q || n.title.includes(q) || (n.org ?? "").includes(q) || n.id === noticeId)
      .sort((a, b) => b.match_score - a.match_score);
  }, [notices, filter, today, noticeId]);

  const selected = notices.find((n) => n.id === noticeId);

  async function handleGenerate() {
    setGenerating(true);
    setOutput("");
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/brain/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId, memo }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      // 서버가 보내는 본문을 받는 대로 화면에 표시
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const cut = text.indexOf(ERROR_MARK);
        setOutput((cut >= 0 ? text.slice(0, cut) : text).trimEnd());
      }
      const cut = text.indexOf(ERROR_MARK);
      if (cut >= 0) setError(text.slice(cut + ERROR_MARK.length).trim());
      const j = await fetch("/api/admin/brain/proposals").then((r) => r.json());
      if (j.success) setProposals(j.proposals);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/brain" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>← imBrain</Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: "4px 0 0" }}>✍️ 제안서 작성</h1>
        <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 14 }}>
          공고와 <Link href="/admin/brain/profile" style={{ textDecoration: "underline" }}>사업자 프로필</Link>을 바탕으로 Claude가 제안서 초안을 작성합니다 · 1~3분 소요
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20, alignItems: "start" }}>
        <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label htmlFor="notice-filter" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
              지원사업 공고 (접수중 · 매칭률 순)
            </label>
            <input id="notice-filter" type="search" className={INPUT} placeholder="공고명·기관 검색" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <select aria-label="공고 선택" className={INPUT} size={8} style={{ marginTop: 8 }} value={noticeId} onChange={(e) => setNoticeId(e.target.value)}>
              {openNotices.map((n) => (
                <option key={n.id} value={n.id}>[{n.match_score}] {n.title} · ~{n.deadline ?? "상시"}</option>
              ))}
            </select>
            {notices.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6 }}>
                공고가 없습니다. <Link href="/admin/brain/notices" style={{ textDecoration: "underline" }}>공고 검색</Link>에서 먼저 수집해 주세요.
              </p>
            )}
          </div>
          {selected && (
            <p style={{ fontSize: 13, color: "var(--color-text-primary)", margin: 0 }}>
              선택: <strong>{selected.title}</strong> ({selected.org})
            </p>
          )}
          <div>
            <label htmlFor="memo" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
              강조할 내용 / 요청사항 (선택)
            </label>
            <textarea id="memo" rows={4} maxLength={2000} className={INPUT} style={{ resize: "vertical" }}
              placeholder="예: 시니어 모델 일자리 창출을 중심으로, 안산 신안산대 연계를 강조해줘"
              value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <button type="button" onClick={handleGenerate} disabled={!noticeId || generating}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ backgroundColor: "var(--color-accent)" }}>
            {generating ? "Claude가 작성 중..." : "제안서 초안 작성"}
          </button>
        </div>

        <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px", minHeight: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>초안</h2>
            {output && !generating && (
              <button type="button" onClick={handleCopy} className="px-3 py-1 rounded-lg text-xs font-semibold border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                {copied ? "복사됨 ✓" : "복사"}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", margin: "0 0 12px" }}>{error}</p>
          )}
          {output ? (
            <div aria-live="polite" style={{ fontSize: 14, lineHeight: 1.8, color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>{output}</div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {generating ? "공고와 사업자 정보를 분석하고 있습니다... 첫 문장이 나오기까지 수십 초 걸릴 수 있어요." : "공고를 선택하고 \"제안서 초안 작성\"을 눌러주세요."}
            </p>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", margin: "32px 0 12px" }}>최근 작성한 초안</h2>
      {proposals.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>아직 작성한 초안이 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {proposals.map((p) => (
            <details key={p.id} className="glass-card" style={{ borderRadius: 12, padding: "12px 16px" }}>
              <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
                {p.notice_title}
                <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 8 }}>
                  {formatKST(p.created_at)} · {p.created_by}
                </span>
              </summary>
              {p.memo && <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "8px 0 0" }}>메모: {p.memo}</p>}
              <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--color-text-primary)", whiteSpace: "pre-wrap", marginTop: 10 }}>{p.content}</div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// useSearchParams 는 Suspense 안에서만 사용 가능
export default function BrainProposalPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 400, borderRadius: 16 }} />}>
      <ProposalWriter />
    </Suspense>
  );
}
