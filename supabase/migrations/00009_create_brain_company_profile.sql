-- ============================================================
-- IM-CORE-AUTH: imBrain 사업자 프로필
-- 생성일: 2026-11-24
-- 글로벌아임 1개 사업자 프로필만 저장 (id = 1 고정 단일 행).
-- 폼 필드는 profile JSONB에 그대로 저장 → 필드 추가 시 마이그레이션 불필요.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brain_company_profile (
  id          SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  profile     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 켜고 정책 없음 → anon/일반 키로는 접근 불가, 서버(service role)만 읽기/쓰기
ALTER TABLE public.brain_company_profile ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.brain_company_profile IS 'imBrain 사업자 프로필 (단일 행)';
COMMENT ON COLUMN public.brain_company_profile.profile IS '상호·대표·업종·지역·사업내용 등 프로필 폼 전체 (JSONB)';
