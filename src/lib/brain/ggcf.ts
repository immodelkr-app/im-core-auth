// ============================================================
// 경기문화재단(ggcf.kr) "사업공고(공모지원)" 게시판 수집
// 목록에 진행/종료 상태가 있어 "종료"는 버림. 마감일은 목록에 없음 → 원문 확인.
// ============================================================

import { calculateMatchScore, isStageParticipation, mapRegion, PARTICIPATION_CATEGORY, type MatchProfile, type NoticeRow } from "./notices";
import { SKIP } from "./ansanart";

const LIST = "https://www.ggcf.kr/boards/businessNotices/articles";

function decodeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export type GgcfItem = { id: string; date: string; status: string; badge: string; title: string };

/** 목록 HTML → 항목들. 날짜는 "2026.11.23" → "2026-11-23" */
export function parseGgcfList(html: string): GgcfItem[] {
  const items: GgcfItem[] = [];
  for (const block of html.split('<div class="list">').slice(1)) {
    const id = block.match(/businessNotices\/articles\/(\d+)/)?.[1];
    const title = block.match(/<p class="tit[^"]*">([\s\S]*?)<\/p>/)?.[1];
    const date = block.match(/<span class="date">(\d{4})\.(\d{2})\.(\d{2})/);
    if (!id || !title || !date) continue;
    items.push({
      id,
      date: `${date[1]}-${date[2]}-${date[3]}`,
      status: decodeHtml(block.match(/application-status[^"]*">([^<]*)</)?.[1] ?? ""),
      badge: decodeHtml(block.match(/<span class="badge">([^<]*)<\/span>/)?.[1] ?? ""),
      title: decodeHtml(title),
    });
  }
  return items;
}

export function ggcfToRow(it: GgcfItem, profile: MatchProfile = {}): NoticeRow | null {
  if (it.status === "종료" || SKIP.test(it.title)) return null;
  const org = "경기문화재단";
  const region = (() => { const r = mapRegion("경기", it.title, ""); return r === "전국" ? "경기" : r; })();
  const category = isStageParticipation(it.title) ? PARTICIPATION_CATEGORY : /대관|공간 지원|전시공간/.test(it.title) ? "공간 대관" : it.badge || "문화예술 공모";
  const base = { title: it.title, region, category, org, description: null };
  return {
    source: "ggcf",
    external_id: it.id,
    ...base,
    apply_start: it.date, // 게시일
    deadline: null,
    amount: null,
    target: null,
    url: `${LIST}/${it.id}`,
    match_score: calculateMatchScore(base, true, profile),
    biz_age: null,
    eligible: true,
  };
}

/** 최근 2페이지(약 20건) 중 진행 중인 공모 */
export async function fetchGgcf(profile: MatchProfile = {}): Promise<NoticeRow[]> {
  const rows = new Map<string, NoticeRow>();
  for (const page of [1, 2]) {
    const res = await fetch(`${LIST}?page=${page}`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (imBrain notice collector)" },
    });
    const html = await res.text();
    if (!res.ok || !html.includes("businessNotices/articles/")) {
      throw new Error(`경기문화재단 응답 오류 (HTTP ${res.status})`);
    }
    for (const it of parseGgcfList(html)) {
      const row = ggcfToRow(it, profile);
      if (row) rows.set(row.external_id, row);
    }
  }
  return [...rows.values()];
}
