// 이 파일은 서버(주방)에서만 쓴다. 비밀 키(GEMINI_API_KEY)를 다루기 때문.
// Gemini는 "글자 읽기"만 맡는다. (명함 꼭짓점은 브라우저의 OpenCV가 찾는다)
import { GoogleGenAI } from "@google/genai";
import { CARD_FIELDS, emptyCardFields, type CardFields } from "@/lib/card-fields";

// 어떤 Gemini 모델을 쓸지. 바꾸고 싶으면 .env.local 에 GEMINI_MODEL=... 을 넣으면 된다.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// AI에게 "이 모양으로만 답해 줘"라고 알려 주는 답안지 양식
const schema = {
  type: "object",
  properties: {
    ...Object.fromEntries(CARD_FIELDS.map((f) => [f.key, { type: "string", description: f.label }])),
    rotations: {
      type: "array",
      description: "보낸 사진 순서대로, 각 사진을 시계 방향으로 몇 도(0~359) 돌려야 명함 글자가 똑바로 서는지",
      items: { type: "integer" },
    },
  },
  required: [...CARD_FIELDS.map((f) => f.key), "rotations"],
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

그리고 rotations 에는 보낸 사진마다 하나씩, 순서대로 숫자를 적어 주세요.
- 그 사진을 시계 방향으로 몇 도 돌리면 명함의 가장 큰 글자(이름, 회사명)가 똑바로 읽히는지, 0~359 사이의 정수.
- 예: 이미 똑바로면 0, 글자가 오른쪽으로 누워 있으면(위쪽이 사진의 오른쪽) 270, 왼쪽으로 누워 있으면 90, 거꾸로면 180.
- 비스듬하면 가장 가까운 각도로 (예: 30, 315).`;

// 명함 사진(들)을 받아서 칸별 정보를 돌려준다.
export async function extractCardInfo(
  images: { data: string; mimeType: string }[],
): Promise<{ fields: CardFields; rotations: (number | null)[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 가 설정되지 않았어요.");

  const started = Date.now();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: PROMPT }, ...images.map((img) => ({ inlineData: img }))] }],
    config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0 },
  });
  console.log(`[gemini] ${MODEL} 글자 읽기 ${((Date.now() - started) / 1000).toFixed(1)}초`);

  const parsed = JSON.parse(response.text ?? "{}") as Partial<CardFields> & { rotations?: unknown };
  const fields = emptyCardFields();
  for (const f of CARD_FIELDS) {
    const v = parsed[f.key];
    if (typeof v === "string") fields[f.key] = v.trim();
  }

  // 사진마다 "몇 도 돌려야 글자가 서는지" (이상한 값이면 null)
  const raw = Array.isArray(parsed.rotations) ? parsed.rotations : [];
  const rotations = images.map((_, i) => {
    const r = raw[i];
    return typeof r === "number" && Number.isFinite(r) ? ((Math.round(r) % 360) + 360) % 360 : null;
  });
  console.log("[gemini] rotations:", JSON.stringify(rotations));

  return { fields, rotations };
}
