// ============================================================
// 재단 게시판 공고의 마감일 추출
// 목록에는 마감일이 없어서 제목·본문의 "접수기간 : 2026. 9. 23.(수) ~ 10. 6.(화)" 같은 글에서 끝 날짜를 읽음.
// 첨부파일(hwp/pdf)에만 적힌 공고는 못 읽음 → null(원문 확인) 유지.
// ============================================================

import type { NoticeRow } from "./notices";

// "공모를 진행합니다 … 사업수행기간 ~ 11.30" 같은 오탐을 막으려고 기간/일정 등이 붙은 표시만 인정
const LABEL = /(?:(?:접수|신청|모집|공모|제출)\s*(?:기간|일정|기한|마감)|접수\s*[:：]|공고일)\s*[:：]?/g;
const FULL = /(\d{4})\s*[.년\-]\s*(\d{1,2})\s*[.월\-]\s*(\d{1,2})/;
const MONTH_DAY = /(?<!\d)(\d{1,2})\s*[.월]\s*(\d{1,2})(?!\d)\s*(?:일|\.|\(|\s|까지|$)/;

/** HTML → 한 줄 텍스트 */
export function htmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** "~" 뒤(또는 "까지" 앞) 조각에서 첫 날짜. 연도 없으면 게시일 기준으로 추정(게시일보다 앞이면 다음 해) */
function parseDate(s: string, posted: string): string | null {
  const full = s.match(FULL);
  const md = s.match(MONTH_DAY);
  // 둘 다 있으면 앞에 나온 쪽
  const useFull = full && (!md || full.index! <= md.index!);
  let y = Number(posted.slice(0, 4)), m: number, d: number;
  if (useFull) [y, m, d] = [Number(full[1]), Number(full[2]), Number(full[3])];
  else if (md) [m, d] = [Number(md[1]), Number(md[2])];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  let iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (!useFull && iso < posted) iso = `${y + 1}${iso.slice(4)}`;
  return iso;
}

/** 범위 "A ~ B"면 B, 없으면 "…까지/마감" 앞 날짜 */
function endOf(chunk: string, posted: string): string | null {
  const tilde = chunk.search(/[~∼〜]/);
  if (tilde >= 0) return parseDate(chunk.slice(tilde + 1, tilde + 45), posted);
  const until = chunk.search(/까지|마감/);
  return until > 0 ? parseDate(chunk.slice(Math.max(0, until - 30), until + 2), posted) : null;
}

/** 제목 → 본문 순서로 첫 번째로 읽히는 마감일. 게시일~1년 범위 밖이면 버림 */
export function extractDeadline(title: string, body: string, posted: string): string | null {
  const ok = (d: string | null) => d !== null && d >= posted && d <= `${Number(posted.slice(0, 4)) + 1}${posted.slice(4)}`;

  // 제목: "(~9월28일까지)", "(01.20.~02.10.)" 같은 괄호
  for (const paren of title.match(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g) ?? []) {
    const d = endOf(paren, posted);
    if (ok(d)) return d;
  }
  for (const m of body.matchAll(LABEL)) {
    const d = endOf(body.slice(m.index! + m[0].length, m.index! + m[0].length + 90), posted);
    if (ok(d)) return d;
  }
  return null;
}

/** 게시판 행들의 상세 본문을 받아 deadline 채움. 한 건 실패해도 나머지는 진행 */
export async function fillDeadlines(rows: NoticeRow[], fetchBody: (row: NoticeRow) => Promise<string>): Promise<NoticeRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      const posted = row.apply_start ?? "";
      let deadline = extractDeadline(row.title, "", posted);
      if (!deadline) {
        try { deadline = extractDeadline(row.title, htmlText(await fetchBody(row)), posted); } catch { /* 원문 확인 유지 */ }
      }
      return { ...row, deadline };
    }),
  );
}

export const DETAIL_INIT = { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (imBrain notice collector)" } } as const;
/** 상세 페이지 GET (사이트 하나가 느려도 cron 60초 안에 끝나도록 8초 제한) */
export const getText = async (url: string, init: RequestInit = {}) =>
  (await fetch(url, { ...DETAIL_INIT, ...init, signal: AbortSignal.timeout(8000) })).text();
