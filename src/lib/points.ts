// ============================================================
// IM-CORE-AUTH: 포인트 지급/차감 로직
//
// 역할: 유저 활동(프로필 완성, 대회 신청 등)에 따라 포인트를 지급하거나
//       차감합니다. 데이터 일관성은 DB 레벨 PostgreSQL 함수(RPC)로 보장합니다.
//
// 설계 원칙:
//   supabase-js 클라이언트는 BEGIN/COMMIT을 직접 지원하지 않습니다.
//   따라서 INSERT(point_transactions) + UPDATE(master_users.integrated_points)
//   두 작업을 PostgreSQL 함수(reward_user_point / use_user_point)로 위임하여
//   DB 레벨에서 원자적으로 처리합니다.
//   → 마이그레이션: supabase/migrations/00002_create_point_functions.sql
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { AppName } from "@/types/database";

// ============================================================
// 공개 타입
// ============================================================

/** rewardUserPoint / deductUserPoint 공통 입력 파라미터 */
export interface PointActionParams {
  /** 마스터 유저 UUID (syncAndGetMasterUser 반환값 활용) */
  masterUserId: string;
  /** 포인트 발생 앱 */
  appSource: AppName;
  /** 지급/차감할 포인트 금액 (양수, 최소 1) */
  amount: number;
  /** 포인트 내역 설명 (예: "프로필 완성 보상", "대회 신청 차감") */
  description?: string;
}

/** rewardUserPoint / deductUserPoint 반환값 */
export interface PointActionResult {
  /** 생성된 point_transactions 레코드 UUID */
  transactionId: string;
  /** 트랜잭션 처리 후 갱신된 통합 포인트 잔액 */
  newBalance: number;
}

// ============================================================
// RPC 응답 내부 타입 (supabase.rpc 반환값 매핑용)
// ============================================================
interface RpcPointResult {
  transaction_id: string;
  new_balance: number;
}

// ============================================================
// 핵심 함수 1: rewardUserPoint — 포인트 적립 (earn)
// ============================================================

/**
 * 유저 활동에 대한 포인트를 지급합니다.
 *
 * ## 내부 동작 (DB 레벨 원자 트랜잭션)
 * 1. `reward_user_point` PostgreSQL RPC 함수 호출
 * 2. RPC 내부에서 `point_transactions` INSERT (type='earn')
 * 3. RPC 내부에서 `master_users.integrated_points` += amount
 * 4. 하나라도 실패하면 DB가 자동으로 전체 롤백
 *
 * ## 지급 사유 예시
 * - 앱 프로필 완성: `description: "프로필 완성 보상"`
 * - 대회 신청 완료: `description: "IMFF 2026 S/S 대회 신청 보상"`
 * - 출석 체크:      `description: "일일 출석 체크"`
 *
 * @throws {PointError} DB 오류, 잘못된 파라미터, 없는 유저
 *
 * @example
 * ```ts
 * const result = await rewardUserPoint({
 *   masterUserId: "uuid-...",
 *   appSource: "MOCA",
 *   amount: 500,
 *   description: "프로필 완성 보상",
 * });
 * console.log(result.newBalance);     // 1500
 * console.log(result.transactionId);  // "uuid-..."
 * ```
 */
export async function rewardUserPoint(
  params: PointActionParams
): Promise<PointActionResult> {
  validatePointParams(params);

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("reward_user_point", {
    p_master_user_id: params.masterUserId,
    p_source_app:     params.appSource,
    p_amount:         params.amount,
    p_description:    params.description ?? null,
  });

  if (error) {
    throw new PointError(
      buildErrorMessage("포인트 적립", params, error.message),
      classifyRpcError(error.message),
      error
    );
  }

  const row = extractSingleRow(data);
  return {
    transactionId: row.transaction_id,
    newBalance:    row.new_balance,
  };
}

// ============================================================
// 핵심 함수 2: deductUserPoint — 포인트 차감 (use)
// ============================================================

/**
 * 유저의 통합 포인트를 차감합니다.
 *
 * ## 내부 동작 (DB 레벨 원자 트랜잭션)
 * 1. `use_user_point` PostgreSQL RPC 함수 호출
 * 2. RPC 내부에서 잔액 확인 (`SELECT FOR UPDATE` — 행 잠금으로 동시 차감 방지)
 * 3. 잔액 부족 시 DB가 즉시 롤백 후 에러 반환
 * 4. 충분하면 `point_transactions` INSERT (type='use')
 * 5. `master_users.integrated_points` -= amount
 *
 * @throws {PointError} 잔액 부족(`INSUFFICIENT_BALANCE`), DB 오류, 없는 유저
 *
 * @example
 * ```ts
 * try {
 *   const result = await deductUserPoint({
 *     masterUserId: "uuid-...",
 *     appSource: "IMFF",
 *     amount: 1000,
 *     description: "IMFF 프리미엄 응모권 구매",
 *   });
 *   console.log(result.newBalance); // 500
 * } catch (err) {
 *   if (err instanceof PointError && err.code === "INSUFFICIENT_BALANCE") {
 *     // 잔액 부족 UI 처리
 *   }
 * }
 * ```
 */
export async function deductUserPoint(
  params: PointActionParams
): Promise<PointActionResult> {
  validatePointParams(params);

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("use_user_point", {
    p_master_user_id: params.masterUserId,
    p_source_app:     params.appSource,
    p_amount:         params.amount,
    p_description:    params.description ?? null,
  });

  if (error) {
    throw new PointError(
      buildErrorMessage("포인트 차감", params, error.message),
      classifyRpcError(error.message),
      error
    );
  }

  const row = extractSingleRow(data);
  return {
    transactionId: row.transaction_id,
    newBalance:    row.new_balance,
  };
}

