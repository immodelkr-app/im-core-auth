// ============================================================
// 수원문화재단(swcf.or.kr) "지원사업 공고" 게시판(?p=95) 수집
// 목록 제목이 "..."로 잘려 나옴 → 게시 60일 이내로 남은 몇 건만 상세 페이지에서 전체 제목을 가져옴.
// 마감일은 원문 확인. ("재단소식" ?p=113 은 공연·운영 안내 위주라 제외)
// ============================================================

import { calculateMatchScore, isStageParticipation, mapRegion, PARTICIPATION_CATEGORY, type MatchProfile, type NoticeRow } from "./notices";
import { SKIP } from "./ansanart";

const BASE = "https://www.swcf.or.kr/?p=95";
const UA = { "User-Agent": "Mozilla/5.0 (imBrain notice collector)" };

function decodeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export type SwcfItem = { id: string; date: string; title: string };

export function parseSwcfList(html: string): SwcfItem[] {
  const items: SwcfItem[] = [];
  for (const row of html.split("<tr>").slice(1)) {
    const m = row.match(/viewMode=view&amp;idx=(\d+)">([^<]*)<\/a>/);
    const date = row.match(/>(\d{4}-\d{2}-\d{2})<\/td>/)?.[1];
    if (!m || !date) continue;
    items.push({ id: m[1], date, title: decodeHtml(m[2]) });
  }
  return items;
}

/** 상세 페이지의 전체 제목. 실패하면 잘린 제목 그대로 */
async function fullTitle(it: SwcfItem): Promise<string> {
  if (!it.title.endsWith("...")) return it.title;
  try {
    const html = await (await fetch(`${BASE}&viewMode=view&idx=${it.id}`, { cache: "no-store", headers: UA })).text();
    const t = html.match(/<div class="b_view_subject">([\s\S]*?)<\/div>/)?.[1];
    return t ? decodeHtml(t) : it.title;
  } catch {
    return it.title;
  }
}

export function swcfToRow(it: SwcfItem, profile: MatchProfile = {}): NoticeRow | null {
  if (SKIP.test(it.title)) return null;
  const org = "수원문화재단";
  const region = (() => { const r = mapRegion("경기", it.title, ""); return r === "전국" ? "경기" : r; })();
  const category = isStageParticipation(it.title) ? PARTICIPATION_CATEGORY : /대관/.test(it.title) ? "공간 대관" : "문화예술 공모";
  const base = { title: it.title, region, category, org, description: null };
  return {
    source: "swcf",
    external_id: it.id,
    ...base,
    apply_start: it.date, // 게시일
    deadline: null,
    amount: null,
    target: null,
    url: `${BASE}&viewMode=view&idx=${it.id}`,
    match_score: calculateMatchScore(base, true, profile),
    biz_age: null,
    eligible: true,
  };
}

/** 최근 2페이지 중 게시 maxAgeDays 이내 공모 */
export async function fetchSwcf(profile: MatchProfile = {}, maxAgeDays = 60): Promise<NoticeRow[]> {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString().slice(0, 10);
  const recent = new Map<string, SwcfItem>();
  for (const page of [1, 2]) {
    const res = await fetch(`${BASE}&page=${page}`, { cache: "no-store", headers: UA });
    const html = await res.text();
    if (!res.ok || !html.includes("viewMode=view&amp;idx=")) {
      throw new Error(`수원문화재단 응답 오류 (HTTP ${res.status})`);
    }
    for (const it of parseSwcfList(html)) {
      // 잘린 제목에도 "선정"·"결과"가 보이면 상세 요청 없이 버림
      if (it.date >= cutoff && !SKIP.test(it.title)) recent.set(it.id, it);
    }
  }
  const rows = await Promise.all([...recent.values()].map(async (it) => swcfToRow({ ...it, title: await fullTitle(it) }, profile)));
  return rows.filter((r): r is NoticeRow => r !== null);
}
