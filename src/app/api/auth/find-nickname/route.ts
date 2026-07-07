import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/find-nickname
 *
 * 실명 + 휴대폰 번호로 닉네임 찾기
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   { realName: string, phoneNumber: string }
 *
 * Response:
 *   { found: true, nickname: string }
 *   { found: false }
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

  const { realName, phoneNumber } = body as {
    realName?: string;
    phoneNumber?: string;
  };

  if (!realName?.trim() || !phoneNumber?.trim()) {
    return NextResponse.json(
      { found: false, error: "realName과 phoneNumber는 필수입니다." },
      { status: 400 }
    );
  }

  // 전화번호 정규화
  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("master_users")
      .select("name")
      .eq("real_name", realName.trim())
      .eq("phone_number", normalizedPhone)
      .maybeSingle();

    if (error) {
      console.error("[POST /api/auth/find-nickname]", error);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({ found: true, nickname: data.name }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/auth/find-nickname]", message);
    return NextResponse.json(
      { found: false, error: message },
      { status: 500 }
    );
  }
}
