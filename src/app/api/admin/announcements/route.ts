import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction, getClientIp } from "@/lib/audit";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    let query = supabase
      .from("admin_announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data: announcements, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      announcements: announcements ?? [],
    });
  } catch (error) {
    console.error("공지사항 조회 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // ── RBAC: manager 이상만 공지 생성 가능 ──
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);
  if (!hasRole(role, "manager")) {
    return forbiddenResponse("공지사항 생성은 매니저 이상만 가능합니다.");
  }

  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { title, body: content, target_app } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: "제목(title)과 내용(body)은 필수입니다." },
        { status: 400 }
      );
    }

    const { data: newAnnouncement, error } = await supabase
      .from("admin_announcements")
      .insert({
        title,
        body: content,
        target_app: target_app || "ALL",
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // ── 감사 로그 기록 ──
    await logAdminAction({
      adminEmail: user?.email ?? "unknown",
      adminId: user?.id ?? "unknown",
      action: "ANNOUNCEMENT_CREATE",
      targetType: "ANNOUNCEMENT",
      targetId: newAnnouncement.id,
      detail: { title, target_app: target_app || "ALL" },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      announcement: newAnnouncement,
    });
  } catch (error) {
    console.error("공지사항 생성 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  // ── RBAC: manager 이상만 공지 수정 가능 ──
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);
  if (!hasRole(role, "manager")) {
    return forbiddenResponse("공지사항 수정은 매니저 이상만 가능합니다.");
  }

  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { id, is_active, title, body: content, target_app } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "id는 필수입니다." }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (is_active !== undefined) updateData.is_active = is_active;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.body = content;
    if (target_app !== undefined) updateData.target_app = target_app;

    const { data: updatedAnnouncement, error } = await supabase
      .from("admin_announcements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // ── 감사 로그 기록 ──
    await logAdminAction({
      adminEmail: user?.email ?? "unknown",
      adminId: user?.id ?? "unknown",
      action: "ANNOUNCEMENT_UPDATE",
      targetType: "ANNOUNCEMENT",
      targetId: id,
      detail: updateData,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      announcement: updatedAnnouncement,
    });
  } catch (error) {
    console.error("공지사항 수정 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // ── RBAC: super_admin만 공지 삭제 가능 ──
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);
  if (!hasRole(role, "manager")) {
    return forbiddenResponse("공지사항 삭제는 매니저 이상만 가능합니다.");
  }

  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id가 누락되었습니다." }, { status: 400 });
    }

    const { error } = await supabase
      .from("admin_announcements")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // ── 감사 로그 기록 ──
    await logAdminAction({
      adminEmail: user?.email ?? "unknown",
      adminId: user?.id ?? "unknown",
      action: "ANNOUNCEMENT_DELETE",
      targetType: "ANNOUNCEMENT",
      targetId: id,
      detail: {},
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "공지사항이 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    console.error("공지사항 삭제 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}
