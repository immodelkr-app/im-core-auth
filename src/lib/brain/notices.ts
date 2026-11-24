// ============================================================
// imBrain 지원사업 공고 수집 (서버 전용: API 키를 브라우저에 노출하지 않음)
// 기존 im_brain/src/services/noticeCollector.js 에서 이전.
// ============================================================

export type NoticeRow = {
  source: string;
  external_id: string;
  title: string;
  org: string | null;
  region: string;
  category: string;
  apply_start: string | null;
  deadline: string | null;
  amount: string | null;
  target: string | null;
  url: string | null;
  description: string | null;
  match_score: number;
  biz_age: string | null; // K-Startup 업력 조건 원문 (예: "1년미만,3년미만,7년미만")
  eligible: boolean | null; // 업력 조건 충족 여부 (개업일 모를 땐 null)
};

/** 점수 계산에 쓰는 사업자 프로필 일부 (brain_company_profile.profile) */
export type MatchProfile = {
  founded?: string; // "2018-07-09"
  target_regions?: string[];
  biz_types?: string[];
};

// 업력 7~10년 서비스·커머스 기업 기준 분야 가중치 (행사·창업교육은 실익이 적어 감점)
const CATEGORY_WEIGHT: [RegExp, number][] = [
  [/사업화|판로|해외|글로벌/, 15],
  [/정책자금|융자|보증/, 10],
  [/인력/, 8],
  [/R&D|기술개발/, 5],
  [/멘토링|컨설팅/, 3],
  [/행사|네트워크|창업교육/, -10],
];

// 글로벌아임 사업과 관련된 단어 (프로필 업종과 함께 제목·내용에서 찾음)
const DOMAIN_KEYWORDS = ["모델", "패션", "뷰티", "공연", "문화", "예술", "콘텐츠", "커머스", "라이브",
  "시니어", "중장년", "평생교육", "산학", "축제", "전시", "대관", "엔터"];

/** "20261204" → "2026-12-04" */
export function formatDate(s: string | undefined): string | null {
  const d = (s ?? "").replace(/[^0-9]/g, "");
  return d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null;
}

/** 제목·기관에 시/군 이름이 있으면 그걸 우선 (K-Startup 지역은 '경기' 같은 광역 단위라서) */
export function mapRegion(area: string, title: string, org: string): string {
  const text = `${title} ${org} ${area}`;
  for (const r of ["용인", "수원", "안산", "인천", "서울", "경기"]) {
    if (text.includes(r)) return r;
  }
  return "전국";
}

/** 개업일 기준 업력(년, 소수). 개업일 없으면 null */
export function businessYears(founded: string | undefined, today = new Date()): number | null {
  if (!founded) return null;
  const t = new Date(founded).getTime();
  return Number.isNaN(t) ? null : (today.getTime() - t) / (365.25 * 86400000);
}

/**
 * 업력 조건 충족 여부. bizAge 예: "예비창업자,1년미만,3년미만,7년미만"
 * 조건이 없으면 true, 개업일을 모르면 null.
 */
export function isAgeEligible(bizAge: string | null, years: number | null): boolean | null {
  if (!bizAge?.trim()) return true;
  if (years === null) return null;
  const limits = [...bizAge.matchAll(/(\d+)\s*년\s*미만/g)].map((m) => Number(m[1]));
  if (limits.length === 0) return false; // "예비창업자"만 → 이미 창업한 기업은 대상 아님
  return years < Math.max(...limits);
}

