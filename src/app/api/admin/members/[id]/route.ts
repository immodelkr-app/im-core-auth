import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  try {
    // 1. 마스터 유저 정보 조회
    const { data: member, error: memberError } = await supabase
      .from("master_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ success: false, error: memberError.message }, { status: 500 });
    }

    if (!member) {
      return NextResponse.json({ success: false, error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }

    // 2. 앱 매핑 정보 조회
    const { data: mappings, error: mappingError } = await supabase
      .from("app_user_mapping")
      .select("app_name, local_user_id, created_at")
      .eq("master_user_id", id);

    if (mappingError) {
      console.error("매핑 조회 에러:", mappingError);
    }

    // 3. 최근 포인트 거래 내역 조회 (최대 100건)
    const { data: transactions, error: txError } = await supabase
      .from("point_transactions")
      .select("id, source_app, type, amount, description, created_at")
      .eq("master_user_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (txError) {
      console.error("포인트 거래 조회 에러:", txError);
    }

    // 4. 보유 쿠폰 정보 조회
    const { data: coupons, error: couponError } = await supabase
      .from("user_coupons")
      .select(`
        id, coupon_code, is_used, used_at, expires_at, created_at,
        coupon_master ( coupon_name, discount_type, discount_value )
      `)
      .eq("master_user_id", id)
      .order("created_at", { ascending: false });

    if (couponError) {
      console.error("쿠폰 조회 에러:", couponError);
    }

    return NextResponse.json({
      success: true,
      member,
      mappings: mappings ?? [],
      transactions: transactions ?? [],
      coupons: coupons ?? [],
    });
  } catch (error) {
    console.error("회원 상세 조회 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}
