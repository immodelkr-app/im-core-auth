import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  // 전체 포인트 통계
  const { data: earnData } = await supabase
    .from("point_transactions")
    .select("amount, source_app")
    .eq("type", "earn");

  const { data: useData } = await supabase
    .from("point_transactions")
    .select("amount, source_app")
    .eq("type", "use");

  const totalEarned = (earnData ?? []).reduce((s, t) => s + t.amount, 0);
  const totalUsed   = (useData  ?? []).reduce((s, t) => s + t.amount, 0);
  const mocaEarned  = (earnData ?? []).filter(t => t.source_app === "MOCA").reduce((s, t) => s + t.amount, 0);
  const imffEarned  = (earnData ?? []).filter(t => t.source_app === "IMFF").reduce((s, t) => s + t.amount, 0);

  // 거래 내역 전체 (최신 200건, 유저 이름/전화번호 포함)
  const { data: transactions, error } = await supabase
    .from("point_transactions")
    .select(`
      id, source_app, type, amount, description, created_at,
      master_users ( phone_number, name )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    stats: { totalEarned, totalUsed, mocaEarned, imffEarned, netPoints: totalEarned - totalUsed },
    transactions: transactions ?? [],
  });
}
