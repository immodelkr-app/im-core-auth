import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { createServerClient } from "@supabase/ssr";
import { getAdminRole } from "@/lib/rbac";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin") || "*";

  // ── CORS OPTIONS (Preflight) 처리 ──────────────────────────
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-secret, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // ── 1. Supabase 세션 갱신 ──────────────────────────────────
  const response = await updateSession(request);

  // ── 2. /admin 페이지 + /api/admin API 보호 (로그인 페이지 제외) ──
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi   = pathname.startsWith("/api/admin");
  const isLoginPage  = pathname === "/admin/login";

  if ((isAdminRoute || isAdminApi) && !isLoginPage) {
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
    // 같은 Auth를 모델뷰티 회원도 쓰므로 "로그인됨"이 아니라 "어드민 역할 있음"을 확인
    const isAdmin = getAdminRole(user) !== null;

    if (!isAdmin && isAdminApi) {
      // API는 리다이렉트 대신 401/403 (서비스 키로 회원 정보를 읽는 라우트들이라 반드시 차단)
      return user
        ? NextResponse.json({ success: false, error: "어드민 권한이 없습니다.", code: "FORBIDDEN" }, { status: 403 })
        : NextResponse.json({ success: false, error: "로그인이 필요합니다.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!isAdmin) {
      // 미로그인/비어드민 → 로그인 페이지로 리다이렉트
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname); // 로그인 후 원래 페이지로 복귀
      if (user) loginUrl.searchParams.set("error", "not_admin");
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

    if (getAdminRole(user) !== null) { // 비어드민까지 보내면 /admin ↔ /admin/login 무한 리다이렉트
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // ── 4. CORS 헤더 추가 (API 요청인 경우) ───────────────────
  if (pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-secret, Authorization");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
