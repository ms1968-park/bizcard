"use client";

import { useRef, useState } from "react";

type Photo = { url: string; label: string };

// 명함 사진 보기: 앞면/뒷면 버튼으로 전환하거나, 폰에서는 옆으로 밀어서 전환
export default function CardPhotos({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const current = photos[index];
  const hasBack = photos.length > 1;

  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null || !hasBack) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) setIndex(dx < 0 ? Math.min(index + 1, photos.length - 1) : Math.max(index - 1, 0));
    touchX.current = null;
  }

  return (
    <div className="flex flex-col gap-3">
      {hasBack && (
        <div className="flex justify-center gap-2">
          {photos.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setIndex(i)}
              className={`rounded-full px-4 py-1.5 text-sm ${i === index ? "bg-brand text-white" : "bg-latte text-brand-dark"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <a
        href={current.url}
        target="_blank"
        rel="noreferrer"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
        className="block"
      >
        {/* 사진 전체가 보이도록(object-contain) 하고, 남는 곳은 라떼색으로 채운다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={`명함 ${current.label}`}
          className="max-h-80 w-full rounded-3xl bg-latte object-contain"
        />
      </a>

      <p className="text-center text-xs text-ink-faint">
        {hasBack ? "옆으로 밀거나 버튼을 눌러 앞·뒷면을 바꿔요. 사진을 누르면 크게 보여요" : "사진을 누르면 크게 볼 수 있어요"}
      </p>
    </div>
  );
}
