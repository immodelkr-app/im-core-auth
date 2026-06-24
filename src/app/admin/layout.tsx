import type { Metadata } from "next";
import Sidebar from "@/components/admin/Sidebar";

export const metadata: Metadata = {
  title: {
    template: "%s | 어드민",
    default: "대시보드",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: "var(--color-surface-subtle)" }}>
      {/* ── 고정 사이드바 ── */}
      <Sidebar />

      {/* ── 스크롤 가능한 메인 영역 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 상단 헤더 */}
        <header
          className="shrink-0 h-16 px-6 flex items-center justify-between border-b"
          style={{
            backgroundColor: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(196,181,253,0.3)",
          }}
        >
          {/* 현재 시각 */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-gray-500 font-medium">시스템 정상 운영 중</span>
          </div>

          {/* 우측 액션 */}
          <div className="flex items-center gap-3">
            {/* 알림 버튼 */}
            <button
              id="admin-header-notification"
              aria-label="알림"
              className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors duration-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {/* 알림 뱃지 */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white" />
            </button>

            {/* 어드민 아바타 */}
            <button
              id="admin-header-profile"
              aria-label="어드민 프로필"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-purple-50 transition-colors duration-200"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                  <path fillRule="evenodd" clipRule="evenodd"
                    d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-700">Admin</span>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
              </svg>
            </button>
          </div>
        </header>

        {/* 실제 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
