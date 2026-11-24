// ============================================================
// imBrain 공고 수집 (K-Startup + 안산문화재단) → brain_notices 저장
// 어드민 "최신 공고 수집" 버튼과 매일 자동 수집(cron)이 함께 사용
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchKstartup, type MatchProfile, type NoticeRow } from "./notices";
import { fetchAnsanArt } from "./ansanart";

export type CollectResult = { kstartup: number; ansanart: number; errors: string[] };

export async function collectNotices(supabase: SupabaseClient): Promise<CollectResult> {
  // 매칭 점수는 저장된 사업자 프로필(개업일·탐색 지역·업종) 기준 — 프로필을 바꾸면 다시 수집해야 반영됨
  const { data: profileRow } = await supabase.from("brain_company_profile").select("profile").eq("id", 1).maybeSingle();
  const profile = (profileRow?.profile ?? {}) as MatchProfile;

  const apiKey = process.env.KSTARTUP_API_KEY;
  const [ks, aa] = await Promise.allSettled([
    apiKey ? fetchKstartup(apiKey, profile) : Promise.reject(new Error("KSTARTUP_API_KEY 환경 변수가 설정되지 않았습니다.")),
    fetchAnsanArt(profile),
  ]);

  const errors: string[] = [];
  const rows: NoticeRow[] = [];
  if (ks.status === "fulfilled") rows.push(...ks.value); else errors.push(`K-Startup: ${(ks.reason as Error).message}`);
  if (aa.status === "fulfilled") rows.push(...aa.value); else errors.push(`안산문화재단: ${(aa.reason as Error).message}`);

  if (rows.length > 0) {
    const collected_at = new Date().toISOString();
    const { error } = await supabase
      .from("brain_notices")
      .upsert(rows.map((r) => ({ ...r, collected_at })), { onConflict: "source,external_id" });
    if (error) throw new Error(`저장 실패: ${error.message}`);
  }

  // 안산문화재단 공고는 마감일을 몰라 계속 "상시"로 남으므로, 게시 60일 지나면 정리
  if (aa.status === "fulfilled") {
    const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    await supabase.from("brain_notices").delete().eq("source", "ansanart").lt("apply_start", cutoff);
  }

  return {
    kstartup: ks.status === "fulfilled" ? ks.value.length : 0,
    ansanart: aa.status === "fulfilled" ? aa.value.length : 0,
    errors,
  };
}
