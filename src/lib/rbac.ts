// ============================================================
// IM-CORE-AUTH: RBAC (Role-Based Access Control) 유틸리티
//
// 어드민 역할은 Supabase Auth user.user_metadata.role 필드에 저장합니다.
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

/**
 * Supabase user 객체에서 어드민 역할을 추출합니다.
 * user_metadata.role 필드를 사용하며, 없으면 기본값 'viewer'를 반환합니다.
 */
export function getAdminRole(user: { user_metadata?: Record<string, unknown> } | null): AdminRole {
  if (!user) return "viewer";
  const role = user.user_metadata?.role;
  if (role === "super_admin" || role === "manager" || role === "viewer") {
    return role;
  }
  // role 미설정 어드민은 manager로 취급 (기존 계정 하위 호환성)
  return "manager";
}

/**
 * 현재 역할이 요구 최소 역할을 충족하는지 확인합니다.
 * @param currentRole - 현재 사용자의 역할
 * @param requiredRole - 요구되는 최소 역할
 */
export function hasRole(currentRole: AdminRole, requiredRole: AdminRole): boolean {
  return ROLE_PRIORITY[currentRole] >= ROLE_PRIORITY[requiredRole];
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
