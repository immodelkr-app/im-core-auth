import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const action = searchParams.get("action") || "";
  const adminEmail = searchParams.get("adminEmail") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("admin_audit_logs")
      .select("*", { count: "exact" });

    if (action) query = query.eq("action", action);
    if (adminEmail) query = query.ilike("admin_email", `%${adminEmail}%`);
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) {
      // endDate는 당일 포함을 위해 다음 날 00:00:00으로 설정
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }

    const { data: logs, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs: logs ?? [],
      count: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("감사 로그 조회 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}
