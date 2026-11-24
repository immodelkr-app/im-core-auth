// ============================================================
// 안산 신규 공고 문자 알림 (쏠라피 SMS/LMS)
// 아임모델 앱(supabase/functions/aligo-send)과 같은 쏠라피 계정·발신번호 사용
// ============================================================

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 이 점수 이상인 안산 공고만 알림 */
export const ALERT_MIN_SCORE = 75;
const MAX_LISTED = 5;

function solapiAuthHeader(apiKey: string, secret: string): string {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", secret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendSms(phones: string[], text: string): Promise<void> {
  const { SOLAPI_API_KEY, SOLAPI_SECRET_KEY, SOLAPI_SENDER } = process.env;
  if (!SOLAPI_API_KEY || !SOLAPI_SECRET_KEY || !SOLAPI_SENDER) {
    throw new Error("SOLAPI_API_KEY / SOLAPI_SECRET_KEY / SOLAPI_SENDER 환경 변수가 필요합니다.");
  }
  const res = await fetch("https://api.solapi.com/messages/v4/send-many", {
    method: "POST",
    headers: { Authorization: solapiAuthHeader(SOLAPI_API_KEY, SOLAPI_SECRET_KEY), "Content-Type": "application/json" },
    // 90바이트 넘으면 쏠라피가 자동으로 LMS로 보냄
    body: JSON.stringify({ messages: phones.map((to) => ({ to, from: SOLAPI_SENDER.replace(/-/g, ""), text })) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errorCode) {
    throw new Error(`쏠라피 발송 실패: ${data.errorMessage ?? `HTTP ${res.status}`}`);
  }
}

/** 받는 번호 목록 (BRAIN_ALERT_PHONES="01012345678,01098765432") */
export function alertPhones(): string[] {
  return (process.env.BRAIN_ALERT_PHONES ?? "")
    .split(",")
    .map((p) => p.replace(/[^0-9]/g, ""))
    .filter((p) => /^01\d{8,9}$/.test(p));
}

type AlertNotice = { id: string; title: string; org: string | null; deadline: string | null; match_score: number; url: string | null };

export function buildAlertText(notices: AlertNotice[]): string {
  const lines = [`[imBrain] 안산 지원사업 새 공고 ${notices.length}건`, ""];
  notices.slice(0, MAX_LISTED).forEach((n, i) => {
    lines.push(`${i + 1}. ${n.title}`);
    lines.push(`   ${n.org ?? ""} · 매칭 ${n.match_score} · 마감 ${n.deadline ?? "원문 확인"}`);
    if (n.url) lines.push(`   ${n.url}`);
  });
  if (notices.length > MAX_LISTED) lines.push("", `외 ${notices.length - MAX_LISTED}건은 어드민에서 확인하세요.`);
  return lines.join("\n");
}

/**
 * 아직 알리지 않은 안산 고득점 공고를 한 통의 문자로 보내고 notified_at 기록.
 * 발송이 실패하면 기록하지 않으므로 다음 실행 때 다시 시도됨.
 */
export async function sendAnsanAlerts(supabase: SupabaseClient): Promise<{ sent: number; skipped?: string }> {
  const phones = alertPhones();
  if (phones.length === 0) return { sent: 0, skipped: "BRAIN_ALERT_PHONES 미설정" };

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const { data, error } = await supabase
    .from("brain_notices")
    .select("id, title, org, deadline, match_score, url")
    .eq("region", "안산")
    .gte("match_score", ALERT_MIN_SCORE)
    .not("eligible", "is", false)
    .is("notified_at", null)
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order("match_score", { ascending: false });
  if (error) throw new Error(`알림 대상 조회 실패: ${error.message}`);
  if (!data || data.length === 0) return { sent: 0 };

  await sendSms(phones, buildAlertText(data));

  const { error: markError } = await supabase
    .from("brain_notices")
    .update({ notified_at: new Date().toISOString() })
    .in("id", data.map((n) => n.id));
  if (markError) throw new Error(`발송은 됐지만 기록 실패 (다음 실행 때 중복 발송될 수 있음): ${markError.message}`);

  return { sent: data.length };
}
