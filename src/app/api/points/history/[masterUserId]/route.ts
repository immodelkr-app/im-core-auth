import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { getPointHistory, PointError } from "@/lib/points";
import type { AppName } from "@/types/database";

/**
 * GET /api/points/history/[masterUserId]?limit=20&offset=0&type=earn&appSource=MOCA
 *
 * 마스터 유저의 포인트 거래 내역을 최신순으로 반환합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Query Params:
 *   limit?:     최대 건수 (기본 20, 최대 100)
 *   offset?:    건너뛸 건수 (기본 0)
 *   type?:      "earn" | "use"
 *   appSource?: "MOCA" | "IMFF"
 *
 * Response:
 *   { success: true, masterUserId: string, transactions: [...] }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ masterUserId: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { masterUserId } = await params;
  const { searchParams } = new URL(request.url);

  const limit     = Math.min(Number(searchParams.get("limit")  ?? 20), 100);
  const offset    = Number(searchParams.get("offset") ?? 0);
  const type      = searchParams.get("type") as "earn" | "use" | null;
  const appSource = searchParams.get("appSource") as AppName | null;

  if (!masterUserId) {
    return NextResponse.json(
      { success: false, error: "masterUserId가 필요합니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  try {
    const transactions = await getPointHistory(masterUserId, {
      limit,
      offset,
      type: type ?? undefined,
      appSource: appSource ?? undefined,
    });
    return NextResponse.json({ success: true, masterUserId, transactions }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof PointError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.code === "USER_NOT_FOUND" ? 404 : 500 }
      );
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[GET /api/points/history]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
