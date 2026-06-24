import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  
  const range = searchParams.get("range") || "30d";
  let days = 30;
  if (range === "7d") days = 7;
  else if (range === "90d") days = 90;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  try {
    // 1. 신규 가입 회원 목록 조회 (기간 내)
    const { data: users, error: usersError } = await supabase
      .from("master_users")
      .select("created_at")
      .gte("created_at", startDate.toISOString());

    if (usersError) {
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
    }

    // 2. 포인트 내역 조회 (기간 내)
    const { data: transactions, error: txError } = await supabase
      .from("point_transactions")
      .select("amount, type, created_at")
      .gte("created_at", startDate.toISOString());

    if (txError) {
      return NextResponse.json({ success: false, error: txError.message }, { status: 500 });
    }

    // 3. 앱 매핑 현황 조회 (전체 대비 비율 확인용)
    const { data: mappings, error: mappingError } = await supabase
      .from("app_user_mapping")
      .select("app_name");

    if (mappingError) {
      return NextResponse.json({ success: false, error: mappingError.message }, { status: 500 });
    }

    // --- 데이터 가공 ---
    
    // 날짜별 빈 객체들 생성 (차트에 구멍이 뚫리지 않도록 모든 날짜 채움)
    const dateMap: { [date: string]: { date: string; signups: number; earn: number; use: number } } = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      dateMap[dateStr] = { date: dateStr, signups: 0, earn: 0, use: 0 };
    }

    // 신규 가입 카운트 채우기
    (users ?? []).forEach((user) => {
      const dateStr = new Date(user.created_at).toISOString().split("T")[0];
      if (dateMap[dateStr]) {
        dateMap[dateStr].signups += 1;
      }
    });

    // 포인트 입출금 누적 채우기
    (transactions ?? []).forEach((tx) => {
      const dateStr = new Date(tx.created_at).toISOString().split("T")[0];
      if (dateMap[dateStr]) {
        if (tx.type === "earn") {
          dateMap[dateStr].earn += tx.amount;
        } else if (tx.type === "use") {
          dateMap[dateStr].use += tx.amount;
        }
      }
    });

    // 앱 분포 데이터 계산
    const mocaCount = (mappings ?? []).filter((m) => m.app_name === "MOCA").length;
    const imffCount = (mappings ?? []).filter((m) => m.app_name === "IMFF").length;

    // 차트 데이터용 배열 정렬
    const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      chartData,
      appDistribution: [
        { name: "MOCA", value: mocaCount },
        { name: "IMFF", value: imffCount },
      ],
    });
  } catch (error) {
    console.error("통계 데이터 조회 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}
