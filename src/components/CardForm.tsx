"use client";

import { useActionState, useState } from "react";
import { saveCard } from "@/app/cards/actions";
import { CARD_FIELDS, type CardFields } from "@/lib/card-fields";

const inputClass =
  "w-full rounded-2xl bg-card px-4 py-3 text-base text-ink outline-none ring-1 ring-latte placeholder:text-ink-faint focus:ring-2 focus:ring-brand";

type Props = {
  initial: CardFields;
  initialTags?: string;
  initialMemo?: string;
  cardId?: string; // 있으면 "수정", 없으면 "새로 추가"
  imagePath?: string;
  imageBackPath?: string;
  notice?: string | null;
};

// 명함 정보 입력 양식 (스캔 후 확인할 때, 수정할 때 함께 쓴다)
export default function CardForm({
  initial,
  initialTags = "",
  initialMemo = "",
  cardId,
  imagePath = "",
  imageBackPath = "",
  notice,
}: Props) {
  const [fields, setFields] = useState<CardFields>(initial);
  const [state, action, pending] = useActionState(saveCard, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {notice && <p className="rounded-2xl bg-latte px-4 py-3 text-sm text-brand-dark">{notice}</p>}

      {cardId && <input type="hidden" name="id" value={cardId} />}
      <input type="hidden" name="image_path" value={imagePath} />
      <input type="hidden" name="image_back_path" value={imageBackPath} />

      {CARD_FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="px-1 text-sm text-ink-soft">{f.label}</span>
          <input
            name={f.key}
            type={f.type}
            value={fields[f.key]}
            onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
            className={inputClass}
          />
        </label>
      ))}

      <label className="flex flex-col gap-1">
        <span className="px-1 text-sm text-ink-soft">그룹·태그 (쉼표로 구분)</span>
        <input name="tags" defaultValue={initialTags} placeholder="거래처, 박람회" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="px-1 text-sm text-ink-soft">메모</span>
        <textarea name="memo" rows={3} defaultValue={initialMemo} placeholder="11월 박람회에서 만남" className={inputClass} />
      </label>

      {state?.error && (
        <p className="rounded-2xl bg-[#fbe3d6] px-4 py-3 text-sm text-[#9a4a2a]">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand py-3 text-base font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "저장하는 중…" : cardId ? "수정 완료" : "명함 저장"}
      </button>
    </form>
  );
}
