import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { getMasterUserByPhone, AuthError } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { phone } = await params;

  if (!phone) {
    return NextResponse.json(
      { success: false, error: "phone이 필요합니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  try {
    const decodedPhone = decodeURIComponent(phone);
    const user = await getMasterUserByPhone(decodedPhone);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "해당 전화번호의 유저를 찾을 수 없습니다.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, ...user }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: 500 }
      );
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/auth/user/phone/:phone]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
