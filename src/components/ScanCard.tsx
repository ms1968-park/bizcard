"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractCard } from "@/app/cards/actions";
import CardForm from "@/components/CardForm";
import { emptyCardFields, type CardFields } from "@/lib/card-fields";
import { warpCard } from "@/lib/perspective";

type Step = "pick" | "reading" | "edit";

// 사진을 가로·세로 최대 1600px의 JPEG로 줄인다. (빠르게 올리고, 5MB 제한도 지키기)
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/jpeg", 0.85),
    );
  } catch {
    return file; // 줄이기에 실패하면 원본 그대로
  }
}

function PhotoSlot({
  label,
  hint,
  file,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const preview = file ? URL.createObjectURL(file) : null;
  return (
    <label className="flex cursor-pointer flex-col gap-2">
      <span className="text-sm font-medium text-ink">
        {label} <span className="font-normal text-ink-soft">{hint}</span>
      </span>
      <div className="flex aspect-[1.75] items-center justify-center overflow-hidden rounded-3xl bg-card ring-1 ring-latte">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-ink-faint">
            <span className="text-3xl">📷</span>
            <span className="text-sm">눌러서 촬영하거나 사진 고르기</span>
          </span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export default function ScanCard() {
  const [step, setStep] = useState<Step>("pick");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [paths, setPaths] = useState<{ front: string; back: string }>({ front: "", back: "" });
  const [fields, setFields] = useState<CardFields>(emptyCardFields());
  const [notice, setNotice] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  // 사진 올리기 → AI로 읽기
  async function handleRead() {
    if (!front) return;
    setStep("reading");
    setNotice(null);

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getClaims();
    const userId = auth?.claims?.sub;
    if (!userId) {
      setNotice("다시 로그인해 주세요.");
      setStep("pick");
      return;
    }

    // 1) 사진 보관함에 올리기: card-images/내ID/무작위이름.jpg
    async function upload(file: File, side: string) {
      const blob = await shrinkImage(file);
      const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg");
      const path = `${userId}/${crypto.randomUUID()}-${side}.${ext}`;
      const { error } = await supabase.storage
        .from("card-images")
        .upload(path, blob, { contentType: blob.type || "image/jpeg" });
      if (error) throw error;
      return path;
    }

    let uploaded: { front: string; back: string };
    try {
      uploaded = {
        front: await upload(front, "front"),
        back: back ? await upload(back, "back") : "",
      };
    } catch (e) {
      console.error(e);
      setNotice("사진을 올리지 못했어요. 다시 시도해 주세요.");
      setStep("pick");
      return;
    }
    setPaths(uploaded);

    // 2) 서버에 "이 사진들 읽어 줘" 요청
    const result = await extractCard([uploaded.front, uploaded.back].filter(Boolean));
    const sides = [
      { file: front, path: uploaded.front },
      ...(back ? [{ file: back, path: uploaded.back }] : []),
    ];

    if ("error" in result) {
      setNotice(result.error);
      setFields(emptyCardFields());
      setPreviews(sides.map((s) => URL.createObjectURL(s.file)));
    } else {
      setFields(result.fields);
      setNotice("AI가 읽은 내용이에요. 틀린 곳이 있으면 고쳐 주세요.");

      // 3) 명함 부분만 똑바로 펴서, 보관함의 사진을 보정한 사진으로 바꾸기
      const urls: string[] = [];
      for (const [i, side] of sides.entries()) {
        const crop = result.crops[i];
        // 꼭짓점을 찾았으면 원근 보정으로 펴기 (실패하면 원래 사진 그대로)
        const cropped = crop ? await warpCard(side.file, crop.corners).catch(() => null) : null;
        if (cropped) {
          const { error } = await supabase.storage
            .from("card-images")
            .upload(side.path, cropped, { contentType: "image/jpeg", upsert: true });
          urls.push(URL.createObjectURL(error ? side.file : cropped));
        } else {
          urls.push(URL.createObjectURL(side.file));
        }
      }
      setPreviews(urls);
    }
    setStep("edit");
  }

  if (step === "reading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="animate-bounce text-5xl">☕</span>
        <p className="text-lg text-ink">명함을 읽고 다듬는 중이에요…</p>
        <p className="text-sm text-ink-soft">보통 몇 초면 끝나요.</p>
      </div>
    );
  }

  if (step === "edit") {
    return (
      <div className="flex flex-col gap-4">
        {previews.length > 0 && (
          <div className="flex gap-2">
            {previews.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={i === 0 ? "앞면" : "뒷면"}
                className="max-h-40 min-w-0 flex-1 rounded-2xl bg-latte object-contain"
              />
            ))}
          </div>
        )}
        <CardForm initial={fields} imagePath={paths.front} imageBackPath={paths.back} notice={notice} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PhotoSlot label="앞면" hint="(필수)" file={front} onPick={setFront} />
      <PhotoSlot label="뒷면" hint="(선택)" file={back} onPick={setBack} />
      {notice && (
        <p className="rounded-2xl bg-[#fbe3d6] px-4 py-3 text-sm text-[#9a4a2a]">{notice}</p>
      )}
      <button
        type="button"
        onClick={handleRead}
        disabled={!front}
        className="rounded-full bg-brand py-3 text-base font-medium text-white hover:bg-brand-dark disabled:opacity-40"
      >
        AI로 명함 읽기
      </button>
    </div>
  );
}
