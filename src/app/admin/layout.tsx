import type { Metadata } from "next";
import Sidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/AdminHeader";

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
        <AdminHeader />

        {/* 실제 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
