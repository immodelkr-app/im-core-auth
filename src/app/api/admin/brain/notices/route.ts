import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";
import { collectNotices } from "@/lib/brain/collect";

// GET: 저장된 공고 목록 (마감일 순)
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brain_notices")
    .select("id, source, external_id, title, org, region, category, apply_start, deadline, amount, target, url, description, match_score, biz_age, eligible, collected_at")
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

  try {
    const r = await collectNotices(createAdminClient());
    if (r.kstartup + r.ansanart + r.ggcf + r.sfac === 0 && r.errors.length > 0) {
      return NextResponse.json({ success: false, error: r.errors.join(" / ") }, { status: 502 });
    }
    // 수집만 하고 문자는 보내지 않음 (문자는 매일 자동 수집 때만)
    return NextResponse.json({ success: true, count: r.kstartup + r.ansanart + r.ggcf + r.sfac, ...r });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
