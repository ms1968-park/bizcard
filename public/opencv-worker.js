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

// ---------- 색 변환: RGB → Lab (사람 눈에 가까운 색 거리) ----------
// OpenCV 8비트 규칙에 맞춘다: L 0~255, a·b는 128이 가운데
function toLab(rgba, n) {
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  for (let i = 0; i < n; i++) {
    const r = lin(rgba[i * 4] / 255), g = lin(rgba[i * 4 + 1] / 255), bl = lin(rgba[i * 4 + 2] / 255);
    const x = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + bl * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const fx = f(x), fy = f(y), fz = f(z);
    L[i] = (116 * fy - 16) * 2.55;
    A[i] = 500 * (fx - fy) + 128;
    B[i] = 200 * (fy - fz) + 128;
  }
  return { L, A, B };
}

// ---------- 퍼져 나가기(flood fill): 시작점과 비슷한 색으로 이어진 곳을 모두 칠한다 ----------
function floodFill(lab, W, H, sx, sy, tol) {
  const n = W * H, out = new Uint8Array(n), queue = new Int32Array(n);
  const s = sy * W + sx, l0 = lab.L[s], a0 = lab.A[s], b0 = lab.B[s];
  const ok = (i) => Math.abs(lab.L[i] - l0) <= tol && Math.abs(lab.A[i] - a0) <= tol && Math.abs(lab.B[i] - b0) <= tol;
  let head = 0, tail = 0;
  out[s] = 255; queue[tail++] = s;
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0;
    if (x > 0 && !out[i - 1] && ok(i - 1)) { out[i - 1] = 255; queue[tail++] = i - 1; }
    if (x < W - 1 && !out[i + 1] && ok(i + 1)) { out[i + 1] = 255; queue[tail++] = i + 1; }
    if (y > 0 && !out[i - W] && ok(i - W)) { out[i - W] = 255; queue[tail++] = i - W; }
    if (y < H - 1 && !out[i + W] && ok(i + W)) { out[i + W] = 255; queue[tail++] = i + W; }
  }
  return out;
}

