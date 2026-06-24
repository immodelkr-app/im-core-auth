"use client";

import { useState, useEffect, useCallback } from "react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "슈퍼 관리자",
  manager: "매니저",
  viewer: "뷰어",
};
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: "rgba(124,58,237,0.15)", text: "#7c3aed" },
  manager:     { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
  viewer:      { bg: "rgba(107,114,128,0.12)", text: "#4b5563" },
};

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

function formatKST(iso?: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function AdminSettingsUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 신규 어드민 생성 폼
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("manager");
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 역할 변경 상태
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error ?? "조회 실패");
      }
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormMsg(null);
    try {
      const res = await fetch("/api/admin/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, adminRole: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        setFormMsg({ type: "ok", text: "어드민 계정이 생성되었습니다." });
        setNewEmail(""); setNewPassword(""); setNewRole("manager");
        setShowForm(false);
        fetchUsers();
      } else {
        setFormMsg({ type: "err", text: data.error ?? "생성 실패" });
      }
    } catch {
      setFormMsg({ type: "err", text: "서버 에러가 발생했습니다." });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newR: string) {
    setChangingRole(userId);
    try {
      const res = await fetch("/api/admin/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole: newR }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error ?? "역할 변경 실패");
      }
    } finally {
      setChangingRole(null);
    }
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`정말로 "${email}" 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/settings/users?userId=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error ?? "삭제 실패");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
            🔐 어드민 계정 관리
          </h1>
          <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 14 }}>
            역할 부여 및 어드민 계정 초대 · 슈퍼 관리자 전용
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          {showForm ? "✕ 닫기" : "+ 어드민 초대"}
        </button>
      </div>

      {/* 권한 없음 에러 */}
      {error && (
        <div className="glass-card" style={{ borderRadius: 16, padding: "32px 24px", textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <p style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: 8 }}>접근 권한이 없습니다</p>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>{error}</p>
        </div>
      )}

      {/* 신규 초대 폼 */}
      {showForm && !error && (
        <div className="glass-card" style={{ borderRadius: 16, padding: "24px", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 0, marginBottom: 20 }}>
            신규 어드민 초대
          </h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px" }}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>이메일</label>
              <input
                type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                placeholder="admin@example.com"
                style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 180px" }}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>임시 비밀번호</label>
              <input
                type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6자 이상"
                style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "0 1 160px" }}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>역할</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 13 }}>
                <option value="manager">매니저</option>
                <option value="viewer">뷰어</option>
                <option value="super_admin">슈퍼 관리자</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" disabled={formLoading}
                style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: formLoading ? "not-allowed" : "pointer", opacity: formLoading ? 0.7 : 1 }}>
                {formLoading ? "생성 중..." : "계정 생성"}
              </button>
            </div>
            {formMsg && (
              <div style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: formMsg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: formMsg.type === "ok" ? "#059669" : "#dc2626", fontSize: 13, fontWeight: 600 }}>
                {formMsg.text}
              </div>
            )}
          </form>
        </div>
      )}

      {/* 어드민 목록 */}
      {!error && (
        <div className="glass-card" style={{ borderRadius: 16, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-secondary)" }}>로딩 중...</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-subtle)" }}>
                  {["이메일", "역할", "가입일", "마지막 로그인", "관리"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const colors = ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer;
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)", background: i % 2 === 0 ? "transparent" : "var(--color-surface-subtle)" }}>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--color-text-primary)", fontWeight: 600 }}>{u.email}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: colors.bg, color: colors.text }}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>{formatKST(u.created_at)}</td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>{formatKST(u.last_sign_in_at)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {/* 역할 변경 드롭다운 */}
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={changingRole === u.id}
                            style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-primary)", fontSize: 12, cursor: "pointer" }}
                          >
                            <option value="viewer">뷰어</option>
                            <option value="manager">매니저</option>
                            <option value="super_admin">슈퍼 관리자</option>
                          </select>
                          {/* 삭제 버튼 */}
                          <button
                            onClick={() => handleDelete(u.id, u.email)}
                            disabled={deletingId === u.id}
                            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#dc2626", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                          >
                            {deletingId === u.id ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 역할 설명 */}
      <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px", marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 0, marginBottom: 14 }}>역할별 권한 안내</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { role: "super_admin", label: "슈퍼 관리자", desc: "모든 기능 접근 + 어드민 계정 생성/삭제/역할 변경" },
            { role: "manager", label: "매니저", desc: "포인트 지급/차감, 쿠폰 생성/토글, 공지사항 CRUD 가능. 계정 관리 불가." },
            { role: "viewer", label: "뷰어", desc: "모든 페이지 조회 가능. 데이터 수정/생성/삭제 불가." },
          ].map(({ role, label, desc }) => {
            const c = ROLE_COLORS[role];
            return (
              <div key={role} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: c.bg, color: c.text, minWidth: 80, textAlign: "center" }}>{label}</span>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
