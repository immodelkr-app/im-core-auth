-- ============================================================
-- IM-CORE-AUTH: imBrain 제안서 초안
-- 생성일: 2026-11-24
-- Claude가 작성한 제안서 초안 기록. 공고가 지워져도 초안은 남도록 notice_title도 함께 저장.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brain_proposals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id     UUID        REFERENCES public.brain_notices(id) ON DELETE SET NULL,
  notice_title  TEXT        NOT NULL,
  memo          TEXT,
  content       TEXT        NOT NULL,
  model         TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_proposals_created_at ON public.brain_proposals(created_at DESC);

-- RLS 켜고 정책 없음 → 서버(service role)만 읽기/쓰기
ALTER TABLE public.brain_proposals ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.brain_proposals IS 'imBrain 제안서 초안 (Claude 생성)';
