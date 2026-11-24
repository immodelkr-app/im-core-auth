import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";
import { fetchKstartup } from "@/lib/brain/notices";

// GET: 저장된 공고 목록 (마감일 순)
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brain_notices")
    .select("id, source, external_id, title, org, region, category, apply_start, deadline, amount, target, url, description, match_score, collected_at")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(3000);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, notices: data ?? [] });
}

// POST: 공공 API에서 최신 공고 수집 후 저장 (manager 이상)
export async function POST() {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!hasRole(getAdminRole(user), "manager")) {
    return forbiddenResponse("공고 수집은 매니저 이상만 가능합니다.");
  }

  const apiKey = process.env.KSTARTUP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "KSTARTUP_API_KEY 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  let rows;
  try {
    rows = await fetchKstartup(apiKey);
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 502 });
  }

  const supabase = createAdminClient();
  const collected_at = new Date().toISOString();
  const { error } = await supabase
    .from("brain_notices")
    .upsert(rows.map((r) => ({ ...r, collected_at })), { onConflict: "source,external_id" });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, count: rows.length });
}
