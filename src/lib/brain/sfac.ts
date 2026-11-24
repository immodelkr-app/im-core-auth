// ============================================================
// 서울문화재단(sfac.or.kr) "공모소식" 게시판(cbIdx=992) 수집
// 목록은 AJAX POST(ListSfac.do)로만 나옴. viewUrl 등 파라미터를 붙이면 빈 응답이라 최소 파라미터만 보냄.
// 진행/마감 상태·마감일이 목록에 없음 → 게시 60일 이내만, 마감일은 원문 확인.
// ============================================================

import { calculateMatchScore, isStageParticipation, mapRegion, PARTICIPATION_CATEGORY, type MatchProfile, type NoticeRow } from "./notices";
import { SKIP } from "./ansanart";

const LIST = "https://www.sfac.or.kr/site/SFAC_KOR/ex/bbs/ListSfac.do";
const VIEW = "https://www.sfac.or.kr/opensquare/notice/support_list.do?cbIdx=992&bcIdx=";

function decodeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export type SfacItem = { id: string; date: string; title: string };

/** 목록 HTML → 항목들. 제목에 이스케이프 안 된 "<우리시각>"이 섞여 있어 </p></dd>까지 통째로 잡음 */
export function parseSfacList(html: string): SfacItem[] {
  const items: SfacItem[] = [];
  for (const block of html.split("<li>").slice(1)) {
    const id = block.match(/doView\('992','(\d+)'/)?.[1];
    const title = block.match(/<dd><p>([\s\S]*?)<\/p><\/dd>/)?.[1];
    const date = block.match(/<dd>(\d{4})\.(\d{2})\.(\d{2})<\/dd>/);
    if (!id || !title || !date) continue;
    items.push({ id, date: `${date[1]}-${date[2]}-${date[3]}`, title: decodeHtml(title) });
  }
  return items;
}

export function sfacToRow(it: SfacItem, profile: MatchProfile = {}): NoticeRow | null {
  if (SKIP.test(it.title)) return null;
  const org = "서울문화재단";
  const region = (() => { const r = mapRegion("서울", it.title, ""); return r === "전국" ? "서울" : r; })();
  const category = isStageParticipation(it.title) ? PARTICIPATION_CATEGORY : /대관|공간 사용|공간 지원/.test(it.title) ? "공간 대관" : "문화예술 공모";
  const base = { title: it.title, region, category, org, description: null };
  return {
    source: "sfac",
    external_id: it.id,
    ...base,
    apply_start: it.date, // 게시일
    deadline: null,
    amount: null,
    target: null,
    url: VIEW + it.id,
    match_score: calculateMatchScore(base, true, profile),
    biz_age: null,
    eligible: true,
  };
}

/** "공고" 카테고리 최근 2페이지(20건) 중 게시 maxAgeDays 이내 */
export async function fetchSfac(profile: MatchProfile = {}, maxAgeDays = 60): Promise<NoticeRow[]> {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString().slice(0, 10);
  const rows = new Map<string, NoticeRow>();
  for (const page of [1, 2]) {
    const res = await fetch(LIST, {
      method: "POST",
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (imBrain notice collector)", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ cbIdx: "992", pageIndex: String(page), cateTypeCd: "25" }),
    });
    const html = await res.text();
    if (!res.ok || !html.includes("board-list--wrap")) {
      throw new Error(`서울문화재단 응답 오류 (HTTP ${res.status})`);
    }
    for (const it of parseSfacList(html)) {
      if (it.date < cutoff) continue;
      const row = sfacToRow(it, profile);
      if (row) rows.set(row.external_id, row);
    }
  }
  return [...rows.values()];
}
