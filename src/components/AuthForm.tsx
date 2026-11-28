"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth-actions";
import GoogleButton from "@/components/GoogleButton";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

const inputClass =
  "w-full rounded-2xl bg-card px-4 py-3 text-base text-ink outline-none ring-1 ring-latte placeholder:text-ink-faint focus:ring-2 focus:ring-brand";

// 로그인과 회원가입이 함께 쓰는 입력 양식
export default function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isSignup = mode === "signup";

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
    <div className="flex flex-col gap-5">
      <GoogleButton />
      <div className="flex items-center gap-3 text-sm text-ink-faint">
        <span className="h-px flex-1 bg-latte" />
        또는 이메일로
        <span className="h-px flex-1 bg-latte" />
      </div>
    <form action={formAction} className="flex flex-col gap-3">
      <input name="email" type="email" required autoComplete="email" placeholder="이메일" className={inputClass} />
      <input
        name="password"
        type="password"
        required
        minLength={6}
        autoComplete={isSignup ? "new-password" : "current-password"}
        placeholder={isSignup ? "비밀번호 (6자 이상)" : "비밀번호"}
        className={inputClass}
      />
      {isSignup && (
        <input
          name="passwordConfirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="비밀번호 확인"
          className={inputClass}
        />
      )}

      {state?.error && (
        <p className="rounded-2xl bg-[#fbe3d6] px-4 py-3 text-sm text-[#9a4a2a]">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand py-3 text-base font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "잠시만요…" : isSignup ? "가입하기" : "로그인"}
      </button>

      {!isSignup && (
        <Link href="/forgot-password" className="text-center text-sm text-ink-soft underline">
          비밀번호를 잊으셨나요?
        </Link>
      )}

      <p className="mt-2 text-center text-sm text-ink-soft">
        {isSignup ? "이미 계정이 있나요? " : "처음 오셨나요? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-brand underline">
          {isSignup ? "로그인" : "회원가입"}
        </Link>
      </p>
    </form>
    </div>
  );
}
