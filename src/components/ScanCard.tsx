"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractCard } from "@/app/cards/actions";
import CardForm from "@/components/CardForm";
import { emptyCardFields, type CardFields } from "@/lib/card-fields";
import { rotateBlob, warpCard } from "@/lib/perspective";
import CornerAdjuster from "@/components/CornerAdjuster";
import { detectCardCorners, stopOpenCV, warmUpOpenCV } from "@/lib/opencv";

type Step = "pick" | "reading" | "adjust" | "preview" | "edit";

// 앞면·뒷면 한 장의 정보
type Side = {
  label: string;
  file: File; // 원본 사진
  url: string; // 원본 미리보기 주소
  path: string; // 보관함 위치
  corners: number[][]; // 손잡이 위치 [y, x] 비율 좌표
};

// OpenCV가 꼭짓점을 못 찾았을 때 손잡이의 처음 위치 (가장자리에서 10% 안쪽)
const DEFAULT_CORNERS = [
  [0.1, 0.1],
  [0.1, 0.9],
  [0.9, 0.9],
  [0.9, 0.1],
];

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
  const [sides, setSides] = useState<Side[]>([]);
  const [sideIndex, setSideIndex] = useState(0);
  const [warped, setWarped] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [warpError, setWarpError] = useState<string | null>(null);

  // 스캔 화면을 열자마자 보조 일꾼에게 OpenCV를 미리 준비시킨다 (화면은 멈추지 않는다)
  useEffect(() => {
    warmUpOpenCV();
  }, []);

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

    // 2) 동시에 두 가지: 서버(Gemini)는 글자 읽기, 브라우저(OpenCV)는 명함 꼭짓점 찾기
    const files = [front, ...(back ? [back] : [])];
    const findCorners = (file: File) =>
      Promise.race([
        detectCardCorners(file).catch((e) => {
          console.warn("꼭짓점 찾기 실패:", e);
          return null;
        }),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            stopOpenCV(); // 20초 넘으면 일꾼을 멈추고 포기
            resolve(null);
          }, 20_000),
        ),
      ]);
    const [result, detected] = await Promise.all([
      extractCard([uploaded.front, uploaded.back].filter(Boolean)),
      Promise.all(files.map(findCorners)),
    ]);
    const list = [
      { label: "앞면", file: front, path: uploaded.front },
      ...(back ? [{ label: "뒷면", file: back, path: uploaded.back }] : []),
    ];

    if ("error" in result) {
      setNotice(result.error);
      setFields(emptyCardFields());
    } else {
      setFields(result.fields);
      setNotice("AI가 읽은 내용이에요. 틀린 곳이 있으면 고쳐 주세요.");
    }

    // 3) 다음 화면: 사진마다 꼭짓점 맞추기 (OpenCV가 찾은 위치에서 시작)
    setSides(
      list.map((side, i) => ({
        ...side,
        url: URL.createObjectURL(side.file),
        corners: detected[i] ?? DEFAULT_CORNERS,
      })),
    );
    setSideIndex(0);
    setPreviews([]);
    setStep("adjust");
  }

  // 한 면을 끝내고 다음 면(또는 정보 확인 화면)으로
  function finishSide(previewUrl: string) {
    setPreviews((prev) => [...prev, previewUrl]);
    setWarped(null);
    if (sideIndex + 1 < sides.length) {
      setSideIndex(sideIndex + 1);
      setStep("adjust");
    } else {
      setStep("edit");
    }
  }

  // [반듯하게 펴기]
  async function handleApply(corners: number[][]) {
    const side = sides[sideIndex];
    setSides((prev) => prev.map((s, i) => (i === sideIndex ? { ...s, corners } : s)));
    setBusy(true);
    setWarpError(null);
    try {
      const blob = await warpCard(side.file, corners);
      setWarped({ blob, url: URL.createObjectURL(blob) });
      setStep("preview");
    } catch (e) {
      console.error(e);
      setWarpError("사진을 펴지 못했어요. 손잡이 위치를 확인하거나 원본을 써 주세요.");
    } finally {
      setBusy(false);
    }
  }

  // [↻ 돌리기]
  async function handleRotate() {
    if (!warped) return;
    setBusy(true);
    const blob = await rotateBlob(warped.blob, 90);
    setWarped({ blob, url: URL.createObjectURL(blob) });
    setBusy(false);
  }

  // [이 사진 쓰기]: 보관함의 사진을 펴진 사진으로 바꾼다
  async function handleUseWarped() {
    if (!warped) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("card-images")
      .upload(sides[sideIndex].path, warped.blob, { contentType: "image/jpeg", upsert: true });
    setBusy(false);
    if (error) {
      console.error(error);
      setNotice("보정한 사진을 저장하지 못해서 원본을 쓸게요.");
      finishSide(sides[sideIndex].url);
      return;
    }
    finishSide(warped.url);
  }

  if (step === "reading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="animate-bounce text-5xl">☕</span>
        <p className="text-lg text-ink">명함을 읽고 있어요…</p>
        <p className="text-sm text-ink-soft">보통 몇 초면 끝나요.</p>
      </div>
    );
  }

  if (step === "adjust" && sides[sideIndex]) {
    const side = sides[sideIndex];
    return (
      <div className="flex flex-col gap-3">
        {sides.length > 1 && (
          <p className="text-center text-sm font-medium text-brand">
            {side.label} ({sideIndex + 1}/{sides.length})
          </p>
        )}
        {warpError && (
          <p className="rounded-2xl bg-[#fbe3d6] px-4 py-3 text-sm text-[#9a4a2a]">{warpError}</p>
        )}
        <CornerAdjuster
          key={side.path}
          imageUrl={side.url}
          initial={side.corners}
          busy={busy}
          onApply={handleApply}
          onSkip={() => finishSide(side.url)}
        />
      </div>
    );
  }

  if (step === "preview" && warped) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-ink-soft">
          반듯하게 폈어요. 글자가 똑바로 보이지 않으면 <b className="text-ink">↻ 돌리기</b>를 눌러 주세요.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={warped.url} alt="펴진 명함" className="max-h-96 w-full rounded-2xl bg-latte object-contain" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep("adjust")}
            disabled={busy}
            className="flex-1 rounded-full bg-latte py-3 text-sm font-medium text-brand-dark disabled:opacity-60"
          >
            다시 맞추기
          </button>
          <button
            type="button"
            onClick={handleRotate}
            disabled={busy}
            className="flex-1 rounded-full bg-latte py-3 text-sm font-medium text-brand-dark disabled:opacity-60"
          >
            ↻ 돌리기
          </button>
        </div>
        <button
          type="button"
          onClick={handleUseWarped}
          disabled={busy}
          className="rounded-full bg-brand py-3 text-base font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "잠시만요…" : "이 사진 쓰기"}
        </button>
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
      <p className="text-center text-xs leading-relaxed text-ink-faint">
        💡 명함 네 모서리가 모두 보이게, 밝은 곳에서 찍으면 더 정확해요.
      </p>
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
