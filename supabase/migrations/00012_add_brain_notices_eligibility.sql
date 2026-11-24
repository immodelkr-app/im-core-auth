-- ============================================================
-- IM-CORE-AUTH: imBrain 공고 업력 조건
-- 생성일: 2026-11-24
-- K-Startup biz_enyy(업력 조건) 원문과, 사업자 개업일 기준 충족 여부를 저장.
-- ============================================================

ALTER TABLE public.brain_notices
  ADD COLUMN IF NOT EXISTS biz_age  TEXT,     -- 예: "1년미만,3년미만,7년미만"
  ADD COLUMN IF NOT EXISTS eligible BOOLEAN;  -- 업력 충족 여부 (개업일 모르면 NULL)
