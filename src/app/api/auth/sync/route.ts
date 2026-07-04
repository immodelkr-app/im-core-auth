import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { syncAndGetMasterUser, syncMasterUserShippingByPhone, updateMasterUserShipping } from "@/lib/auth";
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

/**
 * PATCH /api/auth/sync
 *
 * MOCA·IMFF 앱에서 배송지 정보가 변경되었을 때, 
 * 휴대폰 번호 또는 마스터 유저 ID를 활용하여 마스터 계정의 기본 배송지를 동기화 및 업데이트합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   {
 *     phoneNumber?: string,
 *     masterUserId?: string,
 *     shipping_recipient?: string | null,
 *     shipping_phone?: string | null,
 *     shipping_zipcode?: string | null,
 *     shipping_address?: string | null,
 *     shipping_detail?: string | null
 *   }
 */
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
    phoneNumber,
    masterUserId,
    shipping_recipient,
    shipping_phone,
    shipping_zipcode,
    shipping_address,
    shipping_detail,
  } = body as {
    phoneNumber?: string;
    masterUserId?: string;
    shipping_recipient?: string | null;
    shipping_phone?: string | null;
    shipping_zipcode?: string | null;
    shipping_address?: string | null;
    shipping_detail?: string | null;
  };

  // ── 필수 식별 정보 검증 ───────────────────────────────────────
  if (!phoneNumber && !masterUserId) {
    return NextResponse.json(
      {
        success: false,
        error: "phoneNumber 또는 masterUserId 중 하나는 필수입니다.",
        code: "MISSING_IDENTIFIER",
      },
      { status: 400 }
    );
  }

  try {
    let updatedUser;
    const shippingData = {
      shipping_recipient,
      shipping_phone,
      shipping_zipcode,
      shipping_address,
      shipping_detail,
    };

    if (masterUserId) {
      updatedUser = await updateMasterUserShipping(masterUserId, shippingData);
    } else if (phoneNumber) {
      updatedUser = await syncMasterUserShippingByPhone(phoneNumber, shippingData);
    }

    return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[PATCH /api/auth/sync]", message);
    return NextResponse.json(
      { success: false, error: message, code: "SYNC_PATCH_FAILED" },
      { status: 500 }
    );
  }
}
