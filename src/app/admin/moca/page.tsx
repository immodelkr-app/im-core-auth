"use client";

import { useEffect, useState } from "react";

// ── 타입 ─────────────────────────────────────────────────────
interface MasterUser {
  id: string;
  phone_number: string;
  name: string | null;
  integrated_points: number;
  created_at: string;
}

interface MocaUser {
  local_user_id: string;
  nickname: string | null;
  created_at: string;
  grade: string | null;
  master_users: MasterUser | null;
}

// ── 등급 배지 스타일 ─────────────────────────────────────────
function gradeBadge(grade: string | null) {
  if (!grade) return { label: "없음", bg: "rgba(255,255,255,0.05)", color: "var(--color-text-muted)" };
  const map: Record<string, { label: string; bg: string; color: string }> = {
    VIP:    { label: "VIP",    bg: "rgba(251,191,36,0.2)",  color: "#fbbf24" },
    GOLD:   { label: "GOLD",   bg: "rgba(234,179,8,0.15)",  color: "#eab308" },
    IMODEL: { label: "IMODEL", bg: "rgba(167,139,250,0.2)", color: "#a78bfa" },
  };
  return map[grade] ?? { label: grade, bg: "rgba(255,255,255,0.08)", color: "var(--color-text-secondary)" };
}

interface MocaStats {
  totalMoca: number;
  todayMoca: number;
  totalEarned: number;
  totalSpent: number;
}

