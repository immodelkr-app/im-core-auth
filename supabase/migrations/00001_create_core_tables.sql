-- ============================================================
-- IM-CORE-AUTH: 통합 인증 및 포인트 관리 시스템 스키마
-- 대상 앱: MOCA, IMFF, 모델뷰티
-- 생성일: 2026-06-24
-- ============================================================

-- ============================================================
-- 0. 확장 모듈 활성화
-- ============================================================
-- UUID 자동 생성을 위해 pgcrypto 또는 uuid-ossp 확장이 필요합니다.
-- Supabase에서는 기본 제공되는 gen_random_uuid()를 사용합니다.

-- ============================================================
-- 1. master_users — 통합 마스터 유저 테이블
-- ============================================================
-- 모든 앱(모카, IMFF, 모델뷰티)의 유저를 하나의 마스터 계정으로 통합합니다.
-- 휴대폰 번호를 기준으로 유저를 식별합니다 (Unique Key).
-- ============================================================
CREATE TABLE IF NOT EXISTS master_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number    TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  integrated_points INTEGER  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 휴대폰 번호는 통합 기준키이므로 유니크 제약 (자동으로 인덱스 생성)
  CONSTRAINT uq_master_users_phone_number UNIQUE (phone_number),

  -- 포인트는 음수가 될 수 없음
  CONSTRAINT chk_master_users_points_non_negative CHECK (integrated_points >= 0)
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_master_users_updated_at
  BEFORE UPDATE ON master_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  master_users IS '통합 마스터 유저 테이블 — 모든 앱의 유저를 하나로 관리';
COMMENT ON COLUMN master_users.phone_number IS '통합 기준키: 유저 식별용 휴대폰 번호';
COMMENT ON COLUMN master_users.integrated_points IS '모든 앱에서 통합 관리되는 포인트 잔액';


-- ============================================================
-- 2. app_user_mapping — 앱별 유저 매핑 테이블
-- ============================================================
-- 마스터 유저와 각 앱(MOCA, IMFF)의 로컬 유저 ID를 연결합니다.
-- 한 마스터 유저는 앱당 최대 하나의 로컬 계정만 매핑할 수 있습니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_user_mapping (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id  UUID        NOT NULL,
  app_name        TEXT        NOT NULL,
  local_user_id   TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 외래키: master_users 참조 (유저 삭제 시 매핑도 함께 삭제)
  CONSTRAINT fk_app_user_mapping_master_user
    FOREIGN KEY (master_user_id)
    REFERENCES master_users (id)
    ON DELETE CASCADE,

  -- 한 마스터 유저는 동일 앱에 하나의 로컬 ID만 매핑 가능
  CONSTRAINT uq_app_user_mapping_master_app UNIQUE (master_user_id, app_name),

  -- 동일 앱 내에서 로컬 유저 ID는 유일해야 함
  CONSTRAINT uq_app_user_mapping_app_local UNIQUE (app_name, local_user_id),

  -- 앱 이름 제한: MOCA 또는 IMFF
  CONSTRAINT chk_app_user_mapping_app_name CHECK (app_name IN ('MOCA', 'IMFF'))
);

COMMENT ON TABLE  app_user_mapping IS '앱별 유저 매핑 — 마스터 유저와 각 앱의 로컬 ID 연결';
COMMENT ON COLUMN app_user_mapping.app_name IS '앱 식별자: MOCA, IMFF';
COMMENT ON COLUMN app_user_mapping.local_user_id IS '각 앱 내부에서 사용하는 고유 유저 ID';


-- ============================================================
-- 3. point_transactions — 포인트 거래 내역 테이블
-- ============================================================
-- 포인트의 적립(earn) 및 사용(use) 내역을 기록합니다.
-- 어떤 앱에서 발생했는지, 금액과 설명을 함께 저장합니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS point_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id  UUID        NOT NULL,
  source_app      TEXT        NOT NULL,
  type            TEXT        NOT NULL,
  amount          INTEGER     NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 외래키: master_users 참조
  CONSTRAINT fk_point_transactions_master_user
    FOREIGN KEY (master_user_id)
    REFERENCES master_users (id)
    ON DELETE CASCADE,

  -- 거래 타입은 적립(earn) 또는 사용(use)만 허용
  CONSTRAINT chk_point_transactions_type CHECK (type IN ('earn', 'use')),

  -- 금액은 양수여야 함 (차감은 type으로 구분)
  CONSTRAINT chk_point_transactions_amount_positive CHECK (amount > 0),

  -- 발생 앱 제한
  CONSTRAINT chk_point_transactions_source_app CHECK (source_app IN ('MOCA', 'IMFF'))
);

COMMENT ON TABLE  point_transactions IS '포인트 거래 내역 — 적립/사용 이력 추적';
COMMENT ON COLUMN point_transactions.source_app IS '포인트 발생 앱: MOCA, IMFF';
COMMENT ON COLUMN point_transactions.type IS '거래 유형: earn(적립), use(사용)';
COMMENT ON COLUMN point_transactions.amount IS '거래 금액 (항상 양수, 차감은 type으로 구분)';


