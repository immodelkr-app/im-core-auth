import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { deductUserPoint, PointError } from "@/lib/points";
import type { AppName } from "@/types/database";

/**
 * POST /api/points/deduct
 *
 * 유저 포인트를 차감합니다. (잔액 부족 시 402 반환)
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   { masterUserId: string, appSource: "MOCA"|"IMFF"|"MODEL_BEAUTY", amount: number, description?: string }
 *
 * Response:
 *   { success: true, transactionId: string, newBalance: number }
 */
export async function POST(request: Request) {
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

  const { masterUserId, appSource, amount, description } = body as {
    masterUserId?: string;
    appSource?: string;
    amount?: number;
    description?: string;
  };

  if (!masterUserId || !appSource || amount === undefined) {
    return NextResponse.json(
      { success: false, error: "masterUserId, appSource, amount는 필수입니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  if (!["MOCA", "IMFF", "MODEL_BEAUTY"].includes(appSource)) {
    return NextResponse.json(
      { success: false, error: "appSource는 MOCA, IMFF 또는 MODEL_BEAUTY여야 합니다.", code: "INVALID_APP_SOURCE" },
      { status: 400 }
    );
  }

  try {
    const result = await deductUserPoint({
      masterUserId,
      appSource: appSource as AppName,
      amount,
      description,
    });
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof PointError) {
      const statusMap: Record<string, number> = {
        INVALID_PARAMS:       400,
        USER_NOT_FOUND:       404,
        INSUFFICIENT_BALANCE: 402, // Payment Required
        DB_ERROR:             500,
      };
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/points/deduct]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
