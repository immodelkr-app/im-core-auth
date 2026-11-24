import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectNotices } from "@/lib/brain/collect";
import { sendAnsanAlerts } from "@/lib/brain/alerts";

export const maxDuration = 60;

// Vercel Cron (vercel.json) 이 매일 호출. CRON_SECRET 이 설정되어 있으면 Vercel 이
// "Authorization: Bearer <CRON_SECRET>" 헤더를 붙여 보내므로 그걸로만 허용.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  try {
    const collected = await collectNotices(supabase);
    const alerts = await sendAnsanAlerts(supabase);
    return NextResponse.json({ success: true, collected, alerts });
  } catch (e) {
    console.error("[cron/brain-notices]", e);
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
