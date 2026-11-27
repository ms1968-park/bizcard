// 이 파일은 서버(주방)에서만 쓴다. 비밀 키(GEMINI_API_KEY)를 다루기 때문.
import { GoogleGenAI } from "@google/genai";
import { CARD_FIELDS, emptyCardFields, type CardCrop, type CardFields } from "@/lib/card-fields";

// 어떤 Gemini 모델을 쓸지. 바꾸고 싶으면 .env.local 에 GEMINI_MODEL=... 을 넣으면 된다.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// AI에게 "이 모양으로만 답해 줘"라고 알려 주는 답안지 양식
const schema = {
  type: "object",
  properties: {
    ...Object.fromEntries(CARD_FIELDS.map((f) => [f.key, { type: "string", description: f.label }])),
    crops: {
      type: "array",
      description: "보낸 사진 순서대로, 각 사진 속 명함 카드의 네 꼭짓점",
      items: {
        type: "object",
        properties: {
          corners: {
            type: "array",
            description: "[y, x] 점 4개: 좌상단, 우상단, 우하단, 좌하단 (글자가 똑바로 읽히는 방향 기준)",
            items: { type: "array", items: { type: "integer" } },
          },
        },
        required: ["corners"],
      },
    },
  },
  required: [...CARD_FIELDS.map((f) => f.key), "crops"],
};

const PROMPT = `다음 이미지는 한 사람의 명함입니다. (앞면, 그리고 있다면 뒷면)
명함에 적힌 정보를 아래 규칙에 따라 칸별로 정리해 주세요.

- 명함에 없는 정보는 빈 문자열("")로 두고, 절대 지어내지 마세요.
- name: 사람 이름. 한글과 영문이 함께 있으면 한글 이름을 쓰세요.
- company: 회사·기관 이름. title: 직책(과장, 대표, Manager 등). department: 부서·팀.
- mobile: 휴대폰 번호(010 등으로 시작하거나 M, Mobile, HP 표시). phone: 회사 전화(T, Tel, 직통).
- fax: 팩스(F, Fax). 번호는 명함에 적힌 형식 그대로 쓰세요.
- website: 홈페이지 주소. linkedin: LinkedIn 주소나 아이디.
- address: 주소 전체를 한 줄로.

그리고 crops 에는 보낸 사진마다 하나씩, 순서대로 명함 카드(종이)의 네 꼭짓점을 적어 주세요.
- corners: 점 4개, 각 점은 [y, x]. 사진 크기를 0~1000으로 본 정수 좌표.
- 점의 순서는 "명함 글자가 똑바로 읽히는 방향"을 기준으로 좌상단, 우상단, 우하단, 좌하단입니다.
  (사진 속에서 명함이 돌아가 있으면, 사진 기준이 아니라 명함 글자 기준으로 순서를 정하세요.)
- 손가락 등에 가려진 꼭짓점은 명함 테두리 선을 이어서 추정하세요.`;

// 점 4개로 이루어진 사각형의 넓이 (0~1 비율 좌표 기준)
function quadArea(pts: number[][]): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const [y1, x1] = pts[i];
    const [y2, x2] = pts[(i + 1) % 4];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

// 명함 사진(들)을 받아서 칸별 정보와 명함 꼭짓점을 돌려준다.
export async function extractCardInfo(
  images: { data: string; mimeType: string }[],
): Promise<{ fields: CardFields; crops: (CardCrop | null)[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 가 설정되지 않았어요.");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0,
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as Partial<CardFields> & { crops?: unknown };
  const fields = emptyCardFields();
  for (const f of CARD_FIELDS) {
    const v = parsed[f.key];
    if (typeof v === "string") fields[f.key] = v.trim();
  }

  // 꼭짓점이 이상하면 null (보정하지 않고 원래 사진 사용)
  const rawCrops = Array.isArray(parsed.crops) ? parsed.crops : [];
  const crops = images.map((_, i) => {
    const corners = (rawCrops[i] as { corners?: unknown } | undefined)?.corners;
    const valid =
      Array.isArray(corners) &&
      corners.length === 4 &&
      corners.every(
        (p) =>
          Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && n >= 0 && n <= 1000),
      );
    if (!valid) return null;
    const pts = (corners as number[][]).map(([y, x]) => [y / 1000, x / 1000]);
    if (quadArea(pts) < 0.05) return null; // 너무 작으면 잘못 찾은 것으로 본다
    return { corners: pts };
  });

  return { fields, crops };
}
