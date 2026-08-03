import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/coupons/issue
 *
 * 특정 회원에게 쿠폰 1장을 발급합니다.
 * 관리자 수동 발급 / 생일쿠폰 크론 / 라이브 우승자 지급 공용 엔드포인트입니다.
 *
 * Request Headers:
 *   x-api-secret: {API_SECRET_KEY}
 *
 * Request Body:
 *   { masterUserId: string, couponTemplateId: string, issuedBy: string }
 *
 * Response 200:
 *   { "coupon": { "userCouponId", "code", "expiresAt" } }
 *
 * Error:
 *   4xx/5xx + { "error": "메시지" }
 */
export async function POST(request: Request) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "유효하지 않은 JSON 형식" }, { status: 400 });
  }

  const { masterUserId, couponTemplateId, issuedBy } = body as {
    masterUserId?: string;
    couponTemplateId?: string;
    issuedBy?: string;
  };

  if (!masterUserId || !couponTemplateId || !issuedBy) {
    return NextResponse.json(
      { error: "masterUserId, couponTemplateId, issuedBy는 필수입니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 쿠폰 템플릿 조회 (활성 여부 포함)
  const { data: template, error: templateError } = await supabase
    .from("coupon_master")
    .select("coupon_code, validity_days, is_active")
    .eq("coupon_code", couponTemplateId)
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { error: "쿠폰 템플릿을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (!template.is_active) {
    return NextResponse.json(
      { error: "비활성화된 쿠폰 템플릿입니다. 발급할 수 없습니다." },
      { status: 422 }
    );
  }

  // 만료일 계산: 현재 시각 + validity_days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + template.validity_days);

  // user_coupons 레코드 삽입
  const { data: issued, error: insertError } = await supabase
    .from("user_coupons")
    .insert({
      master_user_id: masterUserId,
      coupon_code: template.coupon_code,
      is_used: false,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, coupon_code, expires_at")
    .single();

  if (insertError || !issued) {
    console.error("[POST /api/coupons/issue]", insertError?.message);
    return NextResponse.json(
      { error: insertError?.message ?? "쿠폰 발급 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      coupon: {
        userCouponId: issued.id,
        code: issued.coupon_code,
        expiresAt: issued.expires_at,
      },
    },
    { status: 200 }
  );
}
