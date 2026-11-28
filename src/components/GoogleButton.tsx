"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// "Google로 계속하기" 버튼
// 누르면 구글 로그인 화면으로 갔다가, 로그인이 끝나면 /auth/confirm 으로 돌아온다.
export default function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) {
      console.error(error);
      setError("구글 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setPending(false);
    }
    // 성공하면 브라우저가 구글 화면으로 이동하므로 여기서 할 일은 없다
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full bg-card py-3 text-base font-medium text-ink ring-1 ring-latte hover:ring-brand disabled:opacity-60"
      >
        {pending ? "구글로 이동하는 중…" : "Google로 계속하기"}
      </button>
      {error && <p className="rounded-2xl bg-[#fbe3d6] px-4 py-3 text-sm text-[#9a4a2a]">{error}</p>}
    </div>
  );
}
