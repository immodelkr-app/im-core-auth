"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  target_app: string;
  is_active: boolean;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetApp, setTargetApp] = useState("ALL");
  const [formError, setFormError] = useState("");

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements");
      const json = await res.json();
      if (json.success) {
        setAnnouncements(json.announcements);
      }
    } catch (err) {
      console.error("공지사항 패치 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFormError("제목과 내용을 모두 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), target_app: targetApp }),
      });
      const json = await res.json();
      if (json.success) {
        // Reset form
        setTitle("");
        setBody("");
        setTargetApp("ALL");
        fetchAnnouncements();
      } else {
        setFormError(json.error || "공지사항 생성에 실패했습니다.");
      }
    } catch (err) {
      setFormError("네트워크 에러가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });
      const json = await res.json();
      if (json.success) {
        // Optimistic update or refetch
        setAnnouncements((prev) =>
          prev.map((ann) => (ann.id === id ? { ...ann, is_active: !currentStatus } : ann))
        );
      }
    } catch (err) {
      console.error("상태 토글 실패:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 공지사항을 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/admin/announcements?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setAnnouncements((prev) => prev.filter((ann) => ann.id !== id));
      } else {
        alert(json.error || "삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">공지사항 관리</h1>
        <p style={{ color: "var(--color-text-muted)" }} className="text-sm mt-1">
          사용자용 통합 공지사항을 생성하고, 활성 상태를 제어합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 공지사항 작성 폼 */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 shadow-xl shadow-purple-100 space-y-4">
            <h2 className="text-base font-bold text-gray-900">신규 공지 작성</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* 제목 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">공지 제목</label>
                <input type="text" placeholder="제목을 입력해 주세요."
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400" />
              </div>

              {/* 내용 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">공지 내용</label>
                <textarea placeholder="공지 내용을 자세히 작성해 주세요." rows={5}
                  value={body} onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400 resize-none" />
              </div>

              {/* 타겟 서비스 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">대상 서비스</label>
                <div className="flex gap-2">
                  {["ALL", "MOCA", "IMFF"].map((app) => (
                    <button type="button" key={app} onClick={() => setTargetApp(app)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border"
                      style={{
                        backgroundColor: targetApp === app ? "rgba(124, 58, 237, 0.1)" : "transparent",
                        borderColor: targetApp === app ? "var(--color-accent)" : "#e5e7eb",
                        color: targetApp === app ? "var(--color-accent)" : "#4b5563",
                      }}>
                      {app === "ALL" ? "전체" : app}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-xs font-semibold text-red-500">{formError}</p>
              )}

              <button type="submit" disabled={submitting}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all mt-2"
                style={{ backgroundColor: "var(--color-accent)" }}>
                {submitting ? "등록하는 중..." : "공지사항 등록"}
              </button>
            </form>
          </div>
        </div>

        {/* 오른쪽: 공지사항 목록 */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-2xl overflow-hidden shadow-xl shadow-purple-100">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <h2 className="text-base font-bold text-gray-900">등록된 공지 목록</h2>
              <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-violet-100 text-violet-700">
                총 {announcements.length}개
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60" style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["상태", "제목", "대상", "작성일시", "관리"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
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
                            <div className="h-4 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : announcements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                        등록된 공지사항이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    announcements.map((ann) => (
                      <tr key={ann.id} className="hover:bg-purple-50/20 transition-colors" style={{ borderBottom: "1px solid var(--color-border)" }}>
                        {/* 활성/비활성 스위치 */}
                        <td className="px-6 py-4">
                          <button type="button" onClick={() => handleToggleActive(ann.id, ann.is_active)}
                            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                            style={{
                              backgroundColor: ann.is_active ? "var(--color-accent)" : "#d1d5db",
                            }}>
                            <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                              style={{
                                transform: ann.is_active ? "translateX(16px)" : "translateX(0)",
                              }} />
                          </button>
                        </td>

                        {/* 제목 + 본문 미리보기 */}
                        <td className="px-6 py-4 max-w-[200px]">
                          <p className="font-bold text-gray-800 truncate">{ann.title}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{ann.body}</p>
                        </td>

                        {/* 대상 서비스 */}
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            ann.target_app === "ALL"
                              ? "bg-gray-100 text-gray-700"
                              : ann.target_app === "MOCA"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-violet-100 text-violet-700"
                          }`}>
                            {ann.target_app === "ALL" ? "전체" : ann.target_app}
                          </span>
                        </td>

                        {/* 등록일시 */}
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {formatDate(ann.created_at)}
                        </td>

                        {/* 관리 (삭제) */}
                        <td className="px-6 py-4">
                          <button onClick={() => handleDelete(ann.id)}
                            className="text-red-500 hover:text-red-700 transition-colors text-xs font-semibold">
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
