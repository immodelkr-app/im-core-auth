import { NextRequest, NextResponse } from "next/server";
import { validateApiSecret } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/find-nickname
 *
 * 실명 + 휴대폰 번호로 닉네임 찾기 (MODEL_BEAUTY 매핑의 nickname 반환)
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

  const { realName, phoneNumber } = body as {
    realName?: string;
    phoneNumber?: string;
  };

  if (!realName?.trim() || !phoneNumber?.trim()) {
    return NextResponse.json(
      { found: false, error: "realName과 phoneNumber는 필수입니다." },
      { status: 400 }
    );
  }

  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  try {
    const supabase = createAdminClient();

    // 1. master_users에서 실명(real_name 또는 name) 및 전화번호로 마스터 유저 ID 조회
    // 기존 가입자는 real_name이 null이고 name에 실명이 들어있으므로 OR 조건 사용
    const { data: masterUser, error: masterError } = await supabase
      .from("master_users")
      .select("id")
      .eq("phone_number", normalizedPhone)
      .or(`real_name.eq."${realName.trim()}",and(real_name.is.null,name.eq."${realName.trim()}")`)
      .maybeSingle();

    if (masterError) {
      console.error("[POST /api/auth/find-nickname] master_users 조회 오류:", masterError);
      return NextResponse.json(
        { found: false, error: "조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!masterUser) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // 2. app_user_mapping에서 해당 마스터 유저의 MODEL_BEAUTY 닉네임 조회
    const { data: mapping, error: mappingError } = await supabase
      .from("app_user_mapping")
      .select("nickname")
      .eq("master_user_id", masterUser.id)
      .eq("app_name", "MODEL_BEAUTY")
      .maybeSingle();

    if (mappingError) {
      console.error("[POST /api/auth/find-nickname] app_user_mapping 조회 오류:", mappingError);
      return NextResponse.json(
        { found: false, error: "매핑 조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 만약 MODEL_BEAUTY의 nickname 컬럼이 비어있다면 master_users의 name(기본값)을 사용하거나
    // MOCA의 nickname을 fallback으로 활용하는 것도 고려합니다. (여기서는 mapping.nickname 혹은 null 처리)
    let nickname = mapping?.nickname;
    
    // 만약 모델뷰티에 매핑은 있는데 닉네임이 세팅 안 되었다면, master_users의 name은 실명이므로
    // 다른 연동 앱(MOCA, IMFF 등)의 닉네임을 가져와서 반환해주거나 master_users.name을 활용해 임시 제공
    if (!nickname) {
      const { data: otherMappings } = await supabase
        .from("app_user_mapping")
        .select("nickname")
        .eq("master_user_id", masterUser.id)
        .not("nickname", "is", null);
      
      if (otherMappings && otherMappings.length > 0) {
        nickname = otherMappings[0].nickname;
      }
    }

    if (!nickname) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({ found: true, nickname }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[POST /api/auth/find-nickname]", message);
    return NextResponse.json(
      { found: false, error: message },
      { status: 500 }
    );
  }
}
