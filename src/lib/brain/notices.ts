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
};

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

/** 글로벌아임 맞춤 매칭 점수 (기존 imBrain 로직 그대로) */
export function calculateMatchScore(title: string, region: string, category: string, org = "", description = ""): number {
  let score = 65;
  const t = `${title} ${org} ${description}`.toLowerCase();

  // 핵심 거점 지역 (용인: 경희대 국제캠퍼스, 안산: 신안산대)
  if (region === "용인" || t.includes("용인")) score += 18;
  else if (region === "안산" || t.includes("안산")) score += 18;
  else if (region === "수원" || t.includes("수원")) score += 16;
  else if (region === "서울" || t.includes("서울")) score += 15;
  else if (region === "경기" || t.includes("경기")) score += 10;
  else if (region === "전국") score += 8;

  if (/행사|문화|공연/.test(category)) score += 10;
  else if (/판로|홍보|마케팅|사업화|디지털/.test(category)) score += 8;

  const keywords = ["모델", "패션", "뷰티", "공연", "행사", "축제", "청년", "시니어",
    "평생교육", "산학", "대학", "커뮤니티", "라이브커머스", "캐스팅", "전시", "대관"];
  score += Math.min(keywords.filter((k) => t.includes(k)).length * 3, 12);

  return Math.min(score, 99);
}

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
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

export function kstartupToRow(c: Record<string, string>): NoticeRow | null {
  const title = c.biz_pbanc_nm || c.intg_pbanc_biz_nm;
  if (!c.pbanc_sn || !title) return null; // 번호 없는 공고는 중복 판정이 안 되므로 버림
  const org = c.pbanc_ntrp_nm || c.sprv_inst || c.biz_prch_dprt_nm || "창업진흥원";
  const region = mapRegion(c.supt_regin ?? "", title, org);
  const category = c.supt_biz_clsfc || "기타";
  const description = c.pbanc_ctnt || null;
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
    match_score: calculateMatchScore(title, region, category, org, description ?? ""),
  };
}

/** K-Startup 모집중 공고 전체 수집 */
export async function fetchKstartup(apiKey: string): Promise<NoticeRow[]> {
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
      const row = kstartupToRow(c);
      if (row) rows.set(row.external_id, row);
    }
    if (items.length < perPage) break;
  }
  return [...rows.values()];
}
