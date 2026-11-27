// 명함 꼭짓점 찾기: 실제 계산은 보조 일꾼(public/opencv-worker.js)이 OpenCV로 한다.
// 이 파일은 사진을 줄여서 일꾼에게 보내고, 결과를 받아 오는 "연락 담당"이다.

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (corners: number[][] | null) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker("/opencv-worker.js");
  worker.onmessage = (e: MessageEvent<{ id: number; corners: number[][] | null; error?: string }>) => {
    const { id, corners, error } = e.data;
    if (error) console.warn("[opencv]", error);
    pending.get(id)?.(corners ?? null);
    pending.delete(id);
  };
  worker.onerror = (e) => {
    console.warn("[opencv] 일꾼 오류:", e.message);
    stopOpenCV();
  };
  return worker;
}

// 스캔 화면을 열 때 미리 일꾼을 깨워서 OpenCV를 준비시킨다 (화면은 멈추지 않는다)
export function warmUpOpenCV() {
  const id = ++seq;
  getWorker().postMessage({ id, imageData: null });
}

// 일꾼을 멈추고, 기다리던 요청은 모두 "못 찾음"으로 끝낸다
export function stopOpenCV() {
  worker?.terminate();
  worker = null;
  for (const resolve of pending.values()) resolve(null);
  pending.clear();
}

// 사진 → 명함 꼭짓점 4개 [y, x] (0~1 비율 좌표), 못 찾으면 null
export async function detectCardCorners(file: Blob): Promise<number[][] | null> {
  const bitmap = await createImageBitmap(file);
  const scale = 800 / Math.max(bitmap.width, bitmap.height); // 긴 변 800px로 줄여서 빠르게
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    getWorker().postMessage({ id, imageData }, [imageData.data.buffer]);
  });
}
