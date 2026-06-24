"use client";

import { useEffect, useState } from "react";

interface PointTx {
  id: string;
  source_app: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  master_users: { phone_number: string; name: string | null } | null;
}

interface PointStats {
  totalEarned: number;
  totalUsed: number;
  mocaEarned: number;
  imffEarned: number;
  netPoints: number;
}

function formatPhone(p: string) {
  return p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
}

function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PointsAdminPage() {
  const [stats, setStats] = useState<PointStats | null>(null);
  const [txs, setTxs] = useState<PointTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "earn" | "use">("all");
  const [appFilter, setAppFilter] = useState<"all" | "MOCA" | "IMFF">("all");
  const [search, setSearch] = useState("");

  // 수동 지급/차감 폼 관련 상태
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [foundMembers, setFoundMembers] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"earn" | "use">("earn");
  const [appSource, setAppSource] = useState<"MOCA" | "IMFF">("MOCA");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/points");
      const json = await res.json();
      if (json.success) {
        setStats(json.stats);
        setTxs(json.transactions);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const searchMembers = async (val: string) => {
    setMemberSearch(val);
    if (val.trim().length < 2) {
      setFoundMembers([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/members?search=${encodeURIComponent(val)}&limit=5`);
      const json = await res.json();
      if (json.success) {
        setFoundMembers(json.members);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      setFormError("회원을 선택해 주세요.");
      return;
    }
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("지급/차감할 포인트를 1 이상의 정수로 입력해 주세요.");
      return;
    }
    if (!description.trim()) {
      setFormError("사유(설명)를 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterUserId: selectedMember.id,
          type,
          amount: parsedAmount,
          description: description.trim(),
          appSource,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`${type === "earn" ? "지급" : "차감"}이 완료되었습니다.`);
        // 폼 초기화
        setSelectedMember(null);
        setMemberSearch("");
        setFoundMembers([]);
        setAmount("");
        setDescription("");
        setIsFormOpen(false);
        // 데이터 리로드
        fetchData();
      } else {
        setFormError(json.error || "처리에 실패했습니다.");
      }
    } catch (err) {
      setFormError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = txs.filter((t) => {
    if (filter !== "all" && t.type !== filter) return false;
    if (appFilter !== "all" && t.source_app !== appFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (t.master_users?.name ?? "").toLowerCase().includes(q) ||
        (t.master_users?.phone_number ?? "").includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = () => {
    const params = new URLSearchParams({ type: "points" });
    if (filter !== "all") params.set("txType", filter);
    window.open(`/api/admin/export?${params}`, "_blank");
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">포인트 내역</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-1">
            전체 앱의 포인트 적립·사용 거래 내역을 조회합니다.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: isFormOpen ? "rgba(124, 58, 237, 0.15)" : "var(--color-surface-2)",
              color: isFormOpen ? "var(--color-accent)" : "var(--color-text-muted)",
              border: isFormOpen ? "1px solid var(--color-accent)" : "1px solid var(--color-border)"
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            수동 지급/차감
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV 내보내기
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-accent)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            새로고침
          </button>
        </div>
      </div>

      {/* 수동 지급/차감 폼 */}
      {isFormOpen && (
        <div className="glass-card rounded-2xl p-6 shadow-xl animate-fade-in-up">
          <h2 className="text-base font-bold text-gray-900 mb-4">포인트 수동 지급 및 차감</h2>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 회원 검색 */}
              <div className="relative space-y-1">
                <label className="text-xs font-semibold text-gray-500">회원 검색</label>
                {selectedMember ? (
                  <div className="flex items-center justify-between p-2 rounded-xl text-sm bg-purple-50 border border-purple-200">
                    <div>
                      <span className="font-bold text-purple-900">{selectedMember.name}</span>
                      <span className="text-xs text-purple-600 ml-2">({formatPhone(selectedMember.phone_number)})</span>
                      <span className="text-xs font-semibold text-amber-600 ml-3">{selectedMember.integrated_points.toLocaleString()}P 보유</span>
                    </div>
                    <button type="button" onClick={() => setSelectedMember(null)} className="text-purple-400 hover:text-purple-600">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <input type="text" placeholder="이름 또는 전화번호 입력 (2글자 이상)..."
                      value={memberSearch} onChange={(e) => searchMembers(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400 transition-colors" />
                    {foundMembers.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                        {foundMembers.map((m) => (
                          <button type="button" key={m.id} onClick={() => { setSelectedMember(m); setFoundMembers([]); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 transition-colors flex items-center justify-between">
                            <div>
                              <span className="font-bold text-gray-800">{m.name}</span>
                              <span className="text-xs text-gray-500 ml-2">({formatPhone(m.phone_number)})</span>
                            </div>
                            <span className="text-xs font-semibold text-amber-600">{m.integrated_points.toLocaleString()}P</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 지급/차감 구분 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">작업 구분</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setType("earn")}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border"
                    style={{
                      backgroundColor: type === "earn" ? "rgba(16, 185, 129, 0.1)" : "transparent",
                      borderColor: type === "earn" ? "#10b981" : "#e5e7eb",
                      color: type === "earn" ? "#047857" : "#4b5563"
                    }}>
                    지급 (+)
                  </button>
                  <button type="button" onClick={() => setType("use")}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border"
                    style={{
                      backgroundColor: type === "use" ? "rgba(239, 68, 68, 0.1)" : "transparent",
                      borderColor: type === "use" ? "#ef4444" : "#e5e7eb",
                      color: type === "use" ? "#b91c1c" : "#4b5563"
                    }}>
                    차감 (-)
                  </button>
                </div>
              </div>

              {/* 포인트 금액 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">포인트 금액</label>
                <input type="number" placeholder="예: 500"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400" />
              </div>

              {/* 적용 서비스 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">적용 앱 소스</label>
                <div className="flex gap-2">
                  {["MOCA", "IMFF"].map((app) => (
                    <button type="button" key={app} onClick={() => setAppSource(app as any)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors border"
                      style={{
                        backgroundColor: appSource === app ? "rgba(124, 58, 237, 0.1)" : "transparent",
                        borderColor: appSource === app ? "var(--color-accent)" : "#e5e7eb",
                        color: appSource === app ? "var(--color-accent)" : "#4b5563"
                      }}>
                      {app}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 설명 (사유) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">지급/차감 사유 (설명)</label>
              <input type="text" placeholder="예: 프로필 연동 이벤트 보상, 관리자 수동 조작 등"
                value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400" />
            </div>

            {formError && (
              <p className="text-xs font-semibold text-red-500">{formError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ backgroundColor: "var(--color-accent)" }}>
                {submitting ? "처리 중..." : "적용하기"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "총 적립", value: stats.totalEarned, unit: "P", color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
            { label: "총 사용", value: stats.totalUsed,   unit: "P", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
            { label: "순 포인트", value: stats.netPoints, unit: "P", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
            { label: "MOCA 적립", value: stats.mocaEarned, unit: "P", color: "#c4b5fd", bg: "rgba(196,181,253,0.1)" },
            { label: "IMFF 적립", value: stats.imffEarned, unit: "P", color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
          ].map((c) => (
            <div key={c.label} className="glass-card p-4 rounded-2xl">
              <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>{c.label}</p>
              <p className="text-2xl font-bold" style={{ color: c.color }}>
                {c.value.toLocaleString()}
                <span className="text-xs ml-1" style={{ color: "var(--color-text-muted)" }}>{c.unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 필터 + 검색 */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-3">
        {/* 타입 필터 */}
        <div className="flex gap-1.5">
          {(["all", "earn", "use"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: filter === f ? "var(--color-accent)" : "var(--color-surface-2)",
                color: filter === f ? "white" : "var(--color-text-muted)",
              }}>
              {f === "all" ? "전체" : f === "earn" ? "✚ 적립" : "▼ 사용"}
            </button>
          ))}
        </div>
        {/* 앱 필터 */}
        <div className="flex gap-1.5">
          {(["all", "MOCA", "IMFF"] as const).map((a) => (
            <button key={a} onClick={() => setAppFilter(a)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: appFilter === a ? "rgba(139,92,246,0.15)" : "var(--color-surface-2)",
                color: appFilter === a ? "var(--color-accent)" : "var(--color-text-muted)",
              }}>
              {a === "all" ? "앱 전체" : a}
            </button>
          ))}
        </div>
        {/* 검색 */}
        <div className="relative ml-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
          <input type="text" placeholder="이름, 전화번호, 설명 검색..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
            style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)", width: "220px" }} />
        </div>
      </div>

      {/* 테이블 */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <p className="text-sm font-semibold text-gray-900">
            총 <span className="text-violet-600 font-bold">{filtered.length.toLocaleString()}</span>건 표시
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                {["구분", "앱", "이름", "전화번호", "포인트", "설명", "일시"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center"
                  style={{ color: "var(--color-text-muted)" }}>거래 내역이 없습니다.</td></tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id}
                    className="transition-colors duration-150 hover:bg-white/[0.03]"
                    style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {/* 구분 */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        tx.type === "earn"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}>
                        {tx.type === "earn" ? "▲ 적립" : "▼ 사용"}
                      </span>
                    </td>
                    {/* 앱 */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        tx.source_app === "MOCA" ? "bg-purple-500/20 text-purple-300" : "bg-violet-500/20 text-violet-300"
                      }`}>{tx.source_app}</span>
                    </td>
                    {/* 이름 */}
                    <td className="px-5 py-3.5" style={{ color: "var(--color-text-secondary)" }}>
                      {tx.master_users?.name ?? <span style={{ color: "var(--color-text-muted)" }}>미입력</span>}
                    </td>
                    {/* 전화번호 */}
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {tx.master_users ? formatPhone(tx.master_users.phone_number) : "—"}
                    </td>
                    {/* 포인트 */}
                    <td className="px-5 py-3.5">
                      <span className={`font-bold ${
                        tx.type === "earn" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {tx.type === "earn" ? "+" : "-"}{tx.amount.toLocaleString()}P
                      </span>
                    </td>
                    {/* 설명 */}
                    <td className="px-5 py-3.5 max-w-[180px] truncate text-xs"
                      style={{ color: "var(--color-text-muted)" }}>
                      {tx.description ?? "—"}
                    </td>
                    {/* 일시 */}
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {formatDatetime(tx.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
