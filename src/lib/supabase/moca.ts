import { createClient } from "@supabase/supabase-js";

/**
 * MOCA 앱 Supabase 클라이언트 (서버 전용)
 * 등급 등 MOCA 앱 고유 데이터를 실시간 조회할 때 사용합니다.
 * MOCA DB의 소유권은 MOCA 앱에 있으며, im-core-auth는 읽기 전용으로 사용합니다.
 */
export function createMocaClient() {
  const url = process.env.MOCA_SUPABASE_URL;
  const key = process.env.MOCA_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("MOCA_SUPABASE_URL 또는 MOCA_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.");
  }

  return createClient(url, key);
}
