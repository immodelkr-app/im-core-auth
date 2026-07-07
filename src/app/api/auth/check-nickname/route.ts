import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/auth/check-nickname?nickname=xxx
 *
 * 닉네임 사용 가능 여부 조회 (MOCA, IMFF, 모델뷰티 통합 체크)
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Response:
 *   { available: true }  — 사용 가능
 *   { available: false } — 이미 사용 중
 */
export async function GET(request: NextRequest) {
  // ── 인증 ────────────────────────────────────────────────────
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
    const { data, error } = await supabase
      .from("master_users")
      .select("id")
      .eq("name", nickname)
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
