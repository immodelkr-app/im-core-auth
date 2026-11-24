import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "imBrain 지원사업" };

// href 없는 항목은 다음 단계에서 채워질 기능
const SECTIONS = [
  { icon: "🏢", title: "사업자 프로필", desc: "업종·지역·매출 정보", href: "/admin/brain/profile" },
  { icon: "🔎", title: "지원사업 공고 검색", desc: "K-Startup 모집중 공고 · 매칭률 순", href: "/admin/brain/notices" },
  { icon: "✍️", title: "제안서 작성", desc: "Claude가 공고 맞춤 제안서 초안 작성", href: "/admin/brain/proposal" },
];

export default function BrainPage() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
          🧠 imBrain 지원사업
        </h1>
        <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 14 }}>
          정부·지자체 지원사업 탐색과 제안서 자동 작성
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {SECTIONS.map((s) => {
          const card = (
            <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px", height: "100%", opacity: s.href ? 1 : 0.6 }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", margin: "8px 0 4px" }}>
                {s.title} {s.href && "→"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>{s.desc}</p>
            </div>
          );
          return s.href ? <Link key={s.title} href={s.href}>{card}</Link> : <div key={s.title}>{card}</div>;
        })}
      </div>
    </div>
  );
}
