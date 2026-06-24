import { createClient } from "@supabase/supabase-js";

/**
 * 서비스 롤 키(Service Role Key)를 사용하여 RLS를 우회하는 관리자용 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 절대 클라이언트 측(브라우저)으로 노출되어서는 안 되며,
 * 서버 사이드 API Route, Server Actions, 또는 getStaticProps 등 서버 환경에서만 사용해야 합니다.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경 변수가 누락되었습니다.");
  }

  if (!supabaseServiceKey || supabaseServiceKey === "your-service-role-key-here") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경 변수가 누락되었거나 유효하지 않습니다.");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
