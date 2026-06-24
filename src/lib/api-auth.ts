// ============================================================
// IM-CORE-AUTH: 서버 간 API 보안 미들웨어
//
// MOCA·IMFF 앱에서 이 시스템의 API를 호출할 때
// 요청 헤더 x-api-secret 값을 검증합니다.
// ============================================================
import { NextResponse } from "next/server";

/**
 * 요청 헤더의 x-api-secret을 환경변수와 비교합니다.
 * 불일치 시 401 Response를 반환합니다.
 *
 * @example
 * ```ts
 * // Route Handler에서 사용
 * export async function POST(request: Request) {
 *   const authError = validateApiSecret(request);
 *   if (authError) return authError;
 *   // ... 로직
 * }
 * ```
 */
export function validateApiSecret(request: Request): NextResponse | null {
  const secret = request.headers.get("x-api-secret");
  const expected = process.env.API_SECRET_KEY;

  if (!expected) {
    console.error("[API Auth] API_SECRET_KEY 환경변수가 설정되지 않았습니다.");
    return NextResponse.json(
      { success: false, error: "서버 설정 오류", code: "SERVER_CONFIG_ERROR" },
      { status: 500 }
    );
  }

  if (!secret || secret !== expected) {
    return NextResponse.json(
      { success: false, error: "인증 실패: 유효하지 않은 API 시크릿", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  return null; // 검증 통과
}
