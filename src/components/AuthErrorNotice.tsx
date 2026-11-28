"use client";

import { useSearchParams } from "next/navigation";

// /login?error=confirm 처럼 돌아왔을 때 안내 문구
export default function AuthErrorNotice() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return (
    <p className="rounded-2xl bg-[#fbe3d6] px-4 py-3 text-center text-sm text-[#9a4a2a]">
      로그인을 마치지 못했어요. 링크가 만료됐거나 취소됐을 수 있어요. 다시 시도해 주세요.
    </p>
  );
}
