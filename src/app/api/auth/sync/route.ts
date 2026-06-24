import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { syncAndGetMasterUser } from "@/lib/auth";
import type { AppName } from "@/types/database";

/**
 * POST /api/auth/sync
 *
 * MOCA·IMFF 앱에서 로그인 시 마스터 계정과 동기화합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   { phoneNumber: string, appName: "MOCA"|"IMFF", localUserId: string, name?: string }
 *
 * Response:
 *   { success: true, masterUserId: string, integratedPoints: number, isNewUser: boolean }
 */
export async function POST(request: Request) {
  // ── 인증 ────────────────────────────────────────────────────
  const authError = validateApiSecret(request);
  if (authError) return authError;

  // ── 바디 파싱 ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "유효하지 않은 JSON 형식", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const { phoneNumber, appName, localUserId, name, role } = body as {
    phoneNumber?: string;
    appName?: string;
    localUserId?: string;
    name?: string;
    role?: string;
  };

  // ── 필수 필드 검증 ───────────────────────────────────────────
  if (!phoneNumber || !appName || !localUserId) {
    return NextResponse.json(
      {
        success: false,
        error: "phoneNumber, appName, localUserId는 필수입니다.",
        code: "MISSING_FIELDS",
      },
      { status: 400 }
    );
  }

  if (!["MOCA", "IMFF"].includes(appName)) {
    return NextResponse.json(
      { success: false, error: "appName은 MOCA 또는 IMFF여야 합니다.", code: "INVALID_APP_NAME" },
      { status: 400 }
    );
  }

  // ── 핵심 로직 ────────────────────────────────────────────────
  try {
    const result = await syncAndGetMasterUser({
      phoneNumber,
      appName: appName as AppName,
      localUserId,
      name,
      role,
    });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/auth/sync]", message);
    return NextResponse.json(
      { success: false, error: message, code: "SYNC_FAILED" },
      { status: 500 }
    );
  }
}
