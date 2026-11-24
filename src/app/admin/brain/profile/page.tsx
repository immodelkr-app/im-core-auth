"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  company_name: string;
  ceo_name: string;
  biz_number: string;
  founded: string;
  address: string;
  region: string;
  biz_types: string[];
  main_biz: string;
  revenue: string;
  employees: string;
  description: string;
  website: string;
  phone: string;
  target_regions: string[];
  alt_applicants: string;
  relocation: string;
};

const REGIONS = ["서울", "경기", "안산", "용인", "수원", "인천", "전국"];

// 글로벌아임 기본 프로필 (DB에 저장된 값이 없을 때 사용 — 기존 imBrain에서 이전)
const DEFAULT_PROFILE: Profile = {
  company_name: "글로벌아임",
  ceo_name: "김대희",
  biz_number: "365-22-00947",
  founded: "2018-07-09",
  address: "서울특별시 강남구 도곡로17길 16, 102동 303호 (역삼동, 마이플레이스)",
  region: "서울",
  biz_types: ["서비스업", "공간대여업", "전자상거래 소매업", "도매 및 소매업", "모델/엔터테인먼트", "라이브커머스", "공연기획"],
  main_biz: "서비스업",
  revenue: "",
  employees: "",
  description: `[글로벌아임 핵심 보유 플랫폼 & 사업 자산]
• moca (모카 앱): 시니어 및 청년 광고모델 활동 지원, 캐스팅 및 전문 교육 모바일 플랫폼
• imff (아임패션페스티벌): 대규모 패션쇼, 공연 기획, 모델 대회 개최 및 문화예술 행사진행
• model-beauty (모델 뷰티): 뷰티·코스메틱·잡화 커머스 플랫폼, 라이브커머스 연계 및 청년/시니어 일거리 창출
• 아임모델 커뮤니티: 회원수 1,000여 명 이상의 현직/지망 모델 인프라를 보유한 네이버 대표 팬/모델 커뮤니티 운영

[산학 연계 네트워크 및 교수진 역량]
• 경희대학교 국제캠퍼스(용인) 평생교육원 모델 교육과정 운영 및 주임교수
• 신안산대학교(안산) 평생교육원 모델 교육과정 운영 및 교수
• 대학 보유 교육 공간·연구 인프라 및 전공 인적 네트워크 직접 활용 가능

[실사용 사무실/연습실]
• 서울특별시 영등포구 영중로159, 7층 글로벌아임모델 (사업자등록 소재지와 별개로 실제 사무실·연습실로 사용 중)`,
  website: "https://immodel.kr",
  phone: "",
  target_regions: ["서울", "경기", "안산", "용인", "수원", "전국"],
  alt_applicants: "신안산대학교 (평생교육원 모델 교육과정 운영 — 대학 명의로 신청 가능)",
  relocation: "2027년 1월경 사업장 주소지를 안산시로 이전 예정",
};

const INPUT = "w-full px-3 py-2 rounded-xl text-sm outline-none border border-gray-200 focus:border-purple-400";

// 컴포넌트 밖에 정의해야 입력 중 포커스가 풀리지 않음
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ borderRadius: 16, padding: "20px 24px" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 16px" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

