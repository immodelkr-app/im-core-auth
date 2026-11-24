// ============================================================
// 안산문화재단(ansanart.com) "공고사항" 게시판 수집
// 게시판 HTML 목록에서 제목·작성일·링크를 읽음 (본문은 이미지인 경우가 많아 마감일은 알 수 없음)
// ============================================================

import { calculateMatchScore, isStageParticipation, PARTICIPATION_CATEGORY, type MatchProfile, type NoticeRow } from "./notices";

const BASE = "https://www.ansanart.com/lay1/bbs/S1T84C86/A/15";

// 공모·모집 자체가 아닌 사후 공지(결과 발표 등)와 소액 행정 공고는 제외
const SKIP = /결과|선정|발표|합격|취소|연기|변경|정정|안내문|채용|직원|견적|수의계약|평가위원|서포터즈|자원활동/;
export function ansanArtCategory(title: string): string {
  if (/대관/.test(title)) return "공간 대관";
  if (isStageParticipation(title)) return PARTICIPATION_CATEGORY;
  if (/입찰|용역/.test(title)) return "행사 용역 입찰";
  return "문화예술 공모";
}

/** 공고사항 목록 HTML → { seq, title, date } */
export function parseAnsanArtList(html: string): { seq: string; title: string; date: string }[] {
  const rows: { seq: string; title: string; date: string }[] = [];
  for (const tr of html.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const seq = tr.match(/view\.do\?article_seq=(\d+)/)?.[1];
    const a = tr.match(/<a href="view\.do\?article_seq=\d+[^"]*">([\s\S]*?)<\/a>/)?.[1];
    const date = tr.match(/<b>작성일<\/b>\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!seq || !a || !date) continue;
    const title = a
      .replace(/<span class="m_cat">[\s\S]*?<\/span>/, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (title) rows.push({ seq, title, date });
  }
  return rows;
}

export function ansanArtToRow(r: { seq: string; title: string; date: string }, profile: MatchProfile = {}): NoticeRow | null {
  if (SKIP.test(r.title)) return null;
  const category = ansanArtCategory(r.title);
  const base = { title: r.title, region: "안산", category, org: "안산문화재단", description: null };
  return {
    source: "ansanart",
    external_id: r.seq,
    ...base,
    apply_start: r.date, // 게시일 (접수 시작일이 아님)
    deadline: null, // 목록에 마감일이 없음 → 원문 확인 필요
    amount: null,
    target: null,
    url: `${BASE}/view.do?article_seq=${r.seq}`,
    match_score: calculateMatchScore(base, true, profile),
    biz_age: null,
    eligible: true,
  };
}

/** 최근 maxAgeDays 일 안에 올라온 공고만 */
export async function fetchAnsanArt(profile: MatchProfile = {}, maxAgeDays = 60): Promise<NoticeRow[]> {
  const res = await fetch(`${BASE}/list.do?rows=30&cpage=1`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (imBrain notice collector)" },
  });
  const html = await res.text();
  if (!res.ok || !html.includes("article_seq")) {
    throw new Error(`안산문화재단 응답 오류 (HTTP ${res.status})`);
  }
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString().slice(0, 10);
  return parseAnsanArtList(html)
    .filter((r) => r.date >= cutoff)
    .map((r) => ansanArtToRow(r, profile))
    .filter((r): r is NoticeRow => r !== null);
}
