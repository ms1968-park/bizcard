import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 서버(백엔드)에서 Supabase와 대화할 때 쓰는 연결 도구.
// 로그인 출입증(세션)은 브라우저 쿠키에 담겨 오가므로, 쿠키를 읽고 쓰는 방법을 알려 준다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 화면을 그리는 중(Server Component)에는 쿠키를 쓸 수 없다.
            // 출입증 갱신은 나중에 만들 proxy가 맡으므로 여기서는 무시해도 된다.
          }
        },
      },
    },
  );
}