// ============================================================
// 조회 함수: getPointBalance — 현재 잔액 조회
// ============================================================

/**
 * 마스터 유저의 현재 통합 포인트 잔액을 조회합니다.
 *
 * @throws {PointError} 존재하지 않는 유저
 *
 * @example
 * ```ts
 * const balance = await getPointBalance("uuid-...");
 * console.log(balance); // 1500
 * ```
 */
export async function getPointBalance(masterUserId: string): Promise<number> {
  if (!masterUserId) {
    throw new PointError("masterUserId는 필수입니다.", "INVALID_PARAMS");
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("master_users")
    .select("integrated_points")
    .eq("id", masterUserId)
    .maybeSingle();

  if (error) {
    throw new PointError(
      `포인트 잔액 조회 실패: ${error.message}`,
      "DB_ERROR",
      error
    );
  }

  if (!data) {
    throw new PointError(
      `존재하지 않는 마스터 유저입니다: ${masterUserId}`,
      "USER_NOT_FOUND"
    );
  }

  return data.integrated_points;
}

// ============================================================
// 조회 함수: getPointHistory — 거래 내역 조회
// ============================================================

/** getPointHistory 필터 옵션 */
export interface PointHistoryOptions {
  /** 한 번에 가져올 최대 건수 (기본: 20, 최대: 100) */
  limit?: number;
  /** 페이지네이션: 건너뛸 건수 */
  offset?: number;
  /** 특정 앱의 내역만 필터링 */
  appSource?: AppName;
  /** 적립/차감 중 하나만 필터링 */
  type?: "earn" | "use";
}

/**
 * 마스터 유저의 포인트 거래 내역을 최신순으로 조회합니다.
 *
 * @example
 * ```ts
 * const history = await getPointHistory("uuid-...", { limit: 10, type: "earn" });
 * ```
 */
export async function getPointHistory(
  masterUserId: string,
  options: PointHistoryOptions = {}
) {
  if (!masterUserId) {
    throw new PointError("masterUserId는 필수입니다.", "INVALID_PARAMS");
  }

  const limit  = Math.min(options.limit  ?? 20, 100);
  const offset = options.offset ?? 0;

  const supabase = createAdminClient();

  let query = supabase
    .from("point_transactions")
    .select("id, source_app, type, amount, description, created_at")
    .eq("master_user_id", masterUserId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options.appSource) query = query.eq("source_app", options.appSource);
  if (options.type)      query = query.eq("type", options.type);

  const { data, error } = await query;

  if (error) {
    throw new PointError(
      `포인트 내역 조회 실패: ${error.message}`,
      "DB_ERROR",
      error
    );
  }

  return data ?? [];
}

// ============================================================
// 내부 유틸
// ============================================================

/** 공통 파라미터 검증 */
function validatePointParams(params: PointActionParams): void {
  if (!params.masterUserId) {
    throw new PointError("masterUserId는 필수입니다.", "INVALID_PARAMS");
  }
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new PointError(
      `amount는 1 이상의 정수여야 합니다. 입력값: ${params.amount}`,
      "INVALID_PARAMS"
    );
  }
}

/** RPC 반환 배열에서 첫 번째 행을 안전하게 추출 */
function extractSingleRow(data: unknown): RpcPointResult {
  if (!Array.isArray(data) || data.length === 0 || !data[0]) {
    throw new PointError(
      "RPC 함수가 예상된 결과를 반환하지 않았습니다.",
      "DB_ERROR"
    );
  }
  return data[0] as RpcPointResult;
}

/** 에러 메시지 조합 */
function buildErrorMessage(
  action: string,
  params: PointActionParams,
  detail: string
): string {
  return `${action} 실패 [앱: ${params.appSource}, 금액: ${params.amount}pt]: ${detail}`;
}

/** PostgreSQL 에러 메시지로 PointErrorCode 분류 */
function classifyRpcError(message: string): PointErrorCode {
  const m = message.toLowerCase();
  if (m.includes("insufficient") || m.includes("잔액"))  return "INSUFFICIENT_BALANCE";
  if (m.includes("no_data_found") || m.includes("존재하지")) return "USER_NOT_FOUND";
  if (m.includes("invalid_parameter") || m.includes("양수")) return "INVALID_PARAMS";
  return "DB_ERROR";
}

// ============================================================
// 에러 클래스
// ============================================================

/** points.ts 전용 에러 코드 */
export type PointErrorCode =
  | "INVALID_PARAMS"       // 잘못된 입력값 (음수 금액 등)
  | "USER_NOT_FOUND"       // 존재하지 않는 masterUserId
  | "INSUFFICIENT_BALANCE" // 잔액 부족 (차감 시)
  | "DB_ERROR";            // DB / RPC 일반 오류

/**
 * IM-CORE-AUTH 포인트 에러
 *
 * @example
 * ```ts
 * } catch (err) {
 *   if (err instanceof PointError) {
 *     switch (err.code) {
 *       case "INSUFFICIENT_BALANCE": return res.status(402).json({ message: "잔액 부족" });
 *       case "USER_NOT_FOUND":       return res.status(404).json({ message: "유저 없음" });
 *       default:                     return res.status(500).json({ message: "서버 오류" });
 *     }
 *   }
 * }
 * ```
 */
export class PointError extends Error {
  public readonly code: PointErrorCode;
  public readonly cause?: unknown;

  constructor(message: string, code: PointErrorCode, cause?: unknown) {
    super(message);
    this.name  = "PointError";
    this.code  = code;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
