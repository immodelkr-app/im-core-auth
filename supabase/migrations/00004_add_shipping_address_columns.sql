-- ============================================================
-- IM-CORE-AUTH: 기본 배송지 컬럼 추가 마이그레이션
-- 대상 테이블: master_users
-- 생성일: 2026-07-04
-- ============================================================

ALTER TABLE master_users
  ADD COLUMN IF NOT EXISTS shipping_recipient TEXT,
  ADD COLUMN IF NOT EXISTS shipping_phone     TEXT,
  ADD COLUMN IF NOT EXISTS shipping_zipcode   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_detail    TEXT;

COMMENT ON COLUMN master_users.shipping_recipient IS '기본 배송지 수령인 이름';
COMMENT ON COLUMN master_users.shipping_phone IS '기본 배송지 수령인 연락처';
COMMENT ON COLUMN master_users.shipping_zipcode IS '기본 배송지 우편번호 (5자리)';
COMMENT ON COLUMN master_users.shipping_address IS '기본 배송지 주소';
COMMENT ON COLUMN master_users.shipping_detail IS '기본 배송지 상세 주소';
