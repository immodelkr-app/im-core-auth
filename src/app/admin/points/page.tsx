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

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">포인트 내역</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-1">
            전체 앱의 포인트 적립·사용 거래 내역을 조회합니다.
          </p>
        </div>
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
                backgroundColor: appFilter === a ? "rgba(139,92,246,0.3)" : "var(--color-surface-2)",
                color: appFilter === a ? "#c4b5fd" : "var(--color-text-muted)",
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
          <p className="text-sm font-semibold text-white">
            총 <span className="text-violet-400">{filtered.length.toLocaleString()}</span>건 표시
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
