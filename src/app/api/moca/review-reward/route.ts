import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { rewardUserPoint, PointError } from "@/lib/points";

/**
 * POST /api/moca/review-reward
 *
 * MOCA 원데이 클래스 후기 작성 후 포인트 적립
 * 후기 타입(일반 텍스트 / 포토 포함)에 따라 차등 지급
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   {
 *     masterUserId: string,       // 통합 마스터 유저 UUID
 *     reviewType: "text" | "photo", // 후기 타입 (text: 일반, photo: 포토 후기)
 *     classTitle?: string,        // 클래스 이름 (description 용)
 *     reservationId?: string,     // MOCA 예약 ID (중복 적립 방어용, MOCA 서버가 관리)
 *   }
 *
 * Response:
 *   { success: true, rewardAmount: number, reviewType: string, transactionId: string, newBalance: number }
 *
 * 후기 적립 정책:
 *   - "text"  (일반 후기, 사진 없음): 200pt
 *   - "photo" (포토 후기, 사진 1장↑): 500pt
 *
 * 중복 방지 주의:
 *   동일 reservationId에 대한 후기 중복 적립 방어는 MOCA 앱 서버에서 처리해야 합니다.
 *   (im-core-auth는 포인트 트랜잭션만 처리하므로 예약 기반 중복 체크를 직접 수행하지 않습니다)
 */

const REVIEW_REWARD: Record<string, number> = {
  text:  200, // 일반 텍스트 후기
  photo: 500, // 사진 첨부 후기
};

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

  const { masterUserId, reviewType, classTitle, reservationId } = body as {
    masterUserId?: string;
    reviewType?: string;
    classTitle?: string;
    reservationId?: string;
  };

  // ── 필수 필드 검증 ─────────────────────────────────────
  if (!masterUserId || !reviewType) {
    return NextResponse.json(
      { success: false, error: "masterUserId, reviewType은 필수입니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  if (!["text", "photo"].includes(reviewType)) {
    return NextResponse.json(
      { success: false, error: "reviewType은 'text' 또는 'photo'여야 합니다.", code: "INVALID_FIELDS" },
      { status: 400 }
    );
  }

  // ── 적립금 결정 ────────────────────────────────────────
  const rewardAmount = REVIEW_REWARD[reviewType];
  const reviewLabel  = reviewType === "photo" ? "포토 후기" : "일반 후기";
  const titlePart      = classTitle    ? ` [${classTitle}]` : "";
  const reservationPart = reservationId ? ` (예약ID: ${reservationId})` : "";
  const description = `MOCA 원데이 클래스 ${reviewLabel} 작성 보상${titlePart}${reservationPart}`;

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
        reviewType,
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
    console.error("[POST /api/moca/review-reward]", message);
    return NextResponse.json({ success: false, error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
