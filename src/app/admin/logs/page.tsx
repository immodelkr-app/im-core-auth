"use client";

import { useState, useEffect, useCallback } from "react";
import type { Metadata } from "next";

// 액션 한국어 라벨
const ACTION_LABELS: Record<string, string> = {
  POINT_GRANT:         "포인트 지급",
  POINT_DEDUCT:        "포인트 차감",
  COUPON_CREATE:       "쿠폰 생성",
  COUPON_TOGGLE:       "쿠폰 상태 변경",
  ANNOUNCEMENT_CREATE: "공지사항 생성",
  ANNOUNCEMENT_UPDATE: "공지사항 수정",
  ANNOUNCEMENT_DELETE: "공지사항 삭제",
  ADMIN_CREATE:        "어드민 계정 생성",
  ADMIN_ROLE_CHANGE:   "어드민 역할 변경",
  ADMIN_DELETE:        "어드민 계정 삭제",
};

// 액션별 배지 색상
const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  POINT_GRANT:         { bg: "rgba(16,185,129,0.12)", text: "#059669" },
  POINT_DEDUCT:        { bg: "rgba(239,68,68,0.12)",  text: "#dc2626" },
  COUPON_CREATE:       { bg: "rgba(59,130,246,0.12)", text: "#2563eb" },
  COUPON_TOGGLE:       { bg: "rgba(245,158,11,0.12)", text: "#d97706" },
  ANNOUNCEMENT_CREATE: { bg: "rgba(139,92,246,0.12)", text: "#7c3aed" },
  ANNOUNCEMENT_UPDATE: { bg: "rgba(168,85,247,0.12)", text: "#9333ea" },
  ANNOUNCEMENT_DELETE: { bg: "rgba(239,68,68,0.12)",  text: "#dc2626" },
  ADMIN_CREATE:        { bg: "rgba(6,182,212,0.12)",  text: "#0891b2" },
  ADMIN_ROLE_CHANGE:   { bg: "rgba(245,158,11,0.12)", text: "#d97706" },
  ADMIN_DELETE:        { bg: "rgba(239,68,68,0.12)",  text: "#dc2626" },
};

interface AuditLog {
  id: string;
  admin_email: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

function formatKST(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // 필터 상태
  const [filterAction, setFilterAction] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set("action", filterAction);
      if (filterEmail) params.set("adminEmail", filterEmail);
      if (filterStart) params.set("startDate", filterStart);
      if (filterEnd) params.set("endDate", filterEnd);
      params.set("page", String(p));
      params.set("limit", String(LIMIT));

      const res = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setTotalCount(data.count);
      }
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEmail, filterStart, filterEnd]);

  useEffect(() => { fetchLogs(page); }, [fetchLogs, page]);

  const handleSearch = () => { setPage(1); fetchLogs(1); };
  const totalPages = Math.ceil(totalCount / LIMIT);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
          📋 활동 로그
        </h1>
        <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 14 }}>
          어드민 조작 내역 · 총 <strong>{totalCount.toLocaleString()}</strong>건
        </p>
      </div>

      {/* 필터 영역 */}
      <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        {/* 액션 선택 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>조작 유형</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 13, minWidth: 180 }}
          >
            <option value="">전체</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* 어드민 이메일 검색 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>어드민 이메일</label>
          <input
            type="text"
            placeholder="이메일 검색..."
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 13, width: 200 }}
          />
        </div>

        {/* 날짜 범위 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>시작 날짜</label>
          <input
            type="date"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>종료 날짜</label>
          <input
            type="date"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 13 }}
          />
        </div>

        {/* 검색 버튼 */}
        <button
          onClick={handleSearch}
          style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          검색
        </button>
        <button
          onClick={() => { setFilterAction(""); setFilterEmail(""); setFilterStart(""); setFilterEnd(""); setPage(1); }}
          style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          초기화
        </button>
      </div>

      {/* 로그 테이블 */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-secondary)" }}>로딩 중...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-secondary)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p>조건에 맞는 로그가 없습니다.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-subtle)" }}>
                {["조작 유형", "어드민", "대상", "IP", "일시", "상세"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const colors = ACTION_COLORS[log.action] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
                const isExpanded = expandedId === log.id;
                return (
                  <>
                    <tr
                      key={log.id}
                      style={{ borderBottom: "1px solid var(--color-border)", background: i % 2 === 0 ? "transparent" : "var(--color-surface-subtle)", cursor: "pointer", transition: "background 0.15s" }}
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: colors.bg, color: colors.text }}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--color-text-primary)" }}>
                        {log.admin_email}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                        {log.target_type && <span style={{ fontWeight: 600, marginRight: 4 }}>{log.target_type}</span>}
                        {log.target_id ? (
                          <code style={{ fontSize: 11, background: "var(--color-surface-subtle)", padding: "1px 5px", borderRadius: 4 }}>
                            {log.target_id.length > 20 ? log.target_id.substring(0, 20) + "…" : log.target_id}
                          </code>
                        ) : "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                        {log.ip_address ?? "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                        {formatKST(log.created_at)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer" }}>
                          {isExpanded ? "▲ 접기" : "▼ 상세"}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${log.id}-detail`} style={{ background: "var(--color-surface-subtle)" }}>
                        <td colSpan={6} style={{ padding: "8px 16px 16px" }}>
                          <pre style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", background: "var(--color-surface)", padding: 12, borderRadius: 8, overflowX: "auto", lineHeight: 1.6 }}>
                            {JSON.stringify(log.detail, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ padding: "16px 24px", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, borderTop: "1px solid var(--color-border)" }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: page === 1 ? "var(--color-text-secondary)" : "var(--color-text-primary)", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 13 }}>
              이전
            </button>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {page} / {totalPages} 페이지
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border)", background: "transparent", color: page === totalPages ? "var(--color-text-secondary)" : "var(--color-text-primary)", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 13 }}>
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
