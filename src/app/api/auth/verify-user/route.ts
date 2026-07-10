import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/verify-user
 *
 * 비밀번호 재설정 전 본인 확인 API
 * 닉네임(모든 앱 매핑 중 일치하는 nickname) + 실명(master_users.real_name 또는 name) + 휴대폰 번호가 모두 일치하는지 검증
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

    // 1. 전체 app_user_mapping에서 입력받은 닉네임과 일치하는 매핑들을 조회
    // (MOCA나 IMFF 등 다른 앱에 닉네임이 설정되어 있어도 검색이 가능하도록 함)
    const { data: mappings, error: mappingError } = await supabase
      .from("app_user_mapping")
      .select("master_user_id, local_user_id, app_name")
      .eq("nickname", nickname.trim());

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

    // 3. 해당 마스터 유저가 요청된 앱(appName: 예: MODEL_BEAUTY)에 매핑되어 있는지 확인
    // 기존에 매핑은 있었으나 nickname이 null이었던 계정일 수 있으므로 다시 테이블을 조회
    const { data: targetMapping, error: targetMappingError } = await supabase
      .from("app_user_mapping")
      .select("local_user_id, nickname")
      .eq("master_user_id", matchedMaster.id)
      .eq("app_name", appName.trim())
      .maybeSingle();

    if (targetMappingError) {
      console.error("[POST /api/auth/verify-user] target app mapping 조회 오류:", targetMappingError);
      return NextResponse.json(
        { found: false, error: "매핑 조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!targetMapping) {
      return NextResponse.json(
        { found: false, error: `${appName} 앱에 연동된 계정 정보를 찾을 수 없습니다.` },
        { status: 200 }
      );
    }

    // 4. 모델뷰티 앱 매핑의 nickname 컬럼이 비어있다면, 
    // 본인인증이 완료된 김에 자동으로 사용자의 닉네임("김대표")을 채워줍니다.
    if (!targetMapping.nickname) {
      const { error: updateNickError } = await supabase
        .from("app_user_mapping")
        .update({ nickname: nickname.trim() })
        .eq("master_user_id", matchedMaster.id)
        .eq("app_name", appName.trim());

      if (updateNickError) {
        console.warn("[POST /api/auth/verify-user] 닉네임 자동 업데이트 실패:", updateNickError);
      }
    }

    return NextResponse.json(
      {
        found: true,
        localUserId: targetMapping.local_user_id,
        masterUserId: matchedMaster.id,
        phoneNumber: matchedMaster.phone_number, // 가상 이메일 복원을 위해 전화번호 반환 추가
        nickname: nickname.trim(), // 닉네임 전달 추가
        realName: matchedMaster.real_name || matchedMaster.name, // 실명 전달 추가
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
