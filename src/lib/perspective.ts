// 원근 보정: 비스듬히 찍힌 명함(사다리꼴)을 똑바른 직사각형으로 펴는 계산
// 브라우저에서만 쓴다 (canvas 사용)

type Pt = [number, number]; // [x, y] 픽셀 좌표

// 점 4쌍(from → to)으로 "펴는 공식"(호모그래피 행렬)을 구한다.
// 8개의 미지수를 가진 연립방정식을 가우스 소거법으로 푼다.
function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  return b.map((val, i) => val / A[i][i]);
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// 사진(File)과 네 꼭짓점(0~1 비율, [y,x], 좌상·우상·우하·좌하)을 받아 펴진 명함 사진을 만든다.
export async function warpCard(file: Blob, corners: number[][], maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  // 1) 원본이 너무 크면 계산이 느리므로 먼저 적당히 줄인다
  const pre = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const W = Math.round(bitmap.width * pre);
  const H = Math.round(bitmap.height * pre);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = W;
  srcCanvas.height = H;
  const sctx = srcCanvas.getContext("2d")!;
  sctx.drawImage(bitmap, 0, 0, W, H);
  const src = sctx.getImageData(0, 0, W, H).data;

  // 2) 꼭짓점을 픽셀 좌표로
  const q: Pt[] = corners.map(([y, x]) => [x * W, y * H]);
  const [tl, tr, br, bl] = q;

  // 3) 펴진 명함의 가로·세로 길이 (위아래, 좌우 변 길이의 평균)
  let outW = (dist(tl, tr) + dist(bl, br)) / 2;
  let outH = (dist(tl, bl) + dist(tr, br)) / 2;
  const s = Math.min(1, maxSide / Math.max(outW, outH));
  outW = Math.max(1, Math.round(outW * s));
  outH = Math.max(1, Math.round(outH * s));

  // 4) 결과 사진의 각 점이 원본의 어디에서 왔는지 계산하는 공식 (결과 → 원본)
  const h = homography(
    [
      [0, 0],
      [outW, 0],
      [outW, outH],
      [0, outH],
    ],
    [tl, tr, br, bl],
  );

  // 5) 결과 사진의 점 하나하나에 원본 색을 옮겨 칠한다 (주변 4점을 섞어서 부드럽게)
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const octx = outCanvas.getContext("2d")!;
  const out = octx.createImageData(outW, outH);
  const o = out.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const w = h[6] * x + h[7] * y + 1;
      const sx = (h[0] * x + h[1] * y + h[2]) / w;
      const sy = (h[3] * x + h[4] * y + h[5]) / w;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const idx = (y * outW + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) {
        o[idx] = 255;
        o[idx + 1] = 255;
        o[idx + 2] = 255;
        o[idx + 3] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * W + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + W * 4;
      const i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
        const bottom = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
        o[idx + c] = top * (1 - fy) + bottom * fy;
      }
      o[idx + 3] = 255;
    }
  }
  octx.putImageData(out, 0, 0);

  return await new Promise<Blob>((resolve, reject) =>
    outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.9),
  );
}
