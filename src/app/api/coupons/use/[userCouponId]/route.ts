import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/coupons/use/[userCouponId]
 *
 * 결제 완료 시 쿠폰을 사용 처리합니다.
 * user_coupons.is_used = true, used_at = now() 로 업데이트합니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Response 200: (body 없음)
 *
 * NOTE: DB CHECK 제약(chk_user_coupons_used_at)에 의해
 *       is_used = true 이면 반드시 used_at이 설정되어야 합니다.
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
    .select("id, is_used, expires_at")
    .eq("id", userCouponId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "쿠폰을 찾을 수 없습니다." }, { status: 404 });
  }

  if (existing.is_used) {
    return NextResponse.json({ error: "이미 사용된 쿠폰입니다." }, { status: 409 });
  }

  // 만료 여부 확인
  if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
    return NextResponse.json({ error: "만료된 쿠폰입니다." }, { status: 422 });
  }

  const { error: updateError } = await supabase
    .from("user_coupons")
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq("id", userCouponId);

  if (updateError) {
    console.error("[PATCH /api/coupons/use]", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({}, { status: 200 });
}
