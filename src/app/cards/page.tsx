import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth-actions";

// 로그인한 사람의 정보를 읽어서 인사하는 부분
async function Welcome() {
  // 로그인 정보는 접속할 때마다 새로 확인해야 하므로, 미리 만들어 두지 말라고 알려 준다.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-4xl">☕</p>
      <p className="text-lg text-ink">
        <span className="font-bold">{user.email}</span>님,
        <br />
        환영해요!
      </p>
      <p className="text-sm text-ink-soft">명함 기능은 곧 이곳에 생겨요.</p>
    </div>
  );
}

export default function CardsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-8 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">내 명함</h1>
        <form action={logout}>
          <button type="submit" className="rounded-full bg-latte px-4 py-2 text-sm text-brand-dark">
            로그아웃
          </button>
        </form>
      </header>
      <div className="flex flex-1 items-center justify-center rounded-3xl bg-card p-8">
        <Suspense fallback={<p className="text-ink-soft">불러오는 중…</p>}>
          <Welcome />
        </Suspense>
      </div>
    </main>
  );
}
