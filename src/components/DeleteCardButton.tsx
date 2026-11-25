"use client";

import { useState, useTransition } from "react";
import { deleteCard } from "@/app/cards/actions";

// 실수로 지우지 않도록 두 번 눌러야 삭제되는 버튼
export default function DeleteCardButton({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="w-full rounded-full py-3 text-sm text-[#9a4a2a]">
        명함 삭제
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-[#fbe3d6] p-4 text-center">
      <p className="text-sm text-[#9a4a2a]">정말 삭제할까요? 사진도 함께 지워지고 되돌릴 수 없어요.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAsking(false)} className="flex-1 rounded-full bg-card py-2 text-sm text-ink">
          취소
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteCard(id))}
          className="flex-1 rounded-full bg-[#9a4a2a] py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "삭제하는 중…" : "삭제"}
        </button>
      </div>
    </div>
  );
}
