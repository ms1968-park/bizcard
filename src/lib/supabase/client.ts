import { createBrowserClient } from "@supabase/ssr";

// 브라우저(프론트엔드)에서 Supabase와 대화할 때 쓰는 연결 도구
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
