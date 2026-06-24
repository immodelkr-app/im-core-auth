// ============================================================
// IM-CORE-AUTH: 감사 로그 (Audit Log) 유틸리티
//
// 어드민이 수행하는 민감한 조작을 admin_audit_logs 테이블에 기록합니다.
// 성공한 요청에 대해서만 호출합니다.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";

/** 감사 로그 조작 유형 (action) */
export type AuditAction =
  | "POINT_GRANT"         // 포인트 수동 지급
  | "POINT_DEDUCT"        // 포인트 수동 차감
  | "COUPON_CREATE"       // 쿠폰 생성
  | "COUPON_TOGGLE"       // 쿠폰 활성/비활성 토글
  | "ANNOUNCEMENT_CREATE" // 공지사항 생성
  | "ANNOUNCEMENT_UPDATE" // 공지사항 수정
  | "ANNOUNCEMENT_DELETE" // 공지사항 삭제
  | "ADMIN_CREATE"        // 어드민 계정 생성
  | "ADMIN_ROLE_CHANGE"   // 어드민 역할 변경
  | "ADMIN_DELETE";       // 어드민 계정 삭제

export interface LogAdminActionParams {
  adminEmail: string;
  adminId: string;
  action: AuditAction;
  targetType?: string;   // 예: "USER", "COUPON", "ANNOUNCEMENT", "ADMIN"
  targetId?: string;     // 예: UUID, 쿠폰 코드
  detail?: Record<string, unknown>;  // 금액, 변경 전/후 값 등
  ipAddress?: string;
}

/**
 * 어드민 조작 내역을 admin_audit_logs 테이블에 기록합니다.
 * 실패해도 main flow를 막지 않도록 에러를 조용히 처리합니다.
 */
export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("admin_audit_logs").insert({
      admin_email: params.adminEmail,
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      detail: params.detail ?? null,
      ip_address: params.ipAddress ?? null,
    });
  } catch (err) {
    // 감사 로그 실패가 실제 기능에 영향을 주면 안 됨
    console.error("[AuditLog] 기록 실패:", err);
  }
}

/**
 * Next.js Request 객체에서 클라이언트 IP를 추출합니다.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
