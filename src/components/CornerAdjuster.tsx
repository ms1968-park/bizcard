"use client";

import { useRef, useState } from "react";

type P = { x: number; y: number }; // 사진 크기를 0~1로 본 비율 좌표
type Props = {
  imageUrl: string;
  initial: number[][]; // [y, x] 점 4개: 좌상, 우상, 우하, 좌하
  onApply: (corners: number[][]) => void;
  onSkip: () => void;
  busy?: boolean;
};

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const LOUPE = 112; // 돋보기 크기(px)
const ZOOM = 3; // 돋보기 배율

// 사진 위에 손잡이 4개를 띄워서, 명함 꼭짓점을 손가락으로 맞추는 화면
export default function CornerAdjuster({ imageUrl, initial, onApply, onSkip, busy }: Props) {
  const [pts, setPts] = useState<P[]>(initial.map(([y, x]) => ({ x, y })));
  const [drag, setDrag] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const box = useRef<HTMLDivElement>(null);

  function startDrag(i: number, e: React.PointerEvent) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId); // 손가락이 손잡이 밖으로 나가도 계속 따라오게
    const r = box.current!.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    setDrag(i);
  }

  function onMove(e: React.PointerEvent) {
    if (drag === null || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width);
    const y = clamp((e.clientY - r.top) / r.height);
    setPts((prev) => prev.map((p, i) => (i === drag ? { x, y } : p)));
  }

  const active = drag !== null ? pts[drag] : null;
  // 돋보기는 손가락에 가리지 않도록, 끄는 점의 반대쪽 위 모서리에 띄운다
  const loupeOnRight = active ? active.x < 0.5 : true;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-ink-soft">
        동그란 손잡이 4개를 끌어서 <b className="text-ink">명함 모서리</b>에 맞춰 주세요.
      </p>

      <div
        ref={box}
        className="relative touch-none select-none overflow-hidden rounded-2xl"
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="찍은 사진" className="block h-auto w-full" draggable={false} />

        {/* 명함 테두리 사각형 */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
          <polygon
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="rgba(123,79,53,0.18)"
            stroke="#7b4f35"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* 손잡이 4개 */}
        {pts.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-label={`꼭짓점 ${i + 1}`}
            onPointerDown={(e) => startDrag(i, e)}
            className={`absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md ${
              drag === i ? "bg-brand" : "bg-brand/70"
            }`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          />
        ))}

        {/* 돋보기: 끄는 동안 손가락 아래를 크게 보여 준다 */}
        {active && size.w > 0 && (
          <div
            className="pointer-events-none absolute top-3 overflow-hidden rounded-full border-4 border-white shadow-lg"
            style={{
              width: LOUPE,
              height: LOUPE,
              [loupeOnRight ? "right" : "left"]: 12,
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: `${size.w * ZOOM}px ${size.h * ZOOM}px`,
              backgroundPosition: `${-(active.x * size.w * ZOOM - LOUPE / 2)}px ${-(active.y * size.h * ZOOM - LOUPE / 2)}px`,
            }}
          >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-brand" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-brand" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="flex-1 rounded-full bg-latte py-3 text-sm font-medium text-brand-dark disabled:opacity-60"
        >
          원본 그대로
        </button>
        <button
          type="button"
          onClick={() => onApply(pts.map((p) => [p.y, p.x]))}
          disabled={busy}
          className="flex-[2] rounded-full bg-brand py-3 text-base font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "펴는 중…" : "📐 반듯하게 펴기"}
        </button>
      </div>
    </div>
  );
}
