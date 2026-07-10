import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { getMasterUserById, updateMasterUser, AuthError } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id가 필요합니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  try {
    const user = await getMasterUserById(id);
    return NextResponse.json({ success: true, ...user }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/auth/user/:id]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id가 필요합니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

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
    name,
    shipping_recipient,
    shipping_phone,
    shipping_zipcode,
    shipping_address,
    shipping_detail,
    grade,
    grade_locked,
    grade_locked_reason,
  } = body as {
    name?: string;
    shipping_recipient?: string | null;
    shipping_phone?: string | null;
    shipping_zipcode?: string | null;
    shipping_address?: string | null;
    shipping_detail?: string | null;
    grade?: string;
    grade_locked?: boolean;
    grade_locked_reason?: string | null;
  };

  try {
    const updatedUser = await updateMasterUser(id, {
      ...(name !== undefined ? { name } : {}),
      ...(shipping_recipient !== undefined ? { shipping_recipient } : {}),
      ...(shipping_phone !== undefined ? { shipping_phone } : {}),
      ...(shipping_zipcode !== undefined ? { shipping_zipcode } : {}),
      ...(shipping_address !== undefined ? { shipping_address } : {}),
      ...(shipping_detail !== undefined ? { shipping_detail } : {}),
      ...(grade !== undefined ? { grade } : {}),
      ...(grade_locked !== undefined ? { grade_locked } : {}),
      ...(grade_locked_reason !== undefined ? { grade_locked_reason } : {}),
    });

    return NextResponse.json({ success: true, ...updatedUser }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: 500 }
      );
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[PATCH /api/auth/user/:id]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
