import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { getPointBalance, PointError } from "@/lib/points";

/**
 * GET /api/points/balance/[masterUserId]
 *
 * 마스터 유저의 현재 통합 포인트 잔액을 반환합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Response:
 *   { success: true, masterUserId: string, integratedPoints: number }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ masterUserId: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { masterUserId } = await params;

  if (!masterUserId) {
    return NextResponse.json(
      { success: false, error: "masterUserId가 필요합니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  try {
    const integratedPoints = await getPointBalance(masterUserId);
    return NextResponse.json({ success: true, masterUserId, integratedPoints }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof PointError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.code === "USER_NOT_FOUND" ? 404 : 500 }
      );
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/points/balance]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
