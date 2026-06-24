import type { ReactNode } from "react";

interface StatCardProps {
  /** 카드 제목 */
  title: string;
  /** 표시할 수치 (문자열로 포맷된 값) */
  value: string;
  /** 이전 기간 대비 변화율 또는 설명 */
  subtitle?: string;
  /** 변화 방향: up(증가), down(감소), neutral(변화 없음) */
  trend?: "up" | "down" | "neutral";
  /** 헤더 아이콘 */
  icon: ReactNode;
  /** 카드 강조 색상 계열 */
  color: "purple" | "violet" | "indigo" | "pink";
  /** 애니메이션 딜레이 클래스 (예: "delay-200") */
  animationDelay?: string;
}

const COLOR_MAP = {
  purple: {
    iconBg:    "bg-purple-100",
    iconColor: "text-purple-600",
    gradFrom:  "from-purple-600",
    gradTo:    "to-violet-500",
    badge:     "bg-purple-50 text-purple-700 ring-purple-200",
    glow:      "shadow-purple-200",
    bar:       "from-purple-400 to-violet-500",
  },
  violet: {
    iconBg:    "bg-violet-100",
    iconColor: "text-violet-600",
    gradFrom:  "from-violet-600",
    gradTo:    "to-purple-500",
    badge:     "bg-violet-50 text-violet-700 ring-violet-200",
    glow:      "shadow-violet-200",
    bar:       "from-violet-400 to-purple-500",
  },
  indigo: {
    iconBg:    "bg-indigo-100",
    iconColor: "text-indigo-600",
    gradFrom:  "from-indigo-600",
    gradTo:    "to-violet-500",
    badge:     "bg-indigo-50 text-indigo-700 ring-indigo-200",
    glow:      "shadow-indigo-200",
    bar:       "from-indigo-400 to-violet-500",
  },
  pink: {
    iconBg:    "bg-pink-100",
    iconColor: "text-pink-600",
    gradFrom:  "from-pink-500",
    gradTo:    "to-purple-500",
    badge:     "bg-pink-50 text-pink-700 ring-pink-200",
    glow:      "shadow-pink-200",
    bar:       "from-pink-400 to-purple-500",
  },
} as const;

const TREND_CONFIG = {
  up: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" clipRule="evenodd"
          d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" />
      </svg>
    ),
    className: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  },
  down: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" clipRule="evenodd"
          d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" />
      </svg>
    ),
    className: "text-red-700 bg-red-50 ring-red-200",
  },
  neutral: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" clipRule="evenodd"
          d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" />
      </svg>
    ),
    className: "text-gray-600 bg-gray-50 ring-gray-200",
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  trend = "neutral",
  icon,
  color,
  animationDelay = "",
}: StatCardProps) {
  const c = COLOR_MAP[color];
  const t = TREND_CONFIG[trend];

  return (
    <article
      className={`
        glass-card relative rounded-2xl p-6 overflow-hidden
        shadow-xl ${c.glow}
        hover:shadow-2xl hover:-translate-y-1
        transition-all duration-300 ease-out
        animate-fade-in-up ${animationDelay}
      `}
    >
      {/* ── 배경 장식: 그라디언트 원 ── */}
      <div
        className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${c.gradFrom} ${c.gradTo} opacity-10 blur-xl pointer-events-none`}
        aria-hidden="true"
      />
      <div
        className={`absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-gradient-to-tr ${c.gradFrom} ${c.gradTo} opacity-5 blur-xl pointer-events-none`}
        aria-hidden="true"
      />

      {/* ── 헤더: 아이콘 + 제목 ── */}
      <div className="relative flex items-start justify-between gap-4 mb-4">
        {/* 아이콘 컨테이너 */}
        <div className={`shrink-0 w-12 h-12 rounded-xl ${c.iconBg} ${c.iconColor} flex items-center justify-center shadow-sm`}>
          {icon}
        </div>

        {/* 트렌드 배지 */}
        {subtitle && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ring-1 ${t.className}`}>
            {t.icon}
            {subtitle}
          </span>
        )}
      </div>

      {/* ── 수치 ── */}
      <div className="relative">
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className={`text-3xl font-black tracking-tight gradient-text animate-count-up ${animationDelay}`}>
          {value}
        </p>
      </div>

      {/* ── 하단 프로그레스 바 (장식용) ── */}
      <div className="relative mt-5">
        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-1000 ease-out`}
            style={{ width: "68%" }}
            role="presentation"
          />
        </div>
      </div>
    </article>
  );
}
