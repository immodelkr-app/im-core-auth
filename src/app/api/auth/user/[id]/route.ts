import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { getMasterUserById, updateMasterUserShipping } from "@/lib/auth";

/**
 * GET /api/auth/user/:id
 * 마스터 유저 ID로 배송지를 포함한 유저 정보를 조회합니다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const user = await getMasterUserById(id);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "존재하지 않는 사용자입니다.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/auth/user/[id]]", message);
    return NextResponse.json(
      { success: false, error: message, code: "GET_USER_FAILED" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/user/:id
 * 마스터 유저 ID로 기본 배송지 정보를 업데이트합니다.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

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
    shipping_recipient,
    shipping_phone,
    shipping_zipcode,
    shipping_address,
    shipping_detail,
  } = body as {
    shipping_recipient?: string | null;
    shipping_phone?: string | null;
    shipping_zipcode?: string | null;
    shipping_address?: string | null;
    shipping_detail?: string | null;
  };

  try {
    const { id } = await params;
    const updatedUser = await updateMasterUserShipping(id, {
      shipping_recipient,
      shipping_phone,
      shipping_zipcode,
      shipping_address,
      shipping_detail,
    });

    return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[PATCH /api/auth/user/[id]]", message);
    return NextResponse.json(
      { success: false, error: message, code: "UPDATE_USER_FAILED" },
      { status: 500 }
    );
  }
}
