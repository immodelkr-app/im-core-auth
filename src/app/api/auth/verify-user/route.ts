import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/verify-user
 *
 * 비밀번호 재설정 전 본인 확인 API
 * 닉네임(app_user_mapping.nickname) + 실명(master_users.real_name 또는 name) + 휴대폰 번호가 모두 일치하는지 검증
 */
export async function POST(request: NextRequest) {
  const authError = validateApiSecret(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { found: false, error: "유효하지 않은 JSON 형식" },
      { status: 400 }
    );
  }

  const { nickname, realName, phoneNumber, appName } = body as {
    nickname?: string;
    realName?: string;
    phoneNumber?: string;
    appName?: string;
  };

  if (!nickname?.trim() || !realName?.trim() || !phoneNumber?.trim() || !appName?.trim()) {
    return NextResponse.json(
      { found: false, error: "nickname, realName, phoneNumber, appName은 모두 필수입니다." },
      { status: 400 }
    );
  }

  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  try {
    const supabase = createAdminClient();

    // 1. app_user_mapping에서 닉네임과 앱 이름으로 마스터 유저 ID 및 local_user_id 조회
    const { data: mappings, error: mappingError } = await supabase
      .from("app_user_mapping")
      .select("master_user_id, local_user_id")
      .eq("nickname", nickname.trim())
      .eq("app_name", appName.trim());

    if (mappingError) {
      console.error("[POST /api/auth/verify-user] app_user_mapping 조회 오류:", mappingError);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!mappings || mappings.length === 0) {
      return NextResponse.json({ found: false, error: "일치하는 닉네임 정보가 없습니다." }, { status: 200 });
    }

    // 2. 검색된 master_user_id 들 중 실명과 전화번호가 일치하는 마스터 유저 검색
    const masterUserIds = mappings.map(m => m.master_user_id);
    const { data: masterUsers, error: masterError } = await supabase
      .from("master_users")
      .select("id, name, real_name, phone_number")
      .in("id", masterUserIds);

    if (masterError) {
      console.error("[POST /api/auth/verify-user] master_users 조회 오류:", masterError);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const matchedMaster = masterUsers.find(m => {
      const phoneMatch = m.phone_number.replace(/\D/g, "") === normalizedPhone;
      
      const cleanRealName = realName.trim();
      const nameMatch = m.real_name === cleanRealName || (!m.real_name && m.name === cleanRealName);
      
      return phoneMatch && nameMatch;
    });

    if (!matchedMaster) {
      return NextResponse.json({ found: false, error: "일치하는 회원 정보를 찾을 수 없습니다." }, { status: 200 });
    }

    const matchedMapping = mappings.find(m => m.master_user_id === matchedMaster.id);

    return NextResponse.json(
      {
        found: true,
        localUserId: matchedMapping?.local_user_id,
        masterUserId: matchedMaster.id,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/auth/verify-user]", message);
    return NextResponse.json(
      { found: false, error: message },
      { status: 500 }
    );
  }
}
