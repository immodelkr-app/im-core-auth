import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { deductUserPoint, PointError } from "@/lib/points";

/**
 * POST /api/moca/class-cancel
 *
 * MOCA 원데이 클래스 예약 취소 시 기지급된 적립 포인트를 역거래(차감)로 회수
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   {
 *     masterUserId: string,       // 통합 마스터 유저 UUID
 *     rewardAmount: number,       // 회수할 포인트 (기존에 지급한 적립액 그대로)
 *     classTitle?: string,        // 클래스 이름 (description 용)
 *     reservationId?: string,     // MOCA 예약 ID (추적용)
 *   }
 *
 * Response (성공):
 *   { success: true, deductedAmount: number, transactionId: string, newBalance: number }
 *
 * Response (잔액 부족 — 포인트 이미 사용된 경우):
 *   { success: false, code: "INSUFFICIENT_BALANCE", currentBalance: number }
 *   ← HTTP 402 반환. MOCA 서버는 이 경우 환불금에서 사용한 포인트분을 공제해야 함.
 *
 * 취소 정책 (역거래 표준 방식):
 *   - 기존 적립 트랜잭션은 절대 수정/삭제하지 않음
 *   - 새로운 'use' 타입 차감 트랜잭션을 신규 생성하여 이력 보존
 *   - 유저 포인트 내역에 "[적립] 예약 확정 → [차감] 예약 취소" 흐름이 명확히 기록됨
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

  const { masterUserId, rewardAmount, classTitle, reservationId } = body as {
    masterUserId?: string;
    rewardAmount?: number;
    classTitle?: string;
    reservationId?: string;
  };

  // ── 필수 필드 검증 ─────────────────────────────────────
  if (!masterUserId || rewardAmount === undefined) {
    return NextResponse.json(
      { success: false, error: "masterUserId, rewardAmount는 필수입니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(rewardAmount) || rewardAmount <= 0) {
    return NextResponse.json(
      { success: false, error: "rewardAmount는 1 이상의 정수여야 합니다.", code: "INVALID_FIELDS" },
      { status: 400 }
    );
  }

  const titlePart = classTitle ? ` [${classTitle}]` : "";
  const reservationPart = reservationId ? ` (예약ID: ${reservationId})` : "";
  const description = `MOCA 원데이 클래스 예약 취소 포인트 회수${titlePart}${reservationPart}`;

  // ── 역거래: 신규 차감 트랜잭션 생성 ───────────────────
  try {
    const result = await deductUserPoint({
      masterUserId,
      appSource: "MOCA",
      amount: rewardAmount,
      description,
    });

    return NextResponse.json(
      {
        success: true,
        deductedAmount: rewardAmount,
        ...result,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof PointError) {
      // 잔액 부족: 이미 포인트를 사용한 경우 → MOCA 서버가 환불금 공제 처리해야 함
      if (err.code === "INSUFFICIENT_BALANCE") {
        return NextResponse.json(
          {
            success: false,
            error: "포인트 잔액이 부족합니다. 환불 금액에서 사용된 포인트를 공제하여 환불하세요.",
            code: "INSUFFICIENT_BALANCE",
          },
          { status: 402 }
        );
      }

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
    console.error("[POST /api/moca/class-cancel]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
