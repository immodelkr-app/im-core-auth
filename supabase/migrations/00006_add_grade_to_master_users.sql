-- ============================================================
-- IM-CORE-AUTH: master_users 테이블 통합 등급 관련 컬럼 추가
-- ============================================================

ALTER TABLE master_users
  ADD COLUMN IF NOT EXISTS grade TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS grade_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grade_locked_reason TEXT DEFAULT null;

-- 허용 등급 CHECK 제약 조건 추가
ALTER TABLE master_users
  DROP CONSTRAINT IF EXISTS chk_master_users_grade;

ALTER TABLE master_users
  ADD CONSTRAINT chk_master_users_grade 
  CHECK (grade IN ('NORMAL', 'SILVER', 'GOLD', 'IMODEL', 'VIP'));

-- 컬럼 코멘트 추가
COMMENT ON COLUMN master_users.grade IS '통합 회원 등급 (NORMAL, SILVER, GOLD, IMODEL, VIP)';
COMMENT ON COLUMN master_users.grade_locked IS '등급 자동 변경 방지 잠금 여부';
COMMENT ON COLUMN master_users.grade_locked_reason IS '등급 잠금 처리 사유';