// ---------- 명함 찾기 ----------
function detect(imageData) {
  const W = imageData.width, H = imageData.height, A = W * H;
  const trash = [];
  const keep = (m) => (trash.push(m), m);
  try {
    const rgba = keep(cv.matFromImageData(imageData));
    const k5 = keep(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)));
    let best = null;

    // 마스크(칠해진 영역) 하나에서 "명함다운 사각형" 후보를 찾아 점수를 매긴다
    function addCandidates(base, weight, kernels) {
      for (const ks of kernels) {
        let mask = base;
        if (ks > 1) {
          mask = keep(new cv.Mat());
          const k = keep(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(ks, ks)));
          cv.morphologyEx(base, mask, cv.MORPH_OPEN, k); // 가는 연결(슬리퍼 테두리 등) 끊기
        }
        const contours = keep(new cv.MatVector()), hier = keep(new cv.Mat());
        cv.findContours(mask, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        for (let i = 0; i < contours.size(); i++) {
          const c = keep(contours.get(i));
          const cArea = cv.contourArea(c);
          if (cArea < 0.04 * A || cArea > 0.9 * A) continue;
          const hull = keep(new cv.Mat());
          cv.convexHull(c, hull, false, true);
          let pts = [];
          for (let j = 0; j < hull.data32S.length; j += 2) pts.push({ x: hull.data32S[j], y: hull.data32S[j + 1] });
          if (pts.length < 4) continue;
          if (pts.length > 40) { const step = Math.ceil(pts.length / 40); pts = pts.filter((_, j) => j % step === 0); }
          // 점수: 사각형에 꼭 맞는지 + 명함 비율인지 + 크기
          const quad = largestQuad(pts);
          const qa = area(quad);
          const fit = Math.min(cArea, qa) / Math.max(cArea, qa);
          const o = orient(quad);
          const w = (dist(o[0], o[1]) + dist(o[3], o[2])) / 2, h = (dist(o[0], o[3]) + dist(o[1], o[2])) / 2;
          const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
          const score = Math.sqrt(cArea / A) * fit ** 4 * (ratio >= 1.3 && ratio <= 2.3 ? 1 : 0.4) * weight;
          if (!best || score > best.score) best = { score, quad };
        }
      }
    }

    // 방법 1) "하얗고 색이 옅은" 부분 = 흰 명함 종이
    const rgb = keep(new cv.Mat());
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    const hsv = keep(new cv.Mat());
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
    const ch = keep(new cv.MatVector());
    cv.split(hsv, ch);
    const S = keep(ch.get(1)), V = keep(ch.get(2));
    const tmp = keep(new cv.Mat());
    const otsu = cv.threshold(V, tmp, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU); // 밝기 기준 자동
    const sMask = keep(new cv.Mat()), vMask = keep(new cv.Mat()), white = keep(new cv.Mat());
    cv.threshold(S, sMask, 44, 255, cv.THRESH_BINARY_INV);
    cv.threshold(V, vMask, Math.max(otsu, 120), 255, cv.THRESH_BINARY);
    cv.bitwise_and(sMask, vMask, white);
    cv.morphologyEx(white, white, cv.MORPH_CLOSE, k5, new cv.Point(-1, -1), 2); // 글자 구멍 메우기
    addCandidates(white, 1.0, [1, 15, 25, 35, 45]);

    // 방법 2) 사진 가운데 근처 9곳에서 "비슷한 색으로 퍼져 나가기"
    //  → 어두운 명함, 색깔 있는 명함도 찾을 수 있다 (명함 테두리에서 색이 확 바뀌면 거기서 멈춘다)
    const blurred = new Uint8ClampedArray(imageData.data.length);
    {
      // 5x5 상자 흐림: 종이의 작은 얼룩·글자 가장자리 때문에 끊기지 않게
      const src = imageData.data, r = 2;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let sr = 0, sg = 0, sb = 0, cnt = 0;
          for (let dy = -r; dy <= r; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -r; dx <= r; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= W) continue;
              const k = (yy * W + xx) * 4;
              sr += src[k]; sg += src[k + 1]; sb += src[k + 2]; cnt++;
            }
          }
          const o = (y * W + x) * 4;
          blurred[o] = sr / cnt; blurred[o + 1] = sg / cnt; blurred[o + 2] = sb / cnt; blurred[o + 3] = 255;
        }
    }
    const lab = toLab(blurred, A);
    for (const fy of [0.35, 0.5, 0.65])
      for (const fx of [0.35, 0.5, 0.65]) {
        const filled = floodFill(lab, W, H, Math.round(W * fx), Math.round(H * fy), 12);
        const m = keep(new cv.Mat(H, W, cv.CV_8UC1));
        m.data.set(filled);
        cv.morphologyEx(m, m, cv.MORPH_CLOSE, k5, new cv.Point(-1, -1), 2);
        addCandidates(m, 0.95, [1, 15, 25, 35]);
      }

    if (!best || best.score < 0.1) return null;
    return orient(best.quad).map((p) => [p.y / H, p.x / W]); // [y, x] 비율 좌표
  } finally {
    for (const m of trash) { try { m.delete(); } catch (_) { /* 이미 지워짐 */ } }
  }
}

// ================= 2단계: Gemini가 알려 준 "대략적인 상자"로 다시 확인하기 =================
// 사진 속에 명함과 비슷한 색·무늬가 많으면(어두운 매트 위의 어두운 명함 등) 1단계가 엉뚱한 곳을 잡는다.
// Gemini는 꼭짓점은 부정확하지만 "명함이 대충 어디 있는지(상자)"는 잘 안다.
//  ① 1단계 결과가 그 상자와 잘 겹치면 → 1단계 결과를 그대로 쓴다
//  ② 아니면 → 상자 안에서 GrabCut(전경/배경 분리)으로 명함 모양을 새로 찾는다
//  마지막으로 네 변을 "밝기가 확 바뀌는 선"에 딱 붙인다(snap).

