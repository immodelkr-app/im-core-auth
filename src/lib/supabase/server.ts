import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트, Server Actions, Route Handlers에서 사용하는 Supabase 클라이언트를 생성합니다.
 * 매 요청마다 새로운 클라이언트를 생성해야 합니다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출된 경우 set이 불가능할 수 있습니다.
            // Middleware에서 세션을 갱신하므로 무시해도 됩니다.
          }
        },
      },
    }
  );
}
