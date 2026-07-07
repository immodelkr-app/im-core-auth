import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/auth/check-nickname?nickname=xxx
 *
 * 닉네임 사용 가능 여부 조회 (app_user_mapping 테이블의 nickname 기준)
 */
export async function GET(request: NextRequest) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim();

  if (!nickname || nickname.length < 2) {
    return NextResponse.json(
      { available: false, error: "닉네임은 2자 이상이어야 합니다." },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    // app_user_mapping 테이블에서 nickname 중복 여부 체크
    const { data, error } = await supabase
      .from("app_user_mapping")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/auth/check-nickname]", error);
      return NextResponse.json(
        { available: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ available: data === null }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/auth/check-nickname]", message);
    return NextResponse.json(
      { available: false, error: message },
      { status: 500 }
    );
  }
}