const cwOrder = (q) => {
  const cx = q.reduce((s, p) => s + p.x, 0) / q.length, cy = q.reduce((s, p) => s + p.y, 0) / q.length;
  return [...q].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
};
const bboxOf = (q) => ({
  x0: Math.min(...q.map((p) => p.x)), y0: Math.min(...q.map((p) => p.y)),
  x1: Math.max(...q.map((p) => p.x)), y1: Math.max(...q.map((p) => p.y)),
});
function iou(a, b) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const I = ix * iy;
  return I / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - I);
}
// 점 p1에서 방향 d1인 직선과, p2에서 방향 d2인 직선이 만나는 점
function intersect(p1, d1, p2, d2) {
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}
// 네 직선(변)의 교점 = 새 꼭짓점. 너무 많이 움직이면 실패로 보고 null
function cornersFromLines(lines, old, maxMove) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const p = intersect(lines[(i + 3) % 4].p, lines[(i + 3) % 4].d, lines[i].p, lines[i].d);
    if (!p || dist(p, old[i]) > maxMove) return null;
    out.push(p);
  }
  return out;
}

// 둥근 모서리 대책: 테두리 점들 중 각 변 가운데 부분에 가까운 점들로 직선을 다시 맞춘다
function sideFit(quad, pts) {
  const q = cwOrder(quad), lines = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], L = dist(a, b) || 1;
    const t = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, n = { x: -t.y, y: t.x };
    let sx = 0, sy = 0, cnt = 0;
    const sel = [];
    for (const p of pts) {
      const rx = p.x - a.x, ry = p.y - a.y, along = (rx * t.x + ry * t.y) / L;
      if (along > 0.15 && along < 0.85 && Math.abs(rx * n.x + ry * n.y) < 6) { sel.push(p); sx += p.x; sy += p.y; cnt++; }
    }
    if (cnt < 5) { lines.push({ p: a, d: t }); continue; }
    const mx = sx / cnt, my = sy / cnt;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of sel) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    lines.push({ p: { x: mx, y: my }, d: { x: Math.cos(ang), y: Math.sin(ang) } });
  }
  return cornersFromLines(lines, q, 0.3 * Math.max(dist(q[0], q[2]), dist(q[1], q[3]))) || q;
}

function grabCutQuad(imageData, box) {
  if (typeof cv.grabCut !== "function") return null;
  const W = imageData.width, H = imageData.height, trash = [];
  const keep = (m) => (trash.push(m), m);
  try {
    const rgba = keep(cv.matFromImageData(imageData)), rgb = keep(new cv.Mat()), small = keep(new cv.Mat());
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    const s = 600 / Math.max(W, H); // GrabCut은 무거워서 600px로 줄여서
    cv.resize(rgb, small, new cv.Size(Math.round(W * s), Math.round(H * s)), 0, 0, cv.INTER_AREA);
    const sw = small.cols, sh = small.rows;
    const rx = Math.max(1, Math.floor(box.x0 * s)), ry = Math.max(1, Math.floor(box.y0 * s));
    const rw = Math.min(sw - 2, Math.ceil(box.x1 * s)) - rx, rh = Math.min(sh - 2, Math.ceil(box.y1 * s)) - ry;
    if (rw < 10 || rh < 10) return null;
    const mask = keep(new cv.Mat()), bgd = keep(new cv.Mat()), fgd = keep(new cv.Mat());
    cv.grabCut(small, mask, new cv.Rect(rx, ry, rw, rh), bgd, fgd, 5, cv.GC_INIT_WITH_RECT);
    const bin = keep(new cv.Mat(sh, sw, cv.CV_8UC1));
    for (let i = 0; i < sw * sh; i++) bin.data[i] = mask.data[i] === 1 || mask.data[i] === 3 ? 255 : 0;
    const k5 = keep(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)));
    cv.morphologyEx(bin, bin, cv.MORPH_OPEN, k5);
    const contours = keep(new cv.MatVector()), hier = keep(new cv.Mat());
    cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);
    let big = null, bigArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = keep(contours.get(i)), a = cv.contourArea(c);
      if (a > bigArea) { bigArea = a; big = c; }
    }
    if (!big || bigArea < 0.02 * sw * sh) return null;
    const hull = keep(new cv.Mat());
    cv.convexHull(big, hull, false, true);
    let hp = [];
    for (let j = 0; j < hull.data32S.length; j += 2) hp.push({ x: hull.data32S[j], y: hull.data32S[j + 1] });
    if (hp.length < 4) return null;
    if (hp.length > 40) { const step = Math.ceil(hp.length / 40); hp = hp.filter((_, j) => j % step === 0); }
    const pts = [];
    for (let j = 0; j < big.data32S.length; j += 2) pts.push({ x: big.data32S[j], y: big.data32S[j + 1] });
    return sideFit(largestQuad(hp), pts).map((p) => ({ x: p.x / s, y: p.y / s }));
  } finally {
    for (const m of trash) { try { m.delete(); } catch (_) { /* 이미 지워짐 */ } }
  }
}

