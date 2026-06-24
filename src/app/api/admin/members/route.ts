import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("master_users")
      .select(`
        id, phone_number, name, integrated_points, created_at,
        app_user_mapping ( app_name, local_user_id )
      `, { count: "exact" });

    if (search) {
      // phone_number 또는 name에서 검색
      // 폰 번호의 경우 사용자가 하이픈(-)을 넣어서 검색할 수 있으므로, 하이픈을 제거하고 검색하는 등 처리 가능
      const cleanSearch = search.replace(/-/g, "");
      query = query.or(`name.ilike.%${search}%,phone_number.like.%${cleanSearch}%`);
    }

    const { data: members, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      members: members ?? [],
      count: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("회원 목록 조회 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}
