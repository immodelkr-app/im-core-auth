-- ============================================================
-- IM-CORE-AUTH: imBrain 지원사업 공고
-- 생성일: 2026-11-24
-- K-Startup(창업진흥원) 등 공공 API에서 수집한 공고. (source, external_id)로 중복 없이 갱신.
-- 접수 상태(접수중/마감임박/마감)는 deadline으로 화면에서 계산하므로 저장하지 않음.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brain_notices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT        NOT NULL,             -- 'kstartup' | 'bizinfo'
  external_id   TEXT        NOT NULL,             -- 원본 공고 번호
  title         TEXT        NOT NULL,
  org           TEXT,
  region        TEXT,
  category      TEXT,
  apply_start   DATE,
  deadline      DATE,
  amount        TEXT,
  target        TEXT,                             -- 신청 대상
  url           TEXT,
  description   TEXT,
  match_score   SMALLINT    NOT NULL DEFAULT 0,
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_brain_notices_deadline ON public.brain_notices(deadline);

-- RLS 켜고 정책 없음 → 서버(service role)만 읽기/쓰기
ALTER TABLE public.brain_notices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.brain_notices IS 'imBrain 지원사업 공고 (공공 API 수집)';
