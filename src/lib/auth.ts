// ============================================================
// IM-CORE-AUTH: SSO 핵심 인증 로직
//
// 역할: 타 앱(MOCA, IMFF, MODEL_BEAUTY)에서 로그인 시 중앙 시스템과 연동.
//       휴대폰 번호를 기준으로 마스터 계정을 조회/생성하고
//       앱별 유저 ID를 매핑합니다.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { AppName, MasterUser } from "@/types/database";

// ============================================================
// 공개 타입
// ============================================================

/** syncAndGetMasterUser 입력 파라미터 */
export interface SyncMasterUserParams {
  /** 통합 기준키: 휴대폰 번호 (예: "01012345678") */
  phoneNumber: string;
  /** 요청 출처 앱 */
  appName: AppName;
  /** 해당 앱 내에서 사용하는 유저 고유 ID */
  localUserId: string;
  /** 신규 유저 생성 시 사용할 닉네임 (없으면 phoneNumber 앞 3자리+**** 마스킹 사용) */
  name?: string;
  /** 실명 (닉네임 찾기, 비밀번호 재설정 본인확인용) */
  realName?: string;
  /** 앱 내 역할 (IMFF: participant|judge|admin|photographer) */
  role?: string;
  /** 앱 내 닉네임 (로그인 ID로 사용되는 경우) */
  nickname?: string;
}

/** syncAndGetMasterUser 반환값 */
export interface SyncMasterUserResult {
  /** 마스터 유저 UUID */
  masterUserId: string;
  /** 현재 통합 포인트 잔액 */
  integratedPoints: number;
  /** 이번 호출에서 마스터 계정이 신규 생성되었는지 여부 */
  isNewUser: boolean;
  /**
   * 이번 요청 앱(appName)을 제외하고 이미 연동된 앱 목록.
   * isNewUser=false일 때 비어 있지 않을 수 있습니다.
   * 예) IMFF 앱에서 회원가입 시 MOCA에 이미 가입된 경우 → ["MOCA"]
   * 클라이언트 앱은 이 값을 이용해 "이미 OO 앱에 가입된 계정입니다" 안내를 표시하세요.
   */
  linkedApps: AppName[];
  shipping_recipient?: string | null;
  shipping_phone?: string | null;
  shipping_zipcode?: string | null;
  shipping_address?: string | null;
  shipping_detail?: string | null;
  grade?: string;
  grade_locked?: boolean;
  grade_locked_reason?: string | null;
}

// ============================================================
// 내부 유틸
// ============================================================

/**
 * 휴대폰 번호를 마스킹합니다.
 * 예) "01012345678" → "010****5678"
 */
function maskPhoneNumber(phone: string): string {
  if (phone.length < 7) return phone;
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * 휴대폰 번호를 숫자만 남기도록 정규화합니다.
 * 예) "010-1234-5678" → "01012345678"
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ============================================================
// 핵심 함수: syncAndGetMasterUser
// ============================================================

/**
 * 타 앱(MOCA, IMFF)에서 로그인 시 마스터 계정과 동기화합니다.
 *
 * ## 동작 흐름
 * 1. phoneNumber 정규화 (숫자만 추출)
 * 2. master_users 테이블에서 해당 번호로 조회
 * 3. 계정이 없으면 신규 마스터 계정 생성
 * 4. app_user_mapping 테이블에 앱 매핑 정보를 upsert
 * 5. masterUserId + integratedPoints 반환
 *
 * ## 에러 처리
 * - DB 오류 발생 시 AuthError를 throw합니다.
 * - phoneNumber가 빈 문자열이면 즉시 에러를 throw합니다.
 *
 * @example
 * ```ts
 * // 서버 컴포넌트 또는 Route Handler에서 호출
 * const result = await syncAndGetMasterUser({
 *   phoneNumber: "01012345678",
 *   appName: "MOCA",
 *   localUserId: "moca_user_abc123",
 * });
 * console.log(result.masterUserId);      // "uuid-..."
 * console.log(result.integratedPoints);  // 1500
 * console.log(result.isNewUser);         // false
 * ```
 */