export default function BrainProfilePage() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [updatedInfo, setUpdatedInfo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/brain/profile")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        if (json.profile) setProfile({ ...DEFAULT_PROFILE, ...json.profile });
        if (json.updated_at) setUpdatedInfo(`${new Date(json.updated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · ${json.updated_by ?? ""}`);
      })
      .catch((e) => setMessage({ ok: false, text: `불러오기 실패: ${e.message}` }))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof Profile>(field: K, value: Profile[K]) => {
    setProfile((p) => ({ ...p, [field]: value }));
    setMessage(null);
  };

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/brain/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setUpdatedInfo(`${new Date(json.updated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · ${json.updated_by ?? ""}`);
      setMessage({ ok: true, text: "저장했습니다." });
    } catch (e) {
      setMessage({ ok: false, text: `저장 실패: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="skeleton" style={{ maxWidth: 1200, margin: "0 auto", height: 400, borderRadius: 16 }} />;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <Link href="/admin/brain" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>← imBrain</Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", margin: "4px 0 0" }}>🏢 사업자 프로필</h1>
          <p style={{ color: "var(--color-text-secondary)", marginTop: 4, fontSize: 14 }}>
            지원사업 매칭과 제안서 작성에 쓰이는 기업 정보 {updatedInfo ? `· 마지막 저장 ${updatedInfo}` : "· 아직 저장된 적 없음 (기본값 표시 중)"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {message && (
            <span role="status" style={{ fontSize: 13, fontWeight: 600, color: message.ok ? "#059669" : "#dc2626" }}>{message.text}</span>
          )}
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ backgroundColor: "var(--color-accent)" }}>
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="기본 사업자 정보">
            <Field label="상호명" id="company-name">
              <input id="company-name" className={INPUT} value={profile.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="대표자명" id="ceo-name">
                <input id="ceo-name" className={INPUT} value={profile.ceo_name} onChange={(e) => set("ceo_name", e.target.value)} />
              </Field>
              <Field label="사업자등록번호" id="biz-number">
                <input id="biz-number" className={INPUT} value={profile.biz_number} readOnly style={{ opacity: 0.7, cursor: "not-allowed" }} />
              </Field>
            </div>
            <Field label="개업 연월일" id="founded">
              <input id="founded" type="date" className={INPUT} value={profile.founded} onChange={(e) => set("founded", e.target.value)} />
            </Field>
          </Card>

          <Card title="소재지 및 연락처">
            <Field label="사업장 소재지" id="address">
              <input id="address" className={INPUT} value={profile.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="주요 활동 지역" id="region">
                <select id="region" className={INPUT} value={profile.region} onChange={(e) => set("region", e.target.value)}>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="대표 전화" id="phone">
                <input id="phone" className={INPUT} value={profile.phone} onChange={(e) => set("phone", e.target.value)} placeholder="02-0000-0000" />
              </Field>
            </div>
            <Field label="홈페이지" id="website">
              <input id="website" className={INPUT} value={profile.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
            </Field>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="업종 및 사업 내용">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {profile.biz_types.map((t) => (
                <span key={t} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>{t}</span>
              ))}
            </div>
            <Field label="주력 업종" id="main-biz">
              <select id="main-biz" className={INPUT} value={profile.main_biz} onChange={(e) => set("main_biz", e.target.value)}>
                {profile.biz_types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="연 매출 (만원)" id="revenue">
                <input id="revenue" type="number" className={INPUT} value={profile.revenue} onChange={(e) => set("revenue", e.target.value)} placeholder="예: 50000" />
              </Field>
              <Field label="상시 근로자 수 (명)" id="employees">
                <input id="employees" type="number" className={INPUT} value={profile.employees} onChange={(e) => set("employees", e.target.value)} placeholder="예: 5" />
              </Field>
            </div>
            <Field label="주요 사업 내용 (제안서 작성 시 활용)" id="description">
              <textarea id="description" rows={10} className={INPUT} style={{ resize: "vertical", lineHeight: 1.7 }}
                value={profile.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </Card>

          <Card title="신청 주체 및 이전 계획 (제안서 자격 검토에 활용)">
            <Field label="글로벌아임 외에 신청할 수 있는 주체" id="alt-applicants">
              <textarea id="alt-applicants" rows={2} className={INPUT} style={{ resize: "vertical" }}
                placeholder="예: 신안산대학교 (평생교육원 명의로 신청 가능)"
                value={profile.alt_applicants} onChange={(e) => set("alt_applicants", e.target.value)} />
            </Field>
            <Field label="사업장 이전 등 예정 사항" id="relocation">
              <textarea id="relocation" rows={2} className={INPUT} style={{ resize: "vertical" }}
                placeholder="예: 2027년 1월 안산시로 사업장 이전 예정"
                value={profile.relocation} onChange={(e) => set("relocation", e.target.value)} />
            </Field>
          </Card>

          <Card title="지원사업 매칭 지역 (중복 선택)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {REGIONS.map((r) => (
                <label key={r} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14, color: "var(--color-text-secondary)" }}>
                  <input type="checkbox" style={{ width: 16, height: 16, accentColor: "#7c3aed" }}
                    checked={profile.target_regions.includes(r)}
                    onChange={(e) => set("target_regions", e.target.checked
                      ? [...profile.target_regions, r]
                      : profile.target_regions.filter((x) => x !== r))} />
                  {r}
                </label>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
