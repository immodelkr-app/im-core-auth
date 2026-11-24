import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";

// GET: 사업자 프로필 조회 (없으면 profile: null → 화면에서 기본값 사용)
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brain_company_profile")
    .select("profile, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, profile: data?.profile ?? null, updated_at: data?.updated_at ?? null, updated_by: data?.updated_by ?? null });
}

// PUT: 사업자 프로필 저장 (manager 이상)
export async function PUT(request: Request) {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!hasRole(getAdminRole(user), "manager")) {
    return forbiddenResponse("사업자 프로필 수정은 매니저 이상만 가능합니다.");
  }

  let body: { profile?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const profile = body.profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return NextResponse.json({ success: false, error: "profile 객체가 필요합니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brain_company_profile")
    .upsert({ id: 1, profile, updated_by: user?.email ?? null, updated_at: new Date().toISOString() })
    .select("profile, updated_at, updated_by")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...data });
}
