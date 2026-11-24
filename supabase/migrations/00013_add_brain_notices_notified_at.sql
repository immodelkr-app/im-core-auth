-- ============================================================
-- IM-CORE-AUTH: imBrain 안산 공고 문자 알림 기록
-- 생성일: 2026-11-24
-- 문자로 알린 시각. NULL 이면 아직 안 알림 → 매일 자동 수집 후 대상이면 발송.
-- ============================================================

ALTER TABLE public.brain_notices
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
