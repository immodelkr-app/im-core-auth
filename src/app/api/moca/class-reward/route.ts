import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { rewardUserPoint, PointError } from "@/lib/points";

/**
 * POST /api/moca/class-reward
 *
 * MOCA 원데이 클래스 예약 확정 시 참가비 2% 포인트 적립
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   {
 *     masterUserId: string,       // 통합 마스터 유저 UUID
 *     classFee: number,           // 참가비 (원 단위 정수, 예: 50000)
 *     classTitle?: string,        // 클래스 이름 (description 용)
 *     reservationId?: string,     // MOCA 예약 ID (추적용)
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     rewardAmount: number,       // 실제 적립된 포인트 (2% 반올림)
 *     transactionId: string,
 *     newBalance: number
 *   }
 *
 * 적립 정책:
 *   - 기준 적립율: 2%
 *   - 소수점 이하 반올림 (예: 50,000 * 0.02 = 1,000pt)
 *   - 최소 적립액 1pt (계산 결과가 0이 되는 소액 참가비 방어)
 */

const REWARD_RATE = 0.02; // 2%

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

  const { masterUserId, classFee, classTitle, reservationId } = body as {
    masterUserId?: string;
    classFee?: number;
    classTitle?: string;
    reservationId?: string;
  };

  // ── 필수 필드 검증 ─────────────────────────────────────
  if (!masterUserId || classFee === undefined) {
    return NextResponse.json(
      { success: false, error: "masterUserId, classFee는 필수입니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(classFee) || classFee <= 0) {
    return NextResponse.json(
      { success: false, error: "classFee는 1 이상의 정수(원 단위)여야 합니다.", code: "INVALID_FIELDS" },
      { status: 400 }
    );
  }

  // ── 적립금 계산 (2%, 최소 1pt) ────────────────────────
  const rewardAmount = Math.max(1, Math.round(classFee * REWARD_RATE));

  const titlePart = classTitle ? ` [${classTitle}]` : "";
  const reservationPart = reservationId ? ` (예약ID: ${reservationId})` : "";
  const description = `MOCA 원데이 클래스 예약 확정 적립${titlePart}${reservationPart} — 참가비 ${classFee.toLocaleString()}원의 ${(REWARD_RATE * 100).toFixed(0)}%`;

  // ── 포인트 적립 ───────────────────────────────────────
  try {
    const result = await rewardUserPoint({
      masterUserId,
      appSource: "MOCA",
      amount: rewardAmount,
      description,
    });

    return NextResponse.json(
      {
        success: true,
        rewardAmount,
        rewardRate: REWARD_RATE,
        ...result,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof PointError) {
      const statusMap: Record<string, number> = {
        INVALID_PARAMS: 400,
        USER_NOT_FOUND: 404,
        DB_ERROR: 500,
      };
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/moca/class-reward]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
