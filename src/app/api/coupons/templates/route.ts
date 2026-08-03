import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/coupons/templates
 *
 * 발급 가능한(is_active = true) 쿠폰 템플릿 목록을 반환합니다.
 * 관리자 화면 드롭다운 및 서버 간 발급 시 templateId 확인 용도입니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Response 200:
 *   { "templates": [{ "id", "name", "discountType", "discountValue" }] }
 */
export async function GET(request: Request) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("coupon_master")
    .select("coupon_code, coupon_name, discount_type, discount_value")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/coupons/templates]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const templates = (data ?? []).map((row) => ({
    id: row.coupon_code,
    name: row.coupon_name,
    discountType: row.discount_type as "fixed" | "percent",
    discountValue: row.discount_value,
  }));

  return NextResponse.json({ templates }, { status: 200 });
}
