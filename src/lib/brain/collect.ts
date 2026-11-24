// ============================================================
// imBrain 공고 수집 (K-Startup + 안산·경기·서울·용인문화재단) → brain_notices 저장
// 어드민 "최신 공고 수집" 버튼과 매일 자동 수집(cron)이 함께 사용
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchKstartup, type MatchProfile, type NoticeRow } from "./notices";
import { fetchAnsanArt } from "./ansanart";
import { fetchGgcf } from "./ggcf";
import { fetchSfac } from "./sfac";
import { fetchYicf } from "./yicf";

export type CollectResult = { kstartup: number; ansanart: number; ggcf: number; sfac: number; yicf: number; errors: string[] };

// 마감일을 몰라 계속 "원문 확인"으로 남는 게시판 공고 → 게시 60일 지나면 정리
const BOARD_SOURCES = ["ansanart", "ggcf", "sfac", "yicf"];

export async function collectNotices(supabase: SupabaseClient): Promise<CollectResult> {
  // 매칭 점수는 저장된 사업자 프로필(개업일·탐색 지역·업종) 기준 — 프로필을 바꾸면 다시 수집해야 반영됨
  const { data: profileRow } = await supabase.from("brain_company_profile").select("profile").eq("id", 1).maybeSingle();
  const profile = (profileRow?.profile ?? {}) as MatchProfile;

  const apiKey = process.env.KSTARTUP_API_KEY;
  const [ks, aa, gg, sf, yi] = await Promise.allSettled([
    apiKey ? fetchKstartup(apiKey, profile) : Promise.reject(new Error("KSTARTUP_API_KEY 환경 변수가 설정되지 않았습니다.")),
    fetchAnsanArt(profile),
    fetchGgcf(profile),
    fetchSfac(profile),
    fetchYicf(profile),
  ]);

  const errors: string[] = [];
  const rows: NoticeRow[] = [];
  const take = (r: PromiseSettledResult<NoticeRow[]>, name: string) => {
    if (r.status === "fulfilled") rows.push(...r.value);
    else errors.push(`${name}: ${(r.reason as Error).message}`);
    return r.status === "fulfilled" ? r.value.length : 0;
  };
  const counts = { kstartup: take(ks, "K-Startup"), ansanart: take(aa, "안산문화재단"), ggcf: take(gg, "경기문화재단"), sfac: take(sf, "서울문화재단"), yicf: take(yi, "용인문화재단") };

  if (rows.length > 0) {
    const collected_at = new Date().toISOString();
    const { error } = await supabase
      .from("brain_notices")
      .upsert(rows.map((r) => ({ ...r, collected_at })), { onConflict: "source,external_id" });
    if (error) throw new Error(`저장 실패: ${error.message}`);
  }

  const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  await supabase.from("brain_notices").delete().in("source", BOARD_SOURCES).lt("apply_start", cutoff);

  return { ...counts, errors };
}
