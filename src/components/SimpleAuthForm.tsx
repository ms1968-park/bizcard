"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth-actions";

const inputClass =
  "w-full rounded-2xl bg-card px-4 py-3 text-base text-ink outline-none ring-1 ring-latte placeholder:text-ink-faint focus:ring-2 focus:ring-brand";

type Props = {
  kind: "forgot" | "reset";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

// 비밀번호 찾기 / 새 비밀번호 설정 양식
export default function SimpleAuthForm({ kind, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.message) {
    return (
      <div className="flex flex-col gap-4 rounded-3xl bg-card p-6 text-center">
        <p className="text-4xl">📬</p>
        <p className="leading-relaxed text-ink">{state.message}</p>
        <Link href="/login" className="text-sm text-brand underline">
          로그인 화면으로
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {kind === "forgot" ? (
        <>
          <p className="text-center text-sm text-ink-soft">가입한 이메일을 입력하면 재설정 링크를 보내 드려요.</p>
          <input name="email" type="email" required autoComplete="email" placeholder="이메일" className={inputClass} />
        </>
      ) : (
        <>
          <input name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="새 비밀번호 (6자 이상)" className={inputClass} />
          <input name="passwordConfirm" type="password" required minLength={6} autoComplete="new-password" placeholder="새 비밀번호 확인" className={inputClass} />
        </>
      )}

      {state?.error && (
        <p className="rounded-2xl bg-[#fbe3d6] px-4 py-3 text-sm text-[#9a4a2a]">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand py-3 text-base font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "잠시만요…" : kind === "forgot" ? "재설정 메일 받기" : "비밀번호 바꾸기"}
      </button>

      <Link href="/login" className="mt-2 text-center text-sm text-ink-soft">
        로그인 화면으로
      </Link>
    </form>
  );
}
