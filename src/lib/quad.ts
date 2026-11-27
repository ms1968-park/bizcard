// 명함 윤곽선(점 여러 개)에서 꼭짓점 4개를 계산한다.
// 결과: [y, x] 비율 좌표(0~1) 4개, 시계 방향, 가로로 긴 명함 기준 좌상단부터

export type XY = { x: number; y: number };

const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

// 볼록 껍질: 점들을 고무줄로 감쌌을 때 고무줄에 닿는 점들 (손가락에 파인 곳도 메워진다)
function convexHull(points: XY[]): XY[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: XY[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: XY[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function polygonArea(q: XY[]): number {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

// 껍질 위의 점 중에서 가장 넓은 사각형을 만드는 4개 = 명함 꼭짓점
export function largestQuad(hull: XY[]): XY[] {
  const n = hull.length;
  let best: XY[] = hull.slice(0, 4);
  let bestArea = -1;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const q = [hull[a], hull[b], hull[c], hull[d]];
          const s = polygonArea(q);
          if (s > bestArea) {
            bestArea = s;
            best = q;
          }
        }
  return best;
}

// 시계 방향으로 정렬하고, 첫 번째 변(좌상→우상)이 긴 변이 되도록 시작점을 정한다 (가로형 명함 기준)
export function orient(q: XY[]): XY[] {
  const cx = q.reduce((s, p) => s + p.x, 0) / 4;
  const cy = q.reduce((s, p) => s + p.y, 0) / 4;
  const cw = [...q].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const candidates = [0, 1, 2, 3].filter(
    (i) => dist(cw[i], cw[(i + 1) % 4]) >= dist(cw[(i + 1) % 4], cw[(i + 2) % 4]),
  );
  const start = candidates.sort((i, j) => cw[i].x + cw[i].y - (cw[j].x + cw[j].y))[0] ?? 0;
  return [...cw.slice(start), ...cw.slice(0, start)];
}

// 윤곽선 점들(0~1 비율 좌표) → 꼭짓점 4개 [y, x]
export function quadFromPoints(points: XY[]): number[][] | null {
  if (points.length < 4) return null;
  let hull = convexHull(points);
  if (hull.length < 4) return null;
  if (hull.length > 40) {
    const step = Math.ceil(hull.length / 40);
    hull = hull.filter((_, i) => i % step === 0);
  }
  const quad = orient(largestQuad(hull));
  return quad.map((p) => [Math.min(1, Math.max(0, p.y)), Math.min(1, Math.max(0, p.x))]);
}