/** 사업자 프로필 기준 매칭 점수 0~99. 업력 미충족이면 최대 20점 */
export function calculateMatchScore(
  n: { title: string; region: string; category: string; org?: string | null; description?: string | null },
  eligible: boolean | null,
  profile: MatchProfile,
): number {
  let score = 50;
  const text = `${n.title} ${n.org ?? ""} ${n.description ?? ""}`;

  const targets = profile.target_regions ?? [];
  if (n.region === "전국") score += 10;
  else if (targets.includes(n.region)) score += ["용인", "안산", "수원"].includes(n.region) ? 20 : 15;
  else if (targets.length > 0) score -= 15; // 탐색 지역 밖 지자체 공고

  score += CATEGORY_WEIGHT.find(([re]) => re.test(n.category))?.[1] ?? 0;

  const keywords = [...DOMAIN_KEYWORDS, ...(profile.biz_types ?? []).flatMap((b) => b.split(/[/\s및]+/))]
    .filter((k) => k.length >= 2);
  score += Math.min(new Set(keywords.filter((k) => text.includes(k))).size * 4, 16);

  score = Math.max(0, Math.min(score, 99));
  return eligible === false ? Math.min(score, 20) : score;
}

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&(amp;)+/g, "&") // 원본이 이중 인코딩된 경우도 있음 ("R&amp;amp;D")
    .replace(/\r\n?/g, "\n")
    .trim();
}

/** K-Startup <item><col name="x">v</col>...</item> → { x: v } */
export function parseKstartupItems(xml: string): Record<string, string>[] {
  return (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).map((item) => {
    const cols: Record<string, string> = {};
    for (const m of item.matchAll(/<col name="([^"]+)">([\s\S]*?)<\/col>/g)) cols[m[1]] = decodeXml(m[2]);
    return cols;
  });
}

export function kstartupToRow(c: Record<string, string>, profile: MatchProfile = {}): NoticeRow | null {
  const title = c.biz_pbanc_nm || c.intg_pbanc_biz_nm;
  if (!c.pbanc_sn || !title) return null; // 번호 없는 공고는 중복 판정이 안 되므로 버림
  const org = c.pbanc_ntrp_nm || c.sprv_inst || c.biz_prch_dprt_nm || "창업진흥원";
  const region = mapRegion(c.supt_regin ?? "", title, org);
  const category = c.supt_biz_clsfc || "기타";
  const description = c.pbanc_ctnt || null;
  const biz_age = c.biz_enyy?.trim() || null;
  const eligible = isAgeEligible(biz_age, businessYears(profile.founded));
  return {
    source: "kstartup",
    external_id: c.pbanc_sn,
    title,
    org,
    region,
    category,
    apply_start: formatDate(c.pbanc_rcpt_bgng_dt),
    deadline: formatDate(c.pbanc_rcpt_end_dt),
    amount: null, // K-Startup 목록 API에는 지원금액 항목이 없음
    target: c.aply_trgt_ctnt || c.aply_trgt || null,
    url: c.detl_pg_url || "https://www.k-startup.go.kr",
    description,
    match_score: calculateMatchScore({ title, region, category, org, description }, eligible, profile),
    biz_age,
    eligible,
  };
}

/** K-Startup 모집중 공고 전체 수집 (profile 로 업력·지역·업종 매칭 점수 계산) */
export async function fetchKstartup(apiKey: string, profile: MatchProfile = {}): Promise<NoticeRow[]> {
  // 같은 공고 번호가 두 번 오면 upsert 한 번에 같은 행을 두 번 수정하게 되어 DB 오류 → Map으로 중복 제거
  const rows = new Map<string, NoticeRow>();
  const perPage = 500;
  // shortcut: 최대 5페이지(2,500건)까지만, 모집중 공고가 그보다 많아지면 늘릴 것
  for (let page = 1; page <= 5; page++) {
    const url = `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01`
      + `?serviceKey=${apiKey}&page=${page}&perPage=${perPage}&cond[rcrt_prgs_yn::EQ]=Y`;
    const res = await fetch(url, { cache: "no-store" });
    const xml = await res.text();
    if (!res.ok || !xml.includes("<results>")) {
      throw new Error(`K-Startup 응답 오류 (HTTP ${res.status}): ${xml.slice(0, 120)}`);
    }
    const items = parseKstartupItems(xml);
    for (const c of items) {
      const row = kstartupToRow(c, profile);
      if (row) rows.set(row.external_id, row);
    }
    if (items.length < perPage) break;
  }
  return [...rows.values()];
}
