import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/auth/user/nickname/[nickname]
 *
 * 닉네임으로 마스터 유저 정보 조회 (로그인 시 phone_number 획득용)
 * 특정 앱에 한정하지 않고 전체 app_user_mapping에서 nickname이 일치하는 유저를 찾습니다.
 * (이를 통해 MOCA 닉네임으로 MODEL_BEAUTY 로그인 가능)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nickname: string }> }
) {
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

    // 1. app_user_mapping에서 nickname이 일치하는 매핑 조회
    const { data: mapping, error: mappingError } = await supabase
      .from("app_user_mapping")
      .select("master_user_id")
      .eq("nickname", decodedNickname)
      .limit(1)
      .maybeSingle();

    if (mappingError) {
      console.error("[GET /api/auth/user/nickname] app_user_mapping 조회 오류:", mappingError);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!mapping) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // 2. 연결된 master_users 테이블에서 id 및 phone_number 조회
    const { data: masterUser, error: masterError } = await supabase
      .from("master_users")
      .select("id, phone_number")
      .eq("id", mapping.master_user_id)
      .maybeSingle();

    if (masterError) {
      console.error("[GET /api/auth/user/nickname] master_users 조회 오류:", masterError);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!masterUser) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json(
      {
        found: true,
        masterUserId: masterUser.id,
        phoneNumber: masterUser.phone_number,
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
