import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // ── 1. Supabase 세션 갱신 ──────────────────────────────────
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // ── 2. /admin 경로 보호 (로그인 페이지 제외) ──────────────
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginPage  = pathname === "/admin/login";

  if (isAdminRoute && !isLoginPage) {
    // 세션 확인을 위해 별도 클라이언트 생성
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // 미로그인 → 로그인 페이지로 리다이렉트
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname); // 로그인 후 원래 페이지로 복귀
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── 3. 이미 로그인 상태에서 /admin/login 접근 시 대시보드로 ─
  if (isLoginPage) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
