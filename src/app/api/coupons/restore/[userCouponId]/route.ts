import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/coupons/restore/[userCouponId]
 *
 * 환불 시 쿠폰을 복원합니다.
 * user_coupons.is_used = false, used_at = null 로 업데이트합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Response 200: (body 없음)
 *
 * NOTE: DB CHECK 제약(chk_user_coupons_used_at)에 의해
 *       is_used = false 이면 반드시 used_at이 NULL이어야 합니다.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userCouponId: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { userCouponId } = await params;

  if (!userCouponId) {
    return NextResponse.json({ error: "userCouponId가 필요합니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 현재 쿠폰 상태 확인
  const { data: existing, error: fetchError } = await supabase
    .from("user_coupons")
    .select("id, is_used")
    .eq("id", userCouponId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "쿠폰을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!existing.is_used) {
    return NextResponse.json({ error: "이미 미사용 상태인 쿠폰입니다." }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("user_coupons")
    .update({ is_used: false, used_at: null })
    .eq("id", userCouponId);

  if (updateError) {
    console.error("[PATCH /api/coupons/restore]", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({}, { status: 200 });
}
