/**
 * IMFF 앱 회원 일괄 마이그레이션 스크립트
 * ============================================================
 * IMFF 앱(Firebase/Firestore)의 users 컬렉션에서 전체 회원을 읽어
 * im-core-auth의 /api/auth/sync API를 통해 통합 마스터 계정으로 등록합니다.
 *
 * 실행 방법:
 *   node scripts/migrate-imff-users.mjs
 *
 * 사전 조건:
 *   - firebase-admin 패키지가 설치되어 있어야 합니다.
 *     (npm install firebase-admin --save-dev)
 * ============================================================
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore }        from "firebase-admin/firestore";

// ── Firebase Admin 설정 ────────────────────────────────────
const FIREBASE_PROJECT_ID    = "imff-platform";
const FIREBASE_CLIENT_EMAIL  = "firebase-adminsdk-fbsvc@imff-platform.iam.gserviceaccount.com";
// 줄바꿈 이스케이프 처리
const FIREBASE_PRIVATE_KEY   = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDc4GKGrC8iz1Eo
FzI9vceaTpiDgqBT5JOeUFPYX2L6rM/oImTMhNE4KuNIh8v1GnV33HLGP5Bmtjuh
oly0l/BNyO9NxAKEZUNk7T52tq96haxNiSK0wXJ47fud760+z1CysVPM5aimGjri
3GXwIwPItoo3ppYaJfqpGyXbtExztLotW24fxFEBaBXhzgzffg74ZAsq+Kx15OaJ
Qj7+T9L7A9HDRWg0cWRPDJj8UhExTvJNcoYy5TjgGF8+gF3wc8p6V0Sdy0+A0Guj
eEEvtNShEjo9MPyheLqDMB2yiFC6Frvt+5ylkpWipc88gQ1bempO3HLDDOqOrmGr
ZB75qIMpAgMBAAECggEABjmZ4UPd9g170wUjV0+KKM3KroMqalmJ9QdnHjUjAfUH
94SCTNbN8DcE4z+LhqJazu3dkLuMIe7vIOPa7cPjTofpbFVIFmE7EY+Tp/lyWjdF
UcVEidhdYJiMHmmEZhL7n4ulSgQreSyfqKg6RGwyNZBlIRgkHm4gAZnYUBgQOF8L
9lXnqE2xzuUCAFfcqigtNc6OYHRX/Nz9QFHXoVrD1KdUhYulCoggxqv5UwsN1FGh
Rkx5iwwr0M3+i7cnXkMdhDjATf4UT9vW0SPpOHfcOz1uN769/EFnBG7F8JkrZf98
Q4DmcAVRDFbY2kiiUUUlJBU0gcHr90h+PLnNQmd80QKBgQDywNmZwYa6JLJCQM11
BuXSsXKgfP/Cvr0F3IhtrhhiyJWq8ZMNBkrUFW9RwSV7PMNLUgyiEq5KW+HNQ+KA
eZ+jVtwOCzrLV27aOXh3YE64ikRX2xgLAgrIPA0+6xS9ECROaa/ncSzJU5dyWOqy
qfQ0mEvQonTOXQ9Yfxn1OSsH0QKBgQDo7e0OEmmIe0nUzffU1U6+b7ZXhb3yV+9a
d5JCkYds29i0eVnNRo4xivSLeNJi6QqkpDf8BQrY1DM90Fy5GV5PXeMf+FSQb7Mf
D3NBcclUyp2EzcidxSTsk+RTyusr98OOaC16ZDhIEY4o/P/JNhymPH889dQiJfkT
qiryC+xz2QKBgFCE2yh+4ptXlLEZIY0RrqWGKklFbOhBsB0Dm1UWDAyoD8zVuDr3
vVY/jd8GO9J2wyh2nK4dmCYd9/XH8JdAwEzDgNY/r07HP4Ou0GB4V2QqqKSjjYQJ
N15XXOVjwEs90W0Y7TnNdleJHJDXIXIFoXTYlz0qxae1gmOONSP7xGQhAoGABb1v
PQyJGzrmi97zf4QuJ5U7Khb6olE2bcVKjmdlrfIQ+gmPg/Z8JI5nDlTQ4m0ZvQrq
8kPxi3xXMuvCjTEp2MzYfv4wn0qRYG+SCIfUTUmc7hvgGLs1+LqAQuxaNUAqyoSY
sk5r8KK2HR528y9pL1OIUyk/rAPBipGD82kFz6kCgYEAuACJxQwvOE0o3+W9I51d
xBpnalkPpvJC4FmJp4MCdNYMCjfxSpyX08tyI/sAItmKK91LaFsHUueulI+L5uj0
gdOkni/N8UnnrAdlKXRdQ1AomwpdTUjiUiG+UF9s8VdNVB7YWXIrjUXZg8NuoPaS
h2rwT5u8MKopjqvQL2KOAgg=
-----END PRIVATE KEY-----
`;

// ── im-core-auth 설정 ─────────────────────────────────────
const IM_CORE_AUTH_URL    = "https://im-core-auth.vercel.app";
const IM_CORE_AUTH_SECRET = "im-core-auth-secret-2026-immodel";

// ── 요청 간격 (ms) — API 부하 방지 ───────────────────────
const DELAY_MS = 150;

// ── 유틸 ─────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // 11자리 한국 휴대폰 번호(010 시작)만 허용
  if (digits.length !== 11 || !digits.startsWith("010")) return null;
  return digits;
}

// ── 메인 ─────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  IMFF → IM-CORE-AUTH 회원 마이그레이션 시작");
  console.log("═══════════════════════════════════════════════════\n");

  // 1) Firebase Admin 초기화
  initializeApp({
    credential: cert({
      projectId:    FIREBASE_PROJECT_ID,
      clientEmail:  FIREBASE_CLIENT_EMAIL,
      privateKey:   FIREBASE_PRIVATE_KEY,
    }),
  });

  const db = getFirestore();

  console.log("📡 IMFF Firestore에서 users 컬렉션 조회 중...");
  const snapshot = await db.collection("users").get();

  if (snapshot.empty) {
    console.error("❌ users 컬렉션이 비어있거나 접근 불가합니다.");
    process.exit(1);
  }

  const imffUsers = snapshot.docs.map((doc) => ({
    uid:   doc.id,
    ...doc.data(),
  }));

  console.log(`✅ IMFF 전체 회원 ${imffUsers.length}명 조회 완료\n`);

  // 2) 통계 초기화
  const result = {
    total:         imffUsers.length,
    success:       0,
    newUser:       0,
    alreadyLinked: 0,
    skipped:       0,
    failed:        0,
    errors:        [],
  };

  // 3) 각 회원을 순서대로 im-core-auth에 sync
  for (let i = 0; i < imffUsers.length; i++) {
    const user     = imffUsers[i];
    const phone    = normalizePhone(user.phone);
    const progress = `[${String(i + 1).padStart(3, "0")}/${imffUsers.length}]`;
    const label    = user.name ?? user.nickname ?? user.uid.slice(0, 8);

    if (!phone) {
      console.log(`${progress} ⚠️  SKIP — 전화번호 없음 (${label})`);
      result.skipped++;
      continue;
    }

    try {
      const res = await fetch(`${IM_CORE_AUTH_URL}/api/auth/sync`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": IM_CORE_AUTH_SECRET,
        },
        body: JSON.stringify({
          phoneNumber: phone,
          appName:     "IMFF",
          localUserId: user.uid,            // Firebase UID를 로컬 ID로 사용
          name:        user.name ?? user.nickname ?? "",
          nickname:    user.nickname ?? "", // IMFF 닉네임 (로그인 ID)
          role:        user.role ?? "participant", // participant|judge|admin|photographer
        }),
      });

      const json = await res.json();

      if (json.success) {
        const tag  = json.isNewUser ? "🆕 신규" : "🔗 기존";
        const role = user.role ?? "participant";
        console.log(`${progress} ${tag} [${role.padEnd(12)}] — ${label} (${phone}) → master: ${json.masterUserId}`);
        result.success++;
        if (json.isNewUser) result.newUser++;
        else result.alreadyLinked++;
      } else {
        console.log(`${progress} ❌ 실패 — ${label} (${phone}): ${json.error}`);
        result.failed++;
        result.errors.push({ user: label, phone, error: json.error });
      }
    } catch (err) {
      console.log(`${progress} ❌ 네트워크 오류 — ${label}: ${err.message}`);
      result.failed++;
      result.errors.push({ user: label, phone: phone ?? "없음", error: err.message });
    }

    if (i < imffUsers.length - 1) await sleep(DELAY_MS);
  }

  // 4) 결과 출력
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  마이그레이션 완료 결과");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  전체 IMFF 회원:   ${result.total}명`);
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