// ── 포맷 헬퍼 ────────────────────────────────────────────────
function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return phone;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDatetime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function MocaAdminPage() {
  const [stats, setStats] = useState<MocaStats | null>(null);
  const [users, setUsers] = useState<MocaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/moca");
      const json = await res.json();
      if (json.success) {
        setStats(json.stats);
        setUsers(json.users);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("MOCA admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 검색 필터
  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const mu = u.master_users;
    return (
      (u.nickname ?? "").toLowerCase().includes(q) ||
      u.local_user_id.toLowerCase().includes(q) ||
      (mu?.phone_number ?? "").includes(q) ||
      (mu?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ── 페이지 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
              style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#a78bfa" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              MOCA
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MOCA 앱 연동 관리</h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-1">
            MOCA 앱과 연동된 통합 회원의 현황을 확인하고 관리합니다.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          새로고침
        </button>
      </div>

      {/* ── 통계 카드 ── */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 rounded-2xl animate-pulse">
              <div className="h-3 bg-white/10 rounded w-2/3 mb-3" />
              <div className="h-7 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 카드 1: 총 연동 회원 */}
          <div className="glass-card p-5 rounded-2xl group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(139,92,246,0.2)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                총 연동 회원
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalMoca.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>명</p>
          </div>

          {/* 카드 2: 오늘 신규 */}
          <div className="glass-card p-5 rounded-2xl group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(34,197,94,0.2)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                오늘 신규 가입
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.todayMoca.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>명 (오늘)</p>
          </div>

          {/* 카드 3: 총 적립 포인트 */}
          <div className="glass-card p-5 rounded-2xl group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(251,191,36,0.2)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                MOCA 누적 적립
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalEarned.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>P 지급</p>
          </div>

          {/* 카드 4: 총 사용 포인트 */}
          <div className="glass-card p-5 rounded-2xl group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(239,68,68,0.2)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
                </svg>
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                MOCA 누적 사용
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalSpent.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>P 차감</p>
          </div>
        </div>
      ) : null}

      {/* ── API 연동 정보 배너 ── */}
      <div
        className="glass-card rounded-2xl p-5 border"
        style={{ borderColor: "rgba(139,92,246,0.2)" }}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(139,92,246,0.15)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 mb-2">MOCA 앱 연동 API 엔드포인트</p>
            <div className="grid gap-1.5">
              {[
                { method: "POST", path: "/api/auth/sync", desc: "로그인 시 SSO 동기화" },
                { method: "GET",  path: "/api/points/balance/:id", desc: "통합 포인트 잔액 조회" },
                { method: "GET",  path: "/api/points/history/:id", desc: "포인트 거래 내역" },
                { method: "POST", path: "/api/points/reward", desc: "포인트 지급" },
                { method: "POST", path: "/api/points/deduct", desc: "포인트 차감" },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center gap-3 text-xs">
                  <span
                    className="shrink-0 w-12 text-center py-0.5 rounded font-bold font-mono"
                    style={{
                      backgroundColor: ep.method === "POST" ? "rgba(139,92,246,0.2)" : "rgba(34,197,94,0.15)",
                      color: ep.method === "POST" ? "#a78bfa" : "#4ade80",
                    }}
                  >
                    {ep.method}
                  </span>
                  <code style={{ color: "var(--color-text-secondary)" }} className="font-mono">{ep.path}</code>
                  <span style={{ color: "var(--color-text-muted)" }}>— {ep.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }}>
              모든 요청에 <code className="text-violet-400">x-api-secret</code> 헤더가 필요합니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── 회원 목록 테이블 ── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">MOCA 연동 회원 목록</h2>
            {lastUpdated && (
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                마지막 업데이트: {formatDatetime(lastUpdated.toISOString())}
              </p>
            )}
          </div>
          {/* 검색 */}
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--color-text-muted)" }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
            </svg>
            <input
              type="text"
              placeholder="이름, 전화번호, ID 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                width: "220px",
              }}
            />
          </div>
        </div>

        {/* 테이블 본문 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                {["닉네임", "이름", "전화번호", "등급", "통합 포인트", "연동 일시"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-white/10 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center" style={{ color: "var(--color-text-muted)" }}>
                    <div className="flex flex-col items-center gap-3">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 opacity-30">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                      </svg>
                      <p>{search ? "검색 결과가 없습니다." : "아직 MOCA 앱에서 연동된 회원이 없습니다."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((u, idx) => {
                  const mu = u.master_users;
                  return (
                    <tr
                      key={`${u.local_user_id}-${idx}`}
                      className="transition-colors duration-150 hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid var(--color-border)" }}
                    >
                      {/* 닉네임 (MOCA 로그인 ID) */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium" style={{ color: "#5b21b6" }}>
                            {u.nickname || <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                          </span>
                          <code className="text-[10px] mt-0.5 font-mono" style={{ color: "#4b5563" }}>
                            {u.local_user_id.slice(0, 8)}…
                          </code>
                        </div>
                      </td>
                      {/* 이름 */}
                      <td className="px-6 py-4" style={{ color: "var(--color-text-secondary)" }}>
                        {mu?.name ?? <span style={{ color: "var(--color-text-muted)" }}>미입력</span>}
                      </td>
                      {/* 전화번호 */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm" style={{ color: "var(--color-text-primary)" }}>
                          {mu ? formatPhone(mu.phone_number) : "—"}
                        </span>
                      </td>
                      {/* 등급 */}
                      <td className="px-6 py-4">
                        {(() => {
                          const b = gradeBadge(u.grade);
                          return (
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wide"
                              style={{ backgroundColor: b.bg, color: b.color }}
                            >
                              {b.label}
                            </span>
                          );
                        })()}
                      </td>
                      {/* 통합 포인트 */}
                      <td className="px-6 py-4">
                        <span className="font-semibold" style={{ color: "#fbbf24" }}>
                          {(mu?.integrated_points ?? 0).toLocaleString()}
                          <span className="text-xs ml-1" style={{ color: "var(--color-text-muted)" }}>P</span>
                        </span>
                      </td>
                      {/* 연동 일시 */}
                      <td className="px-6 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {formatDate(u.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 테이블 푸터 */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            <p className="text-xs">
              전체 <span className="text-gray-900 font-semibold">{stats?.totalMoca ?? 0}</span>명 중{" "}
              <span className="text-gray-900 font-semibold">{filtered.length}</span>명 표시
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
