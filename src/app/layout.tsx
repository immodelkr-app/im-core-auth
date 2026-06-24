import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | IM-CORE-AUTH 어드민",
    default: "IM-CORE-AUTH 통합 어드민",
  },
  description:
    "아임모델(IM MODEL) 중앙 통합 인증 및 포인트 관리 시스템 — 모카, IMFF, 모델뷰티 통합 어드민 대시보드",
  robots: { index: false, follow: false }, // 어드민은 검색엔진에 노출 안 함
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
