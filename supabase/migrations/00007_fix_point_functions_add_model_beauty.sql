-- ============================================================
-- IM-CORE-AUTH: 포인트 함수 MODEL_BEAUTY 허용 앱 추가
-- 마이그레이션 순서: 00007
-- ============================================================
-- reward_user_point / use_user_point 함수에서
-- source_app 허용 목록에 MODEL_BEAUTY가 누락되어 있던 것을 수정합니다.
-- ============================================================

CREATE OR REPLACE FUNCTION reward_user_point(
  p_master_user_id  UUID,
  p_source_app      TEXT,
  p_amount          INTEGER,
  p_description     TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_id  UUID,
  new_balance     INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id  UUID;
  v_new_balance     INTEGER;
BEGIN
  -- ── 입력 검증 ─────────────────────────────────────────────
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount는 양수여야 합니다. 입력값: %', p_amount
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- MODEL_BEAUTY 포함하여 허용 앱 목록 갱신
  IF p_source_app NOT IN ('MOCA', 'IMFF', 'MODEL_BEAUTY') THEN
    RAISE EXCEPTION '허용되지 않는 앱 이름입니다: %. (허용: MOCA, IMFF, MODEL_BEAUTY)', p_source_app
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── STEP 1: 포인트 거래 내역 INSERT ──────────────────────
  INSERT INTO point_transactions (
    master_user_id,
    source_app,
    type,
    amount,
    description
  )
  VALUES (
    p_master_user_id,
    p_source_app,
    'earn',
    p_amount,
    p_description
  )
  RETURNING id INTO v_transaction_id;

  -- ── STEP 2: 통합 포인트 INCREMENT ────────────────────────
  UPDATE master_users
  SET integrated_points = integrated_points + p_amount
  WHERE id = p_master_user_id
  RETURNING integrated_points INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION '존재하지 않는 master_user_id입니다: %', p_master_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── STEP 3: 결과 반환 ─────────────────────────────────────
  RETURN QUERY SELECT v_transaction_id, v_new_balance;
END;
$$;


CREATE OR REPLACE FUNCTION use_user_point(
  p_master_user_id  UUID,
  p_source_app      TEXT,
  p_amount          INTEGER,
  p_description     TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_id  UUID,
  new_balance     INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_transaction_id  UUID;
  v_new_balance     INTEGER;
BEGIN
  -- ── 입력 검증 ─────────────────────────────────────────────
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount는 양수여야 합니다. 입력값: %', p_amount
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- MODEL_BEAUTY 포함하여 허용 앱 목록 갱신
  IF p_source_app NOT IN ('MOCA', 'IMFF', 'MODEL_BEAUTY') THEN
    RAISE EXCEPTION '허용되지 않는 앱 이름입니다: %. (허용: MOCA, IMFF, MODEL_BEAUTY)', p_source_app
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── STEP 1: 현재 잔액 조회 (SELECT FOR UPDATE로 행 잠금) ──
  SELECT integrated_points
  INTO v_current_balance
  FROM master_users
  WHERE id = p_master_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION '존재하지 않는 master_user_id입니다: %', p_master_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION '포인트 잔액이 부족합니다. 현재 잔액: %, 요청 차감액: %',
      v_current_balance, p_amount
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── STEP 2: 포인트 거래 내역 INSERT ──────────────────────
  INSERT INTO point_transactions (
    master_user_id,
    source_app,
    type,
    amount,
    description
  )
  VALUES (
    p_master_user_id,
    p_source_app,
    'use',
    p_amount,
    p_description
  )
  RETURNING id INTO v_transaction_id;

  -- ── STEP 3: 통합 포인트 DECREMENT ─────────────────────────
  UPDATE master_users
  SET integrated_points = integrated_points - p_amount
  WHERE id = p_master_user_id
  RETURNING integrated_points INTO v_new_balance;

  -- ── STEP 4: 결과 반환 ─────────────────────────────────────
  RETURN QUERY SELECT v_transaction_id, v_new_balance;
END;
$$;

COMMENT ON FUNCTION reward_user_point(UUID, TEXT, INTEGER, TEXT) IS
  '포인트 적립 트랜잭션 함수. 허용 앱: MOCA, IMFF, MODEL_BEAUTY';

COMMENT ON FUNCTION use_user_point(UUID, TEXT, INTEGER, TEXT) IS
  '포인트 차감 트랜잭션 함수. 허용 앱: MOCA, IMFF, MODEL_BEAUTY';

-- 보안 유지: 함수 권한 재설정
REVOKE ALL ON FUNCTION reward_user_point(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION use_user_point(UUID, TEXT, INTEGER, TEXT)    FROM PUBLIC, anon, authenticated;
