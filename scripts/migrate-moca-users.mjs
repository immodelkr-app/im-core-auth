/**
 * MOCA 앱 회원 일괄 마이그레이션 스크립트
 * ============================================================
 * MOCA 앱(아임모델_스티치)의 Supabase DB에서 전체 회원을 읽어
 * im-core-auth의 /api/auth/sync API를 통해 통합 마스터 계정으로 등록합니다.
 *
 * 실행 방법:
 *   node scripts/migrate-moca-users.mjs
 *
 * 사전 조건:
 *   - im-core-auth 서버가 http://localhost:3000 에서 실행 중이어야 합니다.
 *   - npm run dev 로 서버를 먼저 실행하세요.
 * ============================================================
 */

import { createClient } from "@supabase/supabase-js";

// ── 설정값 ────────────────────────────────────────────────────
const MOCA_SUPABASE_URL     = "https://zlbteyntcolscvsptxzf.supabase.co";
const MOCA_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsYnRleW50Y29sc2N2c3B0eHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDU5NzEsImV4cCI6MjA4NzA4MTk3MX0.V-_7vcM6-XaAtnmDn3gM5sejmNukB_gFaz-dgtg5GPQ";

const IM_CORE_AUTH_URL      = "http://localhost:3000";
const IM_CORE_AUTH_SECRET   = "im-core-auth-secret-2026-immodel";

// ── 요청 간격 (ms) — API 부하 방지 ──────────────────────────
const DELAY_MS = 100;

// ── 유틸 ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizePhone(phone) {
  if (!phone) return null;
  // 숫자만 추출
  const digits = phone.replace(/\D/g, "");
  // 11자리 한국 휴대폰 번호가 아니면 스킵
  if (digits.length !== 11 || !digits.startsWith("010")) return null;
  return digits; // im-core-auth에서 자동 포맷 처리
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  MOCA → IM-CORE-AUTH 회원 마이그레이션 시작");
  console.log("═══════════════════════════════════════════════════\n");

  // 1) MOCA Supabase 연결 (anon key로 users 조회)
  const moca = createClient(MOCA_SUPABASE_URL, MOCA_SUPABASE_ANON_KEY);

  console.log("📡 MOCA DB에서 회원 목록 조회 중...");
  const { data: mocaUsers, error } = await moca
    .from("users")
    .select("id, nickname, name, phone, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ MOCA DB 조회 실패:", error.message);
    process.exit(1);
  }

  console.log(`✅ MOCA 전체 회원 ${mocaUsers.length}명 조회 완료\n`);

  // 2) 통계 초기화
  const result = {
    total: mocaUsers.length,
    success: 0,
    newUser: 0,
    alreadyLinked: 0,
    skipped: 0,   // 전화번호 없거나 형식 이상
    failed: 0,
    errors: [],
  };

  // 3) 각 회원을 순서대로 im-core-auth에 sync
  for (let i = 0; i < mocaUsers.length; i++) {
    const user = mocaUsers[i];
    const phone = normalizePhone(user.phone);
    const progress = `[${String(i + 1).padStart(2, "0")}/${mocaUsers.length}]`;

    if (!phone) {
      console.log(`${progress} ⚠️  SKIP — 전화번호 없음 (nickname: ${user.nickname ?? "없음"})`);
      result.skipped++;
      continue;
    }

    try {
      const res = await fetch(`${IM_CORE_AUTH_URL}/api/auth/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": IM_CORE_AUTH_SECRET,
        },
        body: JSON.stringify({
          phoneNumber: phone,
          appName: "MOCA",
          localUserId: user.id,           // MOCA의 UUID를 로컬 ID로 사용
          name: user.name ?? user.nickname ?? "",
        }),
      });

      const json = await res.json();

      if (json.success) {
        const tag = json.isNewUser ? "🆕 신규" : "🔗 기존";
        console.log(`${progress} ${tag} — ${user.name ?? user.nickname} (${phone}) → masterUserId: ${json.masterUserId}`);
        result.success++;
        if (json.isNewUser) result.newUser++;
        else result.alreadyLinked++;
      } else {
        console.log(`${progress} ❌ 실패 — ${user.name ?? user.nickname} (${phone}): ${json.error}`);
        result.failed++;
        result.errors.push({ user: user.nickname, phone, error: json.error });
      }
    } catch (err) {
      console.log(`${progress} ❌ 네트워크 오류 — ${user.nickname}: ${err.message}`);
      result.failed++;
      result.errors.push({ user: user.nickname, phone, error: err.message });
    }

    // 서버 부하 방지를 위해 요청 간격 유지
    if (i < mocaUsers.length - 1) await sleep(DELAY_MS);
  }

  // 4) 결과 출력
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  마이그레이션 완료 결과");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  전체 MOCA 회원:   ${result.total}명`);
  console.log(`  ✅ 성공:          ${result.success}명`);
  console.log(`    🆕 신규 등록:   ${result.newUser}명`);
  console.log(`    🔗 기존 연동:   ${result.alreadyLinked}명`);
  console.log(`  ⚠️  전화번호 없음: ${result.skipped}명`);
  console.log(`  ❌ 실패:          ${result.failed}명`);

  if (result.errors.length > 0) {
    console.log("\n  실패 목록:");
    result.errors.forEach((e) => {
      console.log(`    - ${e.user} (${e.phone}): ${e.error}`);
    });
  }

  console.log("═══════════════════════════════════════════════════\n");

  if (result.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("예기치 못한 오류:", err);
  process.exit(1);
});