export async function syncAndGetMasterUser(
  params: SyncMasterUserParams
): Promise<SyncMasterUserResult> {
  const { appName, localUserId, name, realName, role, nickname } = params;
  const phoneNumber = normalizePhoneNumber(params.phoneNumber);

  // ── 입력 검증 ──────────────────────────────────────────────
  if (!phoneNumber) {
    throw new AuthError("phoneNumber는 필수입니다.", "INVALID_PHONE");
  }
  if (!["MOCA", "IMFF", "MODEL_BEAUTY"].includes(appName)) {
    throw new AuthError(
      `유효하지 않은 appName입니다: ${appName}. MOCA, IMFF, MODEL_BEAUTY 중 하나여야 합니다.`,
      "UNKNOWN"
    );
  }
  if (phoneNumber.length < 10 || phoneNumber.length > 11) {
    throw new AuthError(
      `유효하지 않은 휴대폰 번호 형식입니다: ${maskPhoneNumber(phoneNumber)}`,
      "INVALID_PHONE"
    );
  }

  // ── Supabase 서버 클라이언트 초기화 ────────────────────────
  const supabase = createAdminClient();

  // ── STEP 1: 기존 마스터 유저 조회 ──────────────────────────
  const { data: existingUser, error: selectError } = await supabase
    .from("master_users")
    .select("id, integrated_points, shipping_recipient, shipping_phone, shipping_zipcode, shipping_address, shipping_detail, grade, grade_locked, grade_locked_reason")
    .eq("phone_number", phoneNumber)
    .maybeSingle();           // 결과 없으면 null, 여러 개면 에러

  // 기존 유저가 있을 경우, 요청 앱 외에 이미 연동된 앱 목록을 조회합니다.
  // 이 목록은 클라이언트 앱이 "이미 OO 앱에 가입된 계정" 안내 메시지를 표시할 때 사용됩니다.

  if (selectError) {
    throw new AuthError(
      `마스터 유저 조회 중 오류가 발생했습니다: ${selectError.message}`,
      "DB_SELECT_ERROR",
      selectError
    );
  }

  // ── STEP 2: 신규 마스터 계정 생성 (없는 경우) ──────────────
  let masterUser: Pick<MasterUser, "id" | "integrated_points" | "grade" | "grade_locked" | "grade_locked_reason">;
  let isNewUser = false;
  let linkedApps: AppName[] = [];

  if (existingUser) {
    // 기존 유저 — 조회 결과 그대로 사용
    masterUser = existingUser;

    // 현재 요청 앱(appName)을 제외하고 이미 연동된 앱 목록 조회
    // 클라이언트가 "이미 OO 앱에 가입된 계정입니다" 메시지를 표시하는 데 사용합니다.
    const { data: existingMappings } = await supabase
      .from("app_user_mapping")
      .select("app_name")
      .eq("master_user_id", existingUser.id)
      .neq("app_name", appName);  // 현재 요청 앱은 제외

    linkedApps = (existingMappings ?? []).map((m) => m.app_name as AppName);
  } else {
    // 신규 유저 생성
    const displayName = name?.trim() || maskPhoneNumber(phoneNumber);

    const { data: createdUser, error: insertError } = await supabase
      .from("master_users")
      .insert({
        phone_number: phoneNumber,
        name: displayName,
        real_name: realName?.trim() || null,
        integrated_points: 0,
      })
      .select("id, integrated_points, grade, grade_locked, grade_locked_reason")
      .single();

    if (insertError || !createdUser) {
      throw new AuthError(
        `마스터 유저 생성 중 오류가 발생했습니다: ${insertError?.message ?? "알 수 없는 오류"}`,
        "DB_INSERT_ERROR",
        insertError ?? undefined
      );
    }

    masterUser = createdUser;
    isNewUser = true;
    linkedApps = [];  // 신규 유저는 연동 앱 없음
  }

  // 기존 유저인데 real_name이 없으면 업데이트 (모델뷰티 가입 시 채우기)
  if (!isNewUser && realName?.trim() && existingUser) {
    // real_name이 null인지 확인 후 업데이트 (타입 안전을 위해 any 캐스팅)
    const existingRealName = (existingUser as any).real_name;
    if (!existingRealName) {
      await supabase
        .from("master_users")
        .update({ real_name: realName.trim() })
        .eq("id", existingUser.id);
    }
  }

  // ── STEP 3: 앱 매핑 upsert ──────────────────────────────────
  // 충돌 기준: (master_user_id, app_name) UNIQUE 제약
  // 충돌 시 local_user_id, role, nickname을 최신값으로 갱신합니다.
  const { error: upsertError } = await supabase
    .from("app_user_mapping")
    .upsert(
      {
        master_user_id: masterUser.id,
        app_name: appName,
        local_user_id: localUserId,
        ...(role     !== undefined ? { role }     : {}),  // role이 전달된 경우만 저장
        ...(nickname !== undefined ? { nickname } : {}),  // nickname이 전달된 경우만 저장
      },
      {
        onConflict: "master_user_id,app_name",   // UNIQUE 제약 컬럼
        ignoreDuplicates: false,                  // 충돌 시 update 실행
      }
    );

  if (upsertError) {
    throw new AuthError(
      `앱 매핑 upsert 중 오류가 발생했습니다: ${upsertError.message}`,
      "DB_UPSERT_ERROR",
      upsertError
    );
  }

  // ── STEP 4: 결과 반환 ───────────────────────────────────────
  return {
    masterUserId: masterUser.id,
    integratedPoints: masterUser.integrated_points,
    isNewUser,
    linkedApps,  // 이미 연동된 앱 목록 (요청 앱 제외). 방안 B 안내 메시지에 사용.
    shipping_recipient: (masterUser as any).shipping_recipient ?? null,
    shipping_phone: (masterUser as any).shipping_phone ?? null,
    shipping_zipcode: (masterUser as any).shipping_zipcode ?? null,
    shipping_address: (masterUser as any).shipping_address ?? null,
    shipping_detail: (masterUser as any).shipping_detail ?? null,
    grade: masterUser.grade ?? "NORMAL",
    grade_locked: masterUser.grade_locked ?? false,
    grade_locked_reason: masterUser.grade_locked_reason ?? null,
  };
}

