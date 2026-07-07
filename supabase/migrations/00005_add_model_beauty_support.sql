-- ============================================================
-- IM-CORE-AUTH: 로그인 방식 개선을 위한 스키마 업데이트
-- - master_users.real_name 컬럼 추가 (실명 저장)
-- - master_users.name UNIQUE 제약 추가 (닉네임 고유성)
-- - app_user_mapping, point_transactions에 MODEL_BEAUTY 허용
-- ============================================================

-- 1. master_users에 real_name 컬럼 추가 (실명, 닉네임 찾기용)
ALTER TABLE master_users
  ADD COLUMN IF NOT EXISTS real_name TEXT;

COMMENT ON COLUMN master_users.real_name IS '실명 (닉네임 찾기, 본인 확인용)';

-- 2. master_users.name UNIQUE 제약 추가 (닉네임은 전 앱에서 고유해야 함)
-- 기존 중복 데이터가 있을 경우 아래 ALTER가 실패할 수 있으므로 IF NOT EXISTS 패턴 사용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_master_users_name' AND conrelid = 'master_users'::regclass
  ) THEN
    ALTER TABLE master_users
      ADD CONSTRAINT uq_master_users_name UNIQUE (name);
  END IF;
END$$;

-- 3. app_user_mapping의 app_name 허용 목록에 MODEL_BEAUTY 추가
-- 기존 체크 제약 삭제 후 재생성
ALTER TABLE app_user_mapping
  DROP CONSTRAINT IF EXISTS chk_app_user_mapping_app_name;

ALTER TABLE app_user_mapping
  ADD CONSTRAINT chk_app_user_mapping_app_name
    CHECK (app_name IN ('MOCA', 'IMFF', 'MODEL_BEAUTY'));

-- 4. point_transactions의 source_app 허용 목록에 MODEL_BEAUTY 추가
ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS chk_point_transactions_source_app;

ALTER TABLE point_transactions
  ADD CONSTRAINT chk_point_transactions_source_app
    CHECK (source_app IN ('MOCA', 'IMFF', 'MODEL_BEAUTY'));

-- 완료
