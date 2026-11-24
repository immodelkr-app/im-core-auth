// ============================================================
// 용인문화재단(yicf.or.kr) "알림·공지" 게시판(bbsId=notice_main) 수집
// 공모·모집 글이 일반 공지와 섞여 있음 → 게시 60일 이내 + SKIP 제외. 마감일은 원문 확인.
// ("공고·입찰" 메뉴는 조달 입찰 위주라 제외)
// ============================================================

import { calculateMatchScore, isStageParticipation, mapRegion, PARTICIPATION_CATEGORY, type MatchProfile, type NoticeRow } from "./notices";
import { SKIP } from "./ansanart";

const BASE = "https://www.yicf.or.kr/main/cop/bbs";
const MENU = "&menuNo=050000&subMenuNo=050100&thirdMenuNo=050101";

function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export type YicfItem = { id: string; date: string; title: string };

/** 목록 HTML → 항목들. 제목 앞 "[<b>공연</b>]" 말머리는 그대로 둠(분류 단서) */
export function parseYicfList(html: string): YicfItem[] {
  const items: YicfItem[] = [];
  for (const row of html.split("<tr>").slice(1)) {
    const m = row.match(/fn_inqire_notice\('(\d+)','notice_main'\)[^>]*>([\s\S]*?)<\/a>/);
    const date = row.match(/(\d{4}-\d{2}-\d{2})<\/td>/)?.[1];
    if (!m || !date) continue;
    items.push({ id: m[1], date, title: decodeHtml(m[2]) });
  }
  return items;
}

export function yicfToRow(it: YicfItem, profile: MatchProfile = {}): NoticeRow | null {
  if (SKIP.test(it.title) || !/모집|공모|공고|신청|접수|대관|참가|참여/.test(it.title)) return null;
  const org = "용인문화재단";
  const region = (() => { const r = mapRegion("경기", it.title, ""); return r === "전국" ? "경기" : r; })();
  const category = isStageParticipation(it.title) ? PARTICIPATION_CATEGORY : /대관/.test(it.title) ? "공간 대관" : "문화예술 공모";
  const base = { title: it.title, region, category, org, description: null };
  return {
    source: "yicf",
    external_id: it.id,
    ...base,
    apply_start: it.date, // 게시일
    deadline: null,
    amount: null,
    target: null,
    url: `${BASE}/selectBoardArticle.do?bbsId=notice_main&nttId=${it.id}${MENU}`,
    match_score: calculateMatchScore(base, true, profile),
    biz_age: null,
    eligible: true,
  };
}

/** 최근 2페이지 중 게시 maxAgeDays 이내 공모·모집 글 (상단 고정 공지는 날짜로 걸러짐) */
export async function fetchYicf(profile: MatchProfile = {}, maxAgeDays = 60): Promise<NoticeRow[]> {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString().slice(0, 10);
  const rows = new Map<string, NoticeRow>();
  for (const page of [1, 2]) {
    const res = await fetch(`${BASE}/selectBoardList.do?bbsId=notice_main&pageIndex=${page}${MENU}`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (imBrain notice collector)" },
    });
    const html = await res.text();
    if (!res.ok || !html.includes("fn_inqire_notice(")) {
      throw new Error(`용인문화재단 응답 오류 (HTTP ${res.status})`);
    }
    for (const it of parseYicfList(html)) {
      if (it.date < cutoff) continue;
      const row = yicfToRow(it, profile);
      if (row) rows.set(row.external_id, row);
    }
  }
  return [...rows.values()];
}
