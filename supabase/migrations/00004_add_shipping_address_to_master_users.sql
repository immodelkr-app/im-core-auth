-- ============================================================
-- IM-CORE-AUTH: master_users 테이블 기본 배송지 컬럼 추가
-- ============================================================

ALTER TABLE master_users
  ADD COLUMN IF NOT EXISTS shipping_recipient TEXT,
  ADD COLUMN IF NOT EXISTS shipping_phone TEXT,
  ADD COLUMN IF NOT EXISTS shipping_zipcode TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_detail TEXT;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN master_users.shipping_recipient IS '기본 배송지 수령인 이름';
COMMENT ON COLUMN master_users.shipping_phone IS '기본 배송지 수령인 연락처';
COMMENT ON COLUMN master_users.shipping_zipcode IS '기본 배송지 우편번호 (5자리)';
COMMENT ON COLUMN master_users.shipping_address IS '기본 배송지 도로명/지번 주소';
COMMENT ON COLUMN master_users.shipping_detail IS '기본 배송지 상세 주소';