-- ============================================================
-- 4. coupon_master — 쿠폰 마스터 테이블
-- ============================================================
-- 시스템에서 발행할 수 있는 쿠폰의 원본 정보를 관리합니다.
-- 쿠폰 코드가 기본키(PK)이며, 할인 방식과 유효기간을 정의합니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS coupon_master (
  coupon_code     TEXT        PRIMARY KEY,
  coupon_name     TEXT        NOT NULL,
  discount_type   TEXT        NOT NULL,
  discount_value  INTEGER     NOT NULL,
  validity_days   INTEGER     NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 할인 타입: percent(퍼센트) 또는 fixed(정액)
  CONSTRAINT chk_coupon_master_discount_type CHECK (discount_type IN ('percent', 'fixed')),

  -- 할인값은 양수여야 함
  CONSTRAINT chk_coupon_master_discount_value_positive CHECK (discount_value > 0),

  -- 퍼센트 할인은 100을 초과할 수 없음
  CONSTRAINT chk_coupon_master_percent_max CHECK (
    discount_type != 'percent' OR discount_value <= 100
  ),

  -- 유효기간은 최소 1일
  CONSTRAINT chk_coupon_master_validity_positive CHECK (validity_days >= 1)
);

COMMENT ON TABLE  coupon_master IS '쿠폰 마스터 — 발행 가능한 쿠폰 원본 정보';
COMMENT ON COLUMN coupon_master.coupon_code IS '쿠폰 고유 코드 (기본키)';
COMMENT ON COLUMN coupon_master.discount_type IS '할인 방식: percent(%), fixed(원)';
COMMENT ON COLUMN coupon_master.discount_value IS '할인값 (percent면 %, fixed면 원 단위)';
COMMENT ON COLUMN coupon_master.validity_days IS '쿠폰 유효기간 (발급일로부터 일수)';
COMMENT ON COLUMN coupon_master.is_active IS '쿠폰 활성 상태 (비활성 시 신규 발급 불가)';


-- ============================================================
-- 5. user_coupons — 유저 보유 쿠폰 테이블
-- ============================================================
-- 마스터 유저에게 실제로 발급된 쿠폰을 추적합니다.
-- 사용 여부와 만료일을 관리합니다.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_coupons (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id  UUID        NOT NULL,
  coupon_code     TEXT        NOT NULL,
  is_used         BOOLEAN     NOT NULL DEFAULT false,
  used_at         TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 외래키: master_users 참조
  CONSTRAINT fk_user_coupons_master_user
    FOREIGN KEY (master_user_id)
    REFERENCES master_users (id)
    ON DELETE CASCADE,

  -- 외래키: coupon_master 참조
  CONSTRAINT fk_user_coupons_coupon_code
    FOREIGN KEY (coupon_code)
    REFERENCES coupon_master (coupon_code)
    ON DELETE RESTRICT,

  -- 사용된 쿠폰은 사용 시각이 기록되어야 함
  CONSTRAINT chk_user_coupons_used_at CHECK (
    (is_used = false AND used_at IS NULL) OR
    (is_used = true  AND used_at IS NOT NULL)
  )
);

COMMENT ON TABLE  user_coupons IS '유저 보유 쿠폰 — 발급된 쿠폰의 사용/만료 상태 관리';
COMMENT ON COLUMN user_coupons.is_used IS '사용 여부 (true = 사용 완료)';
COMMENT ON COLUMN user_coupons.used_at IS '쿠폰 사용 시각 (사용 시 자동 기록)';
COMMENT ON COLUMN user_coupons.expires_at IS '쿠폰 만료일 (발급일 + validity_days)';


-- ============================================================
-- 6. 인덱스 — 검색 성능 최적화
-- ============================================================

-- master_users: phone_number는 UNIQUE 제약으로 이미 인덱스가 자동 생성됨
-- 추가 인덱스: 이름 검색용
CREATE INDEX IF NOT EXISTS idx_master_users_name
  ON master_users (name);

-- app_user_mapping: master_user_id로 빠르게 해당 유저의 앱 매핑 조회
CREATE INDEX IF NOT EXISTS idx_app_user_mapping_master_user_id
  ON app_user_mapping (master_user_id);

-- app_user_mapping: 앱 이름 + 로컬 ID로 역방향 조회 (앱에서 마스터 유저 찾기)
-- UNIQUE 제약 uq_app_user_mapping_app_local로 이미 인덱스가 자동 생성됨

-- point_transactions: 유저별 거래 내역 조회 (최신순 정렬)
CREATE INDEX IF NOT EXISTS idx_point_transactions_master_user_id
  ON point_transactions (master_user_id, created_at DESC);

-- point_transactions: 앱별 거래 필터링
CREATE INDEX IF NOT EXISTS idx_point_transactions_source_app
  ON point_transactions (source_app);

-- user_coupons: 유저별 보유 쿠폰 조회
CREATE INDEX IF NOT EXISTS idx_user_coupons_master_user_id
  ON user_coupons (master_user_id);

-- user_coupons: 쿠폰 코드별 발급 현황 조회
CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon_code
  ON user_coupons (coupon_code);

-- user_coupons: 미사용 + 유효 쿠폰만 빠르게 조회 (Partial Index)
CREATE INDEX IF NOT EXISTS idx_user_coupons_active
  ON user_coupons (master_user_id, expires_at)
  WHERE is_used = false;


-- ============================================================
-- 7. Row Level Security (RLS) 활성화
-- ============================================================
-- Supabase에서는 RLS를 활성화하여 데이터 접근을 제어합니다.
-- 구체적인 정책(Policy)은 인증 로직 구현 시 추가합니다.
-- ============================================================
ALTER TABLE master_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user_mapping   ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_master      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 완료: 모든 테이블, 제약조건, 인덱스, RLS가 생성되었습니다.
-- ============================================================
