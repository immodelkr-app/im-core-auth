import { NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { masterUserIds } = body as { masterUserIds: string[] };

    if (!masterUserIds || !Array.isArray(masterUserIds)) {
      return NextResponse.json(
        { success: false, error: "masterUserIds 배열이 필요합니다.", code: "INVALID_FIELDS" },
        { status: 400 }
      );
    }

    if (masterUserIds.length === 0) {
      return NextResponse.json({ success: true, users: [] }, { status: 200 });
    }

    const supabase = createAdminClient();
    const { data: users, error } = await supabase
      .from("master_users")
      .select("id, grade, grade_locked, grade_locked_reason")
      .in("id", masterUserIds);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: users ?? [] }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/auth/user/bulk]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
