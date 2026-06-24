"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAdminRole, ROLE_LABELS, ROLE_BADGE_STYLE } from "@/lib/rbac";
import type { AdminRole } from "@/lib/rbac";

export default function AdminHeader() {
  const router = useRouter();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRole, setAdminRole] = useState<AdminRole>("manager");

  // 현재 로그인한 어드민 정보 로드
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAdminEmail(user.email ?? "");
        setAdminRole(getAdminRole(user as any));
      }
    });
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const [notifications, setNotifications] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    // 로컬스토리지에서 읽은 알림 ID 목록 로드
    const saved = localStorage.getItem("read_announcements");
    if (saved) {
      try {
        setReadIds(JSON.parse(saved));
      } catch (e) {}
    }

    const loadAnnouncements = async () => {
      try {
        const res = await fetch("/api/admin/announcements?activeOnly=true");
        const json = await res.json();
        if (json.success) {
          setNotifications(json.announcements);
        }
      } catch (err) {
        console.error("알림 조회 실패:", err);
      }
    };
    loadAnnouncements();
  }, []);

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  const handleMarkAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    localStorage.setItem("read_announcements", JSON.stringify(allIds));
    setReadIds(allIds);
  };

  const handleNotifClick = (id: string) => {
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      localStorage.setItem("read_announcements", JSON.stringify(newReadIds));
      setReadIds(newReadIds);
    }
    router.push("/admin/announcements");
  };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  }

  return (
    <header
      className="shrink-0 h-16 px-6 flex items-center justify-between border-b"
      style={{
        backgroundColor: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        borderColor: "rgba(196,181,253,0.3)",
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* 현재 시스템 상태 */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm text-gray-500 font-medium">시스템 정상 운영 중</span>
      </div>

      {/* 우측 액션 */}
      <div className="flex items-center gap-3">

        {/* ── 알림 버튼 ── */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            id="admin-header-notification"
            aria-label="알림"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowProfile(false);
            }}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors duration-200"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white" />
            )}
          </button>

          {/* 알림 드롭다운 */}
          {showNotifications && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 300,
                backgroundColor: "white",
                borderRadius: 16,
                boxShadow: "0 8px 32px rgba(109,40,217,0.12), 0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid rgba(196,181,253,0.3)",
                overflow: "hidden",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: "14px 16px 10px",
                  borderBottom: "1px solid rgba(196,181,253,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>알림</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#7c3aed",
                      backgroundColor: "#ede9fe",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    새 알림 {unreadCount}개
                  </span>
                )}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: "6px 0", maxHeight: "240px", overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <li style={{ padding: "16px", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
                    표시할 활성 공지사항이 없습니다.
                  </li>
                ) : (
                  notifications.map((n) => {
                    const isUnread = !readIds.includes(n.id);
                    return (
                      <li
                        key={n.id}
                        onClick={() => handleNotifClick(n.id)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 16px",
                          backgroundColor: isUnread ? "rgba(237,233,254,0.4)" : "transparent",
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(237,233,254,0.7)")}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = isUnread ? "rgba(237,233,254,0.4)" : "transparent")
                        }
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: isUnread ? "#7c3aed" : "transparent",
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, color: "#374151", fontWeight: isUnread ? 600 : 400, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {n.title}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {n.body}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#cbd5e1" }}>{timeAgo(n.created_at)}</p>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <div style={{ padding: "8px 16px 12px", borderTop: "1px solid rgba(196,181,253,0.2)" }}>
                <button
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  style={{
                    width: "100%",
                    fontSize: 13,
                    color: unreadCount === 0 ? "#9ca3af" : "#7c3aed",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: unreadCount === 0 ? "default" : "pointer",
                    padding: "6px 0",
                    borderRadius: 8,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (unreadCount > 0) e.currentTarget.style.backgroundColor = "rgba(237,233,254,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  모두 읽음으로 표시
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 어드민 프로필 + 로그아웃 드롭다운 ── */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            id="admin-header-profile"
            aria-label="어드민 프로필"
            onClick={() => {
              setShowProfile((prev) => !prev);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-purple-50 transition-colors duration-200"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path fillRule="evenodd" clipRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-semibold text-gray-700 leading-tight" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {adminEmail || "Admin"}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 20,
              background: ROLE_BADGE_STYLE[adminRole].bg,
              color: ROLE_BADGE_STYLE[adminRole].text,
              lineHeight: "1.4",
            }}>
              {ROLE_LABELS[adminRole]}
            </span>
          </div>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-gray-400"
              style={{ transition: "transform 0.2s", transform: showProfile ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              <path fillRule="evenodd" clipRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
            </svg>
          </button>

          {/* 프로필 드롭다운 */}
          {showProfile && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 180,
                backgroundColor: "white",
                borderRadius: 16,
                boxShadow: "0 8px 32px rgba(109,40,217,0.12), 0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid rgba(196,181,253,0.3)",
                overflow: "hidden",
                zIndex: 100,
              }}
            >
              <ul style={{ listStyle: "none", margin: 0, padding: "6px 0" }}>
                <li>
                  <button
                    id="admin-logout-button"
                    onClick={handleLogout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 16px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "#dc2626",
                      fontWeight: 600,
                      transition: "background 0.15s",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(254,226,226,0.6)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    로그아웃
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
