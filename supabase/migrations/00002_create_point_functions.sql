-- ============================================================
-- IM-CORE-AUTH: 포인트 지급 트랜잭션 함수
-- 마이그레이션 순서: 00002 (00001 스키마 생성 이후 실행)
-- ============================================================
--
-- 핵심 설계 원칙:
--   JS 클라이언트(supabase-js)로는 BEGIN/COMMIT을 직접 제어할 수 없습니다.
--   따라서 INSERT(point_transactions) + UPDATE(master_users.integrated_points)
--   두 작업을 하나의 PostgreSQL 함수로 감싸 DB 레벨에서 원자성을 보장합니다.
--
--   호출 방법: supabase.rpc('reward_user_point', { ... })
-- ============================================================

-- ============================================================
-- 함수 1. reward_user_point — 포인트 적립 (earn)
-- ============================================================
-- 역할:
--   1) point_transactions 에 적립 내역 INSERT
--   2) master_users.integrated_points 를 amount 만큼 INCREMENT
--   3) 갱신된 잔액(new_balance)과 생성된 트랜잭션 ID 반환
--
-- 오류 처리:
--   - master_user_id 가 존재하지 않으면 EXCEPTION 발생 → 전체 롤백
--   - amount 가 0 이하이면 EXCEPTION 발생 → 전체 롤백
--   - CHECK 제약(integrated_points >= 0) 위반 시 자동 롤백
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
SECURITY DEFINER   -- RLS를 우회하고 함수 소유자 권한으로 실행 (서버 전용)
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

  IF p_source_app NOT IN ('MOCA', 'IMFF') THEN
    RAISE EXCEPTION '허용되지 않는 앱 이름입니다: %. (허용: MOCA, IMFF)', p_source_app
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

  -- ── STEP 2: 통합 포인트 INCREMENT + 신규 잔액 취득 ────────
  -- UPDATE ... RETURNING 으로 갱신된 값을 단일 쿼리에서 읽습니다.
  -- (SELECT 후 UPDATE 패턴은 race condition 위험이 있으므로 사용하지 않습니다)
  UPDATE master_users
  SET integrated_points = integrated_points + p_amount
  WHERE id = p_master_user_id
  RETURNING integrated_points INTO v_new_balance;

  -- master_user_id 가 존재하지 않으면 UPDATE 대상이 없어 v_new_balance 가 NULL
  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION '존재하지 않는 master_user_id입니다: %', p_master_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── STEP 3: 결과 반환 ─────────────────────────────────────
  RETURN QUERY SELECT v_transaction_id, v_new_balance;
END;
$$;

-- 함수 설명
COMMENT ON FUNCTION reward_user_point(UUID, TEXT, INTEGER, TEXT) IS
  '포인트 적립 트랜잭션 함수. point_transactions INSERT + master_users.integrated_points UPDATE를 원자적으로 처리합니다.';


-- ============================================================
-- 함수 2. use_user_point — 포인트 차감 (use)
-- ============================================================
-- 역할:
--   1) 잔액 충분한지 먼저 확인 (잔액 부족 시 롤백)
--   2) point_transactions 에 차감 내역 INSERT
--   3) master_users.integrated_points 를 amount 만큼 DECREMENT
--   4) 갱신된 잔액과 트랜잭션 ID 반환
--
-- 참고: points.ts의 deductUserPoint() 에서 사용합니다.
-- ============================================================
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

  IF p_source_app NOT IN ('MOCA', 'IMFF') THEN
    RAISE EXCEPTION '허용되지 않는 앱 이름입니다: %. (허용: MOCA, IMFF)', p_source_app
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── STEP 1: 현재 잔액 조회 (SELECT FOR UPDATE로 행 잠금) ──
  -- 동시 요청이 들어왔을 때 이중 차감을 방지합니다.
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

COMMENT ON FUNCTION use_user_point(UUID, TEXT, INTEGER, TEXT) IS
  '포인트 차감 트랜잭션 함수. 잔액 확인(FOR UPDATE 행 잠금) + point_transactions INSERT + master_users.integrated_points UPDATE를 원자적으로 처리합니다.';


-- ============================================================
-- 보안: 익명 클라이언트에서 직접 RPC 호출 차단
-- ============================================================
-- SECURITY DEFINER 함수는 anon/authenticated role이 직접 호출하지 못하도록
-- 명시적으로 REVOKE 후 서버 전용(service_role)만 허용합니다.
-- 실제 호출은 Service Role Key를 사용하는 서버 사이드에서만 이루어집니다.
REVOKE ALL ON FUNCTION reward_user_point(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION use_user_point(UUID, TEXT, INTEGER, TEXT)    FROM PUBLIC, anon, authenticated;
