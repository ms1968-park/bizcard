/* 보조 일꾼(Web Worker): 화면과 따로, 뒤에서 OpenCV로 명함 꼭짓점을 찾는다.
   화면을 그리는 일꾼과 분리되어 있어서, 여기서 오래 걸려도 화면은 멈추지 않는다. */
/* global cv */
importScripts("/opencv/opencv.js");

// OpenCV 준비가 끝날 때까지 기다리기
const ready = new Promise((resolve) => {
  const wait = () => (self.cv && self.cv.Mat ? resolve() : setTimeout(wait, 50));
  wait();
});

// ---------- 사각형 계산 도우미 ----------
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function area(q) {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
// 가장 넓은 사각형을 만드는 4점
function largestQuad(p) {
  let best = p.slice(0, 4), bestArea = -1;
  for (let a = 0; a < p.length; a++)
    for (let b = a + 1; b < p.length; b++)
      for (let c = b + 1; c < p.length; c++)
        for (let d = c + 1; d < p.length; d++) {
          const q = [p[a], p[b], p[c], p[d]];
          const s = area(q);
          if (s > bestArea) { bestArea = s; best = q; }
        }
  return best;
}
// 시계 방향 정렬 + 긴 변이 위쪽이 되도록 시작점 정하기
function orient(q) {
  const cx = q.reduce((s, p) => s + p.x, 0) / 4, cy = q.reduce((s, p) => s + p.y, 0) / 4;
  const cw = [...q].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const cand = [0, 1, 2, 3].filter((i) => dist(cw[i], cw[(i + 1) % 4]) >= dist(cw[(i + 1) % 4], cw[(i + 2) % 4]));
  const start = cand.sort((i, j) => cw[i].x + cw[i].y - (cw[j].x + cw[j].y))[0] || 0;
  return [...cw.slice(start), ...cw.slice(0, start)];
}

// ---------- 명함 찾기 ----------
function detect(imageData) {
  const W = imageData.width, H = imageData.height, A = W * H;
  const trash = [];
  const keep = (m) => (trash.push(m), m);
  try {
    // 1) "하얗고 색이 옅은" 부분 = 명함 종이
    const rgba = keep(cv.matFromImageData(imageData));
    const rgb = keep(new cv.Mat());
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    const hsv = keep(new cv.Mat());
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
    const ch = keep(new cv.MatVector());
    cv.split(hsv, ch);
    const S = keep(ch.get(1)), V = keep(ch.get(2));
    const tmp = keep(new cv.Mat());
    const otsu = cv.threshold(V, tmp, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU); // 밝기 기준 자동
    const sMask = keep(new cv.Mat()), vMask = keep(new cv.Mat()), base = keep(new cv.Mat());
    cv.threshold(S, sMask, 44, 255, cv.THRESH_BINARY_INV);
    cv.threshold(V, vMask, Math.max(otsu, 120), 255, cv.THRESH_BINARY);
    cv.bitwise_and(sMask, vMask, base);
    const k5 = keep(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)));
    cv.morphologyEx(base, base, cv.MORPH_CLOSE, k5, new cv.Point(-1, -1), 2); // 글자 구멍 메우기

    // 2) 붙어 있는 가는 것(하얀 슬리퍼 테두리 등)을 끊는 세기를 여러 가지로 시도
    let best = null;
    for (const ks of [1, 15, 25, 35, 45]) {
      let mask = base;
      if (ks > 1) {
        mask = keep(new cv.Mat());
        const k = keep(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(ks, ks)));
        cv.morphologyEx(base, mask, cv.MORPH_OPEN, k);
      }
      const contours = keep(new cv.MatVector()), hier = keep(new cv.Mat());
      cv.findContours(mask, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      for (let i = 0; i < contours.size(); i++) {
        const c = keep(contours.get(i));
        const cArea = cv.contourArea(c);
        if (cArea < 0.04 * A) continue;
        const hull = keep(new cv.Mat());
        cv.convexHull(c, hull, false, true);
        let pts = [];
        for (let j = 0; j < hull.data32S.length; j += 2) pts.push({ x: hull.data32S[j], y: hull.data32S[j + 1] });
        if (pts.length < 4) continue;
        if (pts.length > 40) { const step = Math.ceil(pts.length / 40); pts = pts.filter((_, j) => j % step === 0); }
        // 3) 점수: 사각형에 꼭 맞는지 + 명함 비율인지
        const quad = largestQuad(pts);
        const qa = area(quad);
        const fit = Math.min(cArea, qa) / Math.max(cArea, qa);
        const o = orient(quad);
        const w = (dist(o[0], o[1]) + dist(o[3], o[2])) / 2, h = (dist(o[0], o[3]) + dist(o[1], o[2])) / 2;
        const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
        const score = Math.sqrt(cArea / A) * fit ** 4 * (ratio >= 1.3 && ratio <= 2.3 ? 1 : 0.4);
        if (!best || score > best.score) best = { score, quad };
      }
    }
    if (!best || best.score < 0.1) return null;
    return orient(best.quad).map((p) => [p.y / H, p.x / W]); // [y, x] 비율 좌표
  } finally {
    for (const m of trash) { try { m.delete(); } catch (_) { /* 이미 지워짐 */ } }
  }
}

self.onmessage = async (e) => {
  const { id, imageData } = e.data;
  try {
    await ready;
    self.postMessage({ id, corners: imageData ? detect(imageData) : null });
  } catch (err) {
    self.postMessage({ id, corners: null, error: String(err) });
  }
};
