import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/verify-user
 *
 * 비밀번호 재설정 전 본인 확인 API
 * 닉네임 + 실명 + 휴대폰 번호가 모두 일치하는 경우 해당 앱의 localUserId를 반환합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   { nickname: string, realName: string, phoneNumber: string, appName: "MODEL_BEAUTY" | "MOCA" | "IMFF" }
 *
 * Response (성공):
 *   { found: true, localUserId: string, masterUserId: string }
 *
 * Response (실패):
 *   { found: false, error?: string }
 */
export async function POST(request: NextRequest) {
  // ── 인증 ────────────────────────────────────────────────────
  const authError = validateApiSecret(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { found: false, error: "유효하지 않은 JSON 형식" },
      { status: 400 }
    );
  }

  const { nickname, realName, phoneNumber, appName } = body as {
    nickname?: string;
    realName?: string;
    phoneNumber?: string;
    appName?: string;
  };

  if (!nickname?.trim() || !realName?.trim() || !phoneNumber?.trim() || !appName?.trim()) {
    return NextResponse.json(
      { found: false, error: "nickname, realName, phoneNumber, appName은 모두 필수입니다." },
      { status: 400 }
    );
  }

  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  try {
    const supabase = createAdminClient();

    // 닉네임 + 실명 + 전화번호로 master_users 조회
    const { data: masterUser, error: masterError } = await supabase
      .from("master_users")
      .select("id")
      .eq("name", nickname.trim())
      .eq("real_name", realName.trim())
      .eq("phone_number", normalizedPhone)
      .maybeSingle();

    if (masterError) {
      console.error("[POST /api/auth/verify-user] master_users 조회 오류:", masterError);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!masterUser) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // app_user_mapping에서 해당 앱의 localUserId 조회
    const { data: mapping, error: mappingError } = await supabase
      .from("app_user_mapping")
      .select("local_user_id")
      .eq("master_user_id", masterUser.id)
      .eq("app_name", appName.trim())
      .maybeSingle();

    if (mappingError) {
      console.error("[POST /api/auth/verify-user] app_user_mapping 조회 오류:", mappingError);
      return NextResponse.json(
        { found: false, error: "앱 매핑 조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!mapping) {
      return NextResponse.json(
        { found: false, error: "해당 앱에 가입된 계정이 없습니다." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        found: true,
        localUserId: mapping.local_user_id,
        masterUserId: masterUser.id,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/auth/verify-user]", message);
    return NextResponse.json(
      { found: false, error: message },
      { status: 500 }
    );
  }
}
