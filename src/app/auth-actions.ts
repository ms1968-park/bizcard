"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

// Supabase의 영어 오류 메시지를 한국어로 바꿔 준다.
function toKorean(message: string): string {
  if (message.includes("Invalid login credentials"))
    return "이메일 또는 비밀번호가 맞지 않아요.";
  if (message.includes("Email not confirmed"))
    return "메일함에서 인증 링크를 먼저 눌러 주세요.";
  if (message.includes("already registered"))
    return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (message.toLowerCase().includes("password"))
    return "비밀번호는 6자 이상으로 입력해 주세요.";
  if (message.toLowerCase().includes("rate limit"))
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

// 회원가입
export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상으로 입력해 주세요." };
  if (password !== passwordConfirm) return { error: "비밀번호가 서로 달라요." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) return { error: toKorean(error.message) };

  // 이미 가입된 이메일이면 Supabase는 오류 대신 빈 계정 정보를 돌려준다.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "이미 가입된 이메일이에요. 로그인해 주세요." };
  }

  // 이메일 인증이 꺼져 있으면 바로 로그인된 상태가 된다.
  if (data.session) redirect("/cards");

  return {
    message: `${email}로 인증 메일을 보냈어요. 메일함에서 링크를 눌러 가입을 마쳐 주세요.`,
  };
}

// 로그인
export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: toKorean(error.message) };

  redirect("/cards");
}

// 로그아웃
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// 비밀번호 재설정 메일 보내기
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "이메일을 입력해 주세요." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });

  if (error && error.message.toLowerCase().includes("rate limit")) {
    return { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." };
  }

  // 가입된 이메일인지 아닌지는 알려 주지 않는다. (누가 어떤 이메일로 가입했는지 캐내지 못하게)
  return {
    message: `${email}이(가) 가입된 이메일이라면 비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.`,
  };
}

// 새 비밀번호로 바꾸기 (재설정 메일의 링크를 눌러 들어온 상태에서)
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 6) return { error: "비밀번호는 6자 이상으로 입력해 주세요." };
  if (password !== passwordConfirm) return { error: "비밀번호가 서로 달라요." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return { error: "링크가 만료됐어요. 비밀번호 찾기를 다시 해 주세요." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.message.toLowerCase().includes("different")) {
      return { error: "이전과 다른 비밀번호를 입력해 주세요." };
    }
    return { error: toKorean(error.message) };
  }

  redirect("/cards");
}
