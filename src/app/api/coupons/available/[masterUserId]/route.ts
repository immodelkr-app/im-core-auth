import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coupons/available/[masterUserId]
 *
 * 해당 회원의 사용 가능한(미사용·미만료) 쿠폰 목록을 반환합니다.
 * 체크아웃 화면의 쿠폰 선택 드롭다운 용도입니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Response 200:
 *   { "coupons": [{ "userCouponId", "code", "name", "discountType", "discountValue",
 *                   "minOrderAmount", "maxDiscountAmount", "expiresAt" }] }
 *
 * NOTE: coupon_master에 min_order_amount, max_discount_amount 컬럼이 없으므로 null로 반환합니다.
 *       향후 컬럼 추가 시 select 구문과 매핑만 수정하면 됩니다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ masterUserId: string }> }
) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const { masterUserId } = await params;

  if (!masterUserId) {
    return NextResponse.json({ error: "masterUserId가 필요합니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("user_coupons")
    .select(
      `id,
       coupon_code,
       expires_at,
       coupon_master!inner (
         coupon_name,
         discount_type,
         discount_value
       )`
    )
    .eq("master_user_id", masterUserId)
    .eq("is_used", false)
    .gt("expires_at", now)
    .order("expires_at", { ascending: true });

  if (error) {
    console.error("[GET /api/coupons/available]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const coupons = (data ?? []).map((row) => {
    // Supabase join 결과는 단일 객체 또는 배열일 수 있으므로 안전하게 접근
    const master = Array.isArray(row.coupon_master)
      ? row.coupon_master[0]
      : row.coupon_master;

    return {
      userCouponId: row.id,
      code: row.coupon_code,
      name: master?.coupon_name ?? null,
      discountType: (master?.discount_type ?? null) as "fixed" | "percent" | null,
      discountValue: master?.discount_value ?? null,
      minOrderAmount: null,      // coupon_master에 해당 컬럼 없음
      maxDiscountAmount: null,   // coupon_master에 해당 컬럼 없음
      expiresAt: row.expires_at,
    };
  });

  return NextResponse.json({ coupons }, { status: 200 });
}
