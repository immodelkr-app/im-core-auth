import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, hasRole, forbiddenResponse } from "@/lib/rbac";
import { logAdminAction, getClientIp } from "@/lib/audit";

// GET: 어드민 계정 목록 조회
export async function GET() {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);

  // super_admin만 계정 목록 조회 가능
  if (!hasRole(role, "super_admin")) {
    return forbiddenResponse("어드민 계정 관리는 슈퍼 관리자만 가능합니다.");
  }

  const adminClient = createAdminClient();

  try {
    // Supabase Auth Admin API로 사용자 목록 조회
    const { data: { users }, error } = await adminClient.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 필요한 정보만 추출하여 반환 (비밀번호 등 민감 정보 제외)
    const adminUsers = (users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role ?? "manager",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at,
    }));

    return NextResponse.json({ success: true, users: adminUsers });
  } catch (error) {
    console.error("어드민 목록 조회 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}

// POST: 신규 어드민 초대/생성
export async function POST(request: Request) {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);

  if (!hasRole(role, "super_admin")) {
    return forbiddenResponse("어드민 계정 생성은 슈퍼 관리자만 가능합니다.");
  }

  const adminClient = createAdminClient();

  try {
    const body = await request.json();
    const { email, password, adminRole } = body;

    if (!email || !password || !adminRole) {
      return NextResponse.json(
        { success: false, error: "이메일, 비밀번호, 역할은 필수입니다." },
        { status: 400 }
      );
    }

    const validRoles = ["super_admin", "manager", "viewer"];
    if (!validRoles.includes(adminRole)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 역할입니다. (super_admin, manager, viewer 중 하나)" },
        { status: 400 }
      );
    }

    const { data: newUser, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: adminRole },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // ── 감사 로그 기록 ──
    await logAdminAction({
      adminEmail: user?.email ?? "unknown",
      adminId: user?.id ?? "unknown",
      action: "ADMIN_CREATE",
      targetType: "ADMIN",
      targetId: newUser.user?.id,
      detail: { email, adminRole },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true, user: { id: newUser.user?.id, email, role: adminRole } });
  } catch (error) {
    console.error("어드민 생성 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}

// PATCH: 어드민 역할 변경
export async function PATCH(request: Request) {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);

  if (!hasRole(role, "super_admin")) {
    return forbiddenResponse("역할 변경은 슈퍼 관리자만 가능합니다.");
  }

  const adminClient = createAdminClient();

  try {
    const body = await request.json();
    const { userId, newRole } = body;

    if (!userId || !newRole) {
      return NextResponse.json({ success: false, error: "userId와 newRole은 필수입니다." }, { status: 400 });
    }

    // 자기 자신의 역할은 변경 불가
    if (userId === user?.id) {
      return NextResponse.json(
        { success: false, error: "자신의 역할은 변경할 수 없습니다." },
        { status: 400 }
      );
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { role: newRole },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // ── 감사 로그 기록 ──
    await logAdminAction({
      adminEmail: user?.email ?? "unknown",
      adminId: user?.id ?? "unknown",
      action: "ADMIN_ROLE_CHANGE",
      targetType: "ADMIN",
      targetId: userId,
      detail: { newRole },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("역할 변경 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}

// DELETE: 어드민 계정 삭제
export async function DELETE(request: Request) {
  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();
  const role = getAdminRole(user as any);

  if (!hasRole(role, "super_admin")) {
    return forbiddenResponse("어드민 계정 삭제는 슈퍼 관리자만 가능합니다.");
  }

  const adminClient = createAdminClient();

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId가 누락되었습니다." }, { status: 400 });
    }

    if (userId === user?.id) {
      return NextResponse.json({ success: false, error: "자신의 계정은 삭제할 수 없습니다." }, { status: 400 });
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // ── 감사 로그 기록 ──
    await logAdminAction({
      adminEmail: user?.email ?? "unknown",
      adminId: user?.id ?? "unknown",
      action: "ADMIN_DELETE",
      targetType: "ADMIN",
      targetId: userId,
      detail: {},
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("어드민 삭제 에러:", error);
    return NextResponse.json({ success: false, error: "서버 에러가 발생했습니다." }, { status: 500 });
  }
}
