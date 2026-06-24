"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// ── 네비게이션 메뉴 정의 ──────────────────────────────────────
const NAV_ITEMS = [
  {
    id: "members",
    label: "통합 회원 관리",
    href: "/admin",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    badge: null,
  },
  {
    id: "moca",
    label: "MOCA 앱 연동 관리",
    href: "/admin/moca",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" />
      </svg>
    ),
    badge: "MOCA",
  },
  {
    id: "imff",
    label: "IMFF 앱 연동 관리",
    href: "/admin/imff",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    badge: "IMFF",
  },
  {
    id: "points",
    label: "포인트 내역",
    href: "/admin/points",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    badge: null,
  },
  {
    id: "coupons",
    label: "쿠폰 관리",
    href: "/admin/coupons",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
    badge: null,
  },
  {
    id: "beauty",
    label: "모델뷰티 통합 리워드",
    href: "/admin/beauty",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    badge: "NEW",
  },
] as const;

// ── 보조 메뉴 ─────────────────────────────────────────────────
const BOTTOM_ITEMS = [
  {
    label: "시스템 설정",
    href: "/admin/settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
] as const;

// ── 컴포넌트 ──────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{ backgroundColor: "var(--color-sidebar-bg)" }}
      className={`
        relative flex flex-col h-full
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-[72px]" : "w-64"}
      `}
    >
      {/* ── 상단 로고 영역 ── */}
      <div
        style={{ borderColor: "var(--color-sidebar-border)" }}
        className="flex items-center gap-3 px-4 h-16 border-b shrink-0 overflow-hidden"
      >
        {/* 로고 아이콘 */}
        <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-900/40 animate-pulse-glow">
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>

        {/* 로고 텍스트 */}
        {!isCollapsed && (
          <div className="min-w-0 animate-slide-in-left">
            <p className="text-white font-bold text-sm leading-tight truncate">IM-CORE-AUTH</p>
            <p style={{ color: "var(--color-sidebar-muted)" }} className="text-[10px] leading-tight truncate">
              통합 어드민 시스템
            </p>
          </div>
        )}
      </div>

      {/* ── 메인 내비게이션 ── */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {/* 섹션 레이블 */}
        {!isCollapsed && (
          <p style={{ color: "var(--color-sidebar-muted)" }}
            className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest">
            관리 메뉴
          </p>
        )}

        {NAV_ITEMS.map((item, idx) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium transition-all duration-200 overflow-hidden
                animate-fade-in-up delay-${(idx + 1) * 100}
                ${active
                  ? "text-white shadow-lg shadow-purple-900/30"
                  : "hover:text-white"
                }
              `}
              style={{
                backgroundColor: active ? "var(--color-sidebar-active)" : "transparent",
                color: active ? "white" : "var(--color-sidebar-text)",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-sidebar-hover)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              {/* 활성 인디케이터 바 */}
              {active && <span className="nav-active-indicator" />}

              {/* 아이콘 */}
              <span className={`shrink-0 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-105"}`}>
                {item.icon}
              </span>

              {/* 메뉴 텍스트 + 배지 */}
              {!isCollapsed && (
                <span className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`
                      ml-2 shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide
                      ${active
                        ? "bg-white/20 text-white"
                        : item.badge === "NEW"
                          ? "bg-violet-500/20 text-violet-300"
                          : "bg-purple-900/50 text-purple-300"
                      }
                    `}>
                      {item.badge}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── 구분선 ── */}
      <div style={{ borderColor: "var(--color-sidebar-border)" }} className="mx-3 border-t" />

      {/* ── 하단 보조 메뉴 ── */}
      <div className="px-2 py-3 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={isCollapsed ? item.label : undefined}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
            style={{ color: "var(--color-sidebar-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-sidebar-hover)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-sidebar-text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--color-sidebar-muted)";
            }}
          >
            <span className="shrink-0 group-hover:scale-105 transition-transform duration-200">
              {item.icon}
            </span>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
      </div>

      {/* ── 버전 푸터 ── */}
      {!isCollapsed && (
        <div style={{ borderColor: "var(--color-sidebar-border)", color: "var(--color-sidebar-muted)" }}
          className="px-4 py-3 border-t">
          <p className="text-[10px] text-center">IM-CORE-AUTH v0.1.0</p>
        </div>
      )}

      {/* ── 접기/펼치기 버튼 ── */}
      <button
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
        className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full bg-violet-600 border-2 border-violet-800 flex items-center justify-center shadow-md hover:bg-violet-500 transition-colors duration-200"
      >
        <svg
          viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}
          className={`w-3 h-3 transition-transform duration-300 ${isCollapsed ? "rotate-0" : "rotate-180"}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  );
}
