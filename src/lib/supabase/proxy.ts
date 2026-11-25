import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 로그인이 필요한 주소들
const PROTECTED = ["/cards"];
// 이미 로그인했다면 다시 볼 필요 없는 주소들
const AUTH_PAGES = ["/login", "/signup"];

// 모든 요청이 화면에 도착하기 전에 거치는 "입구 직원".
// 1) 손목 밴드(출입증)가 낡았으면 새것으로 갈아 주고
// 2) 밴드 없이 /cards에 오면 /login으로 돌려보낸다.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 손목 밴드(JWT)의 도장을 그 자리에서 확인한다. (매번 Supabase에 물어보지 않아서 빠르다)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/cards";
    return NextResponse.redirect(url);
  }

  return response;
}
