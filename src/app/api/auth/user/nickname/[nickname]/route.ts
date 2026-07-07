import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/auth/user/nickname/[nickname]
 *
 * 닉네임으로 마스터 유저 정보 조회 (로그인 시 phone_number 획득용)
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Response:
 *   { found: true, masterUserId: string, phoneNumber: string }
 *   { found: false }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nickname: string }> }
) {
  // ── 인증 ────────────────────────────────────────────────────
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { nickname } = await params;
  const decodedNickname = decodeURIComponent(nickname).trim();

  if (!decodedNickname) {
    return NextResponse.json(
      { found: false, error: "nickname은 필수입니다." },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("master_users")
      .select("id, phone_number")
      .eq("name", decodedNickname)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/auth/user/nickname]", error);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json(
      {
        found: true,
        masterUserId: data.id,
        phoneNumber: data.phone_number,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/auth/user/nickname]", message);
    return NextResponse.json(
      { found: false, error: message },
      { status: 500 }
    );
  }
}
