// ============================================================
// IM-CORE-AUTH: RBAC (Role-Based Access Control) 유틸리티
//
// 어드민 역할은 Supabase Auth user.app_metadata.role 필드에 저장합니다 (서버만 수정 가능).
// 역할: super_admin > manager > viewer
// ============================================================

import { NextResponse } from "next/server";

/** 어드민 역할 타입 */
export type AdminRole = "super_admin" | "manager" | "viewer";

/** 역할 우선순위 (숫자가 클수록 권한이 높음) */
const ROLE_PRIORITY: Record<AdminRole, number> = {
  viewer: 1,
  manager: 2,
  super_admin: 3,
};

export const ADMIN_ROLES: AdminRole[] = ["super_admin", "manager", "viewer"];

/**
 * Supabase user 객체에서 어드민 역할을 추출합니다.
 * 반드시 app_metadata.role 사용: user_metadata 는 사용자가 직접 수정할 수 있어 권한 판단에 쓰면 안 됨.
 * 같은 Auth 를 모델뷰티 회원도 쓰므로, 역할이 없으면 어드민이 아님(null).
 */
export function getAdminRole(user: { app_metadata?: Record<string, unknown> } | null): AdminRole | null {
  const role = user?.app_metadata?.role;
  return ADMIN_ROLES.includes(role as AdminRole) ? (role as AdminRole) : null;
}

/**
 * 현재 역할이 요구 최소 역할을 충족하는지 확인합니다. 어드민이 아니면(null) 항상 false.
 */
export function hasRole(currentRole: AdminRole | null, requiredRole: AdminRole): boolean {
  return currentRole !== null && ROLE_PRIORITY[currentRole] >= ROLE_PRIORITY[requiredRole];
}

/**
 * 권한이 부족한 경우 403 응답을 반환합니다.
 * API Route 내에서 조기 반환(early return)에 사용합니다.
 */
export function forbiddenResponse(message = "이 작업을 수행할 권한이 없습니다.") {
  return NextResponse.json({ success: false, error: message, code: "FORBIDDEN" }, { status: 403 });
}

/**
 * 역할 한국어 라벨
 */
export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "슈퍼 관리자",
  manager: "매니저",
  viewer: "뷰어",
};

/**
 * 역할 배지 색상 스타일
 */
export const ROLE_BADGE_STYLE: Record<AdminRole, { bg: string; text: string }> = {
  super_admin: { bg: "rgba(124, 58, 237, 0.15)", text: "#7c3aed" },
  manager:     { bg: "rgba(59, 130, 246, 0.12)", text: "#1d4ed8" },
  viewer:      { bg: "rgba(107, 114, 128, 0.12)", text: "#4b5563" },
};
