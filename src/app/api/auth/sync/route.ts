import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { syncAndGetMasterUser } from "@/lib/auth";
import type { AppName } from "@/types/database";

/**
 * POST /api/auth/sync
 *
 * MOCA·IMFF 앱에서 로그인 또는 회원가입 시 마스터 계정과 동기화합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   { phoneNumber: string, appName: "MOCA"|"IMFF", localUserId: string, name?: string }
 *
 * Response:
 *   {
 *     success: true,
 *     masterUserId: string,
 *     integratedPoints: number,
 *     isNewUser: boolean,
 *     linkedApps: string[]   // 요청 앱 외에 이미 연동된 앱 목록 (방안 B 안내 메시지용)
 *   }
 *
 * ─── 클라이언트 앱 메시지 처리 가이드 ────────────────────────────
 *  isNewUser = true  → 신규 가입 완료 메시지 표시
 *  isNewUser = false, linkedApps = []        → 기존 동일 앱 재로그인 (별도 안내 불필요)
 *  isNewUser = false, linkedApps = ["MOCA"]  → 아래 안내 메시지 표시:
 *    "이미 모카(MOCA) 앱에 가입된 계정이 존재하여 자동으로 통합되었습니다.
 *     앞으로 동일한 아이디와 비밀번호로 두 앱을 모두 이용하실 수 있습니다."
 * ─────────────────────────────────────────────────────────────────
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

  const { phoneNumber, appName, localUserId, name, role, nickname } = body as {
    phoneNumber?: string;
    appName?: string;
    localUserId?: string;
    name?: string;
    role?: string;
    nickname?: string;
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

  if (!["MOCA", "IMFF", "MODEL_BEAUTY"].includes(appName)) {
    return NextResponse.json(
      { success: false, error: "appName은 MOCA, IMFF 또는 MODEL_BEAUTY여야 합니다.", code: "INVALID_APP_NAME" },
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
      nickname,
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

export async function PATCH(request: Request) {
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

  const {
    masterUserId,
    shipping_recipient,
    shipping_phone,
    shipping_zipcode,
    shipping_address,
    shipping_detail,
  } = body as {
    masterUserId?: string;
    shipping_recipient?: string | null;
    shipping_phone?: string | null;
    shipping_zipcode?: string | null;
    shipping_address?: string | null;
    shipping_detail?: string | null;
  };

  if (!masterUserId) {
    return NextResponse.json(
      { success: false, error: "masterUserId는 필수입니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  try {
    const { updateMasterUser } = await import("@/lib/auth");
    const updatedUser = await updateMasterUser(masterUserId, {
      ...(shipping_recipient !== undefined ? { shipping_recipient } : {}),
      ...(shipping_phone !== undefined ? { shipping_phone } : {}),
      ...(shipping_zipcode !== undefined ? { shipping_zipcode } : {}),
      ...(shipping_address !== undefined ? { shipping_address } : {}),
      ...(shipping_detail !== undefined ? { shipping_detail } : {}),
    });

    return NextResponse.json({ success: true, ...updatedUser }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[PATCH /api/auth/sync]", message);
    return NextResponse.json(
      { success: false, error: message, code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

