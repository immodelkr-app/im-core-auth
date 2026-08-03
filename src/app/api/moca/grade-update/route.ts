import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/moca/grade-update
 *
 * MOCA 앱에서 회원 등급 변경 시 im-core-auth 마스터 계정 등급 동기화
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   {
 *     masterUserId: string,  // 마스터 유저 UUID
 *     grade: string          // "NORMAL" | "SILVER" | "GOLD" | "IMODEL" | "VIP"
 *   }
 *
 * Response:
 *   { success: true, grade: string, grade_locked: boolean }
 */

const VALID_GRADES = ["NORMAL", "SILVER", "GOLD", "IMODEL", "VIP"];

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

  const { masterUserId, grade } = body as {
    masterUserId?: string;
    grade?: string;
  };

  if (!masterUserId || !grade) {
    return NextResponse.json(
      { success: false, error: "masterUserId와 grade는 필수입니다.", code: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

  const upperGrade = grade.toUpperCase();
  if (!VALID_GRADES.includes(upperGrade)) {
    return NextResponse.json(
      {
        success: false,
        error: `유효하지 않은 등급입니다. 허용값: ${VALID_GRADES.join(", ")}`,
        code: "INVALID_GRADE",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 기존 유저 및 등급 잠금 상태 확인
  const { data: user, error: selectError } = await supabase
    .from("master_users")
    .select("id, grade, grade_locked, grade_locked_reason")
    .eq("id", masterUserId)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json(
      { success: false, error: `유저 조회 중 오류: ${selectError.message}`, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { success: false, error: "해당 masterUserId를 찾을 수 없습니다.", code: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (user.grade_locked) {
    return NextResponse.json(
      {
        success: false,
        error: "어드민에 의해 등급이 잠겨 있어 변경할 수 없습니다.",
        code: "GRADE_LOCKED",
        grade: user.grade,
        grade_locked: true,
        reason: user.grade_locked_reason,
      },
      { status: 403 }
    );
  }

  // 등급 업데이트
  const { data: updated, error: updateError } = await supabase
    .from("master_users")
    .update({ grade: upperGrade, updated_at: new Date().toISOString() })
    .eq("id", masterUserId)
    .select("id, grade, grade_locked")
    .single();

  if (updateError) {
    return NextResponse.json(
      { success: false, error: `등급 업데이트 중 오류: ${updateError.message}`, code: "DB_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    grade: updated.grade,
    grade_locked: updated.grade_locked,
  });
}
