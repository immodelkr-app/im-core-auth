-- ============================================================
-- IM-CORE-AUTH: 어드민 감사 로그 (Admin Audit Logs) 스키마
-- 생성일: 2026-07-22
-- 어드민이 수행하는 모든 민감 조작 내역을 기록하는 테이블입니다.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email  TEXT        NOT NULL,
  admin_id     TEXT        NOT NULL,
  action       TEXT        NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  detail       JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 검색 및 필터링 성능 최적화를 위한 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action 
  ON public.admin_audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_email 
  ON public.admin_audit_logs(admin_email);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at 
  ON public.admin_audit_logs(created_at DESC);

-- ============================================================
-- 테이블 및 컬럼 주석
-- ============================================================
COMMENT ON TABLE  public.admin_audit_logs IS '어드민 조작 내역 감사 로그 테이블';
COMMENT ON COLUMN public.admin_audit_logs.admin_email IS '조작을 수행한 어드민 이메일';
COMMENT ON COLUMN public.admin_audit_logs.admin_id IS '조작을 수행한 어드민 ID (UUID 등)';
COMMENT ON COLUMN public.admin_audit_logs.action IS '조작 유형 (POINT_GRANT, COUPON_CREATE 등)';
COMMENT ON COLUMN public.admin_audit_logs.target_type IS '조작 대상 유형 (USER, COUPON, ANNOUNCEMENT 등)';
COMMENT ON COLUMN public.admin_audit_logs.target_id IS '조작 대상 식별자 ID';
COMMENT ON COLUMN public.admin_audit_logs.detail IS '상세 변경 내용 (JSONB)';
COMMENT ON COLUMN public.admin_audit_logs.ip_address IS '요청 클라이언트 IP 주소';
COMMENT ON COLUMN public.admin_audit_logs.created_at IS '로그 발생 일시';

-- ============================================================
-- RLS (Row Level Security) 설정
-- ============================================================
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- service_role (백엔드 어드민 클라이언트) 전용 정책
CREATE POLICY "Enable all operations for service_role"
  ON public.admin_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
