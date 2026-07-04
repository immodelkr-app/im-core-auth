import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { getMasterUserByPhone } from "@/lib/auth";

/**
 * GET /api/auth/user/phone/:phone
 * 휴대폰 번호로 배송지를 포함한 마스터 유저 정보를 조회합니다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  try {
    const { phone } = await params;
    const user = await getMasterUserByPhone(phone);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "존재하지 않는 사용자입니다.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/auth/user/phone/[phone]]", message);
    return NextResponse.json(
      { success: false, error: message, code: "GET_USER_BY_PHONE_FAILED" },
      { status: 500 }
    );
  }
}