// 밝기 변화(기울기) 지도: 가로 방향 gx, 세로 방향 gy
function gradients(imageData) {
  const rgba = cv.matFromImageData(imageData), gray = new cv.Mat(), gx = new cv.Mat(), gy = new cv.Mat();
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Sobel(gray, gx, cv.CV_32F, 1, 0);
    cv.Sobel(gray, gy, cv.CV_32F, 0, 1);
    return { gx: gx.data32F.slice(), gy: gy.data32F.slice() };
  } finally {
    rgba.delete(); gray.delete(); gx.delete(); gy.delete();
  }
}
// 선분 a-b를 따라 "선과 수직으로 밝기가 바뀌는 세기"의 평균 (높을수록 진짜 테두리)
function lineScore(a, b, g, W, H) {
  const L = dist(a, b);
  if (L < 10) return 0;
  const t = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, n = { x: -t.y, y: t.x };
  let tot = 0;
  const N = 30;
  for (let k = 0; k < N; k++) {
    const s = 0.1 + (0.8 * k) / (N - 1);
    const px = a.x + (b.x - a.x) * s, py = a.y + (b.y - a.y) * s;
    let best = 0;
    for (let d = -1; d <= 1; d++) {
      const x = Math.round(px + n.x * d), y = Math.round(py + n.y * d);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x, v = Math.abs(g.gx[i] * n.x + g.gy[i] * n.y);
      if (v > best) best = v;
    }
    tot += Math.min(best, 200);
  }
  return tot / N;
}
// 각 변을 앞뒤로 조금씩(±8px) 움직여 보고, 테두리에 가장 잘 붙는 위치로
function snapQuad(quad, g, W, H) {
  const q = cwOrder(quad), R = 8, lines = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], L = dist(a, b) || 1;
    const n = { x: -(b.y - a.y) / L, y: (b.x - a.x) / L };
    let best = { s: lineScore(a, b, g, W, H), a, b };
    for (let da = -R; da <= R; da += 2)
      for (let db = -R; db <= R; db += 2) {
        const a2 = { x: a.x + n.x * da, y: a.y + n.y * da }, b2 = { x: b.x + n.x * db, y: b.y + n.y * db };
        const sc = lineScore(a2, b2, g, W, H);
        if (sc > best.s) best = { s: sc, a: a2, b: b2 };
      }
    const len = dist(best.a, best.b) || 1;
    lines.push({ p: best.a, d: { x: (best.b.x - best.a.x) / len, y: (best.b.y - best.a.y) / len } });
  }
  return cornersFromLines(lines, q, 3 * R) || q;
}

function refine(imageData, corners, boxRatio) {
  const W = imageData.width, H = imageData.height;
  const box = { x0: boxRatio[1] * W, y0: boxRatio[0] * H, x1: boxRatio[3] * W, y1: boxRatio[2] * H };
  const first = corners ? corners.map(([y, x]) => ({ x: x * W, y: y * H })) : null;
  let quad = null, how = "";
  if (first && iou(bboxOf(first), box) >= 0.6) { quad = first; how = "1단계 그대로"; }
  else {
    quad = grabCutQuad(imageData, box);
    how = quad ? "GrabCut" : "";
    if (!quad && first) { quad = first; how = "1단계 (GrabCut 실패)"; }
  }
  if (!quad) return null;
  quad = snapQuad(quad, gradients(imageData), W, H);
  console.log("[opencv] 2단계:", how);
  return orient(quad).map((p) => [p.y / H, p.x / W]);
}

self.onmessage = async (e) => {
  const { id, imageData, refine: r } = e.data;
  try {
    await ready;
    if (imageData && r) {
      self.postMessage({ id, corners: refine(imageData, r.corners, r.box) });
      return;
    }
    self.postMessage({ id, corners: imageData ? detect(imageData) : null });
  } catch (err) {
    self.postMessage({ id, corners: null, error: String(err) });
  }
};