// ============================================================
// 신규 추가: 유저 정보 조회 및 업데이트 헬퍼
// ============================================================

/**
 * masterUserId로 마스터 유저 상세 정보를 조회합니다.
 */
export async function getMasterUserById(id: string): Promise<MasterUser> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("master_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new AuthError(
      `마스터 유저 조회 중 오류가 발생했습니다: ${error.message}`,
      "DB_SELECT_ERROR",
      error
    );
  }

  if (!data) {
    throw new AuthError(`해당 ID의 마스터 유저를 찾을 수 없습니다: ${id}`, "DB_SELECT_ERROR");
  }

  return data as MasterUser;
}

/**
 * 휴대폰 번호로 마스터 유저 상세 정보를 조회합니다.
 */
export async function getMasterUserByPhone(phone: string): Promise<MasterUser | null> {
  const normalized = normalizePhoneNumber(phone);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("master_users")
    .select("*")
    .eq("phone_number", normalized)
    .maybeSingle();

  if (error) {
    throw new AuthError(
      `마스터 유저 조회 중 오류가 발생했습니다: ${error.message}`,
      "DB_SELECT_ERROR",
      error
    );
  }

  return (data as MasterUser) || null;
}

/**
 * 마스터 유저의 정보를 업데이트합니다 (이름, 주소 등).
 */
export async function updateMasterUser(
  id: string,
  updateFields: Partial<Omit<MasterUser, "id" | "created_at" | "updated_at">>
): Promise<MasterUser> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("master_users")
    .update({
      ...updateFields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new AuthError(
      `마스터 유저 정보 업데이트 중 오류가 발생했습니다: ${error.message}`,
      "DB_UPSERT_ERROR",
      error
    );
  }

  return data as MasterUser;
}

// ============================================================
// 에러 클래스
// ============================================================

/** auth.ts 전용 에러 코드 */
export type AuthErrorCode =
  | "INVALID_PHONE"
  | "DB_SELECT_ERROR"
  | "DB_INSERT_ERROR"
  | "DB_UPSERT_ERROR"
  | "UNKNOWN";

/**
 * IM-CORE-AUTH 인증 에러
 *
 * @example
 * ```ts
 * try {
 *   await syncAndGetMasterUser({ ... });
 * } catch (err) {
 *   if (err instanceof AuthError) {
 *     console.error(err.code, err.message);
 *   }
 * }
 * ```
 */
export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly cause?: unknown;

  constructor(message: string, code: AuthErrorCode, cause?: unknown) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.cause = cause;

    // TypeScript에서 Error 상속 시 prototype 체인 복구 필요
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
