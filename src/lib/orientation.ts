// 방향 자동 판단: "글자가 위를 향하는 쪽"의 변이 명함의 윗변이 되도록 꼭짓점 순서를 바꾼다.
// 그러면 원근 보정으로 펼 때 명함이 저절로 똑바로 선다.

type P = { x: number; y: number };

/**
 * @param corners  꼭짓점 4개 [y, x] (0~1 비율), 테두리를 따라 시계 방향
 * @param rotation 사진을 시계 방향으로 몇 도 돌려야 글자가 서는지 (Gemini가 알려 줌)
 * @param aspect   사진의 가로 ÷ 세로 (비율 좌표를 실제 모양대로 계산하려고)
 */
export function orientByText(corners: number[][], rotation: number, aspect: number): number[][] {
  const pts: P[] = corners.map(([y, x]) => ({ x: x * aspect, y }));

  // 사진 속에서 글자의 "위쪽" 방향
  // (사진을 시계 방향으로 r도 돌려야 똑바로 선다 = 글자의 위쪽은 화면 위쪽에서 반시계로 r도 돌아간 방향)
  const r = (rotation * Math.PI) / 180;
  const up = { x: -Math.sin(r), y: -Math.cos(r) };

  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;

  // 네 변 중에서 가운데에서 바라본 방향이 "위쪽"과 가장 비슷한 변을 윗변으로
  let bestStart = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < 4; k++) {
    const a = pts[k];
    const b = pts[(k + 1) % 4];
    const mx = (a.x + b.x) / 2 - cx;
    const my = (a.y + b.y) / 2 - cy;
    const len = Math.hypot(mx, my) || 1;
    const score = (mx * up.x + my * up.y) / len;
    if (score > bestScore) {
      bestScore = score;
      bestStart = k;
    }
  }
  return [...corners.slice(bestStart), ...corners.slice(0, bestStart)];
}

// 사진의 가로 ÷ 세로
export async function imageAspect(file: Blob): Promise<number> {
  const bitmap = await createImageBitmap(file);
  const aspect = bitmap.width / bitmap.height;
  bitmap.close();
  return aspect;
}
