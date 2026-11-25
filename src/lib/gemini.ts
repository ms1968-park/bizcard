// 이 파일은 서버(주방)에서만 쓴다. 비밀 키(GEMINI_API_KEY)를 다루기 때문.
import { GoogleGenAI } from "@google/genai";
import { CARD_FIELDS, emptyCardFields, type CardFields } from "@/lib/card-fields";

// 어떤 Gemini 모델을 쓸지. 바꾸고 싶으면 .env.local 에 GEMINI_MODEL=... 을 넣으면 된다.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// AI에게 "이 모양으로만 답해 줘"라고 알려 주는 답안지 양식
const schema = {
  type: "object",
  properties: Object.fromEntries(
    CARD_FIELDS.map((f) => [f.key, { type: "string", description: f.label }]),
  ),
  required: CARD_FIELDS.map((f) => f.key),
};

const PROMPT = `다음 이미지는 한 사람의 명함입니다. (앞면, 그리고 있다면 뒷면)
명함에 적힌 정보를 아래 규칙에 따라 칸별로 정리해 주세요.

- 명함에 없는 정보는 빈 문자열("")로 두고, 절대 지어내지 마세요.
- name: 사람 이름. 한글과 영문이 함께 있으면 한글 이름을 쓰세요.
- company: 회사·기관 이름. title: 직책(과장, 대표, Manager 등). department: 부서·팀.
- mobile: 휴대폰 번호(010 등으로 시작하거나 M, Mobile, HP 표시). phone: 회사 전화(T, Tel, 직통).
- fax: 팩스(F, Fax). 번호는 명함에 적힌 형식 그대로 쓰세요.
- website: 홈페이지 주소. linkedin: LinkedIn 주소나 아이디.
- address: 주소 전체를 한 줄로.`;

// 명함 사진(들)을 받아서 칸별 정보를 돌려준다.
export async function extractCardInfo(
  images: { data: string; mimeType: string }[],
): Promise<CardFields> {
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

  const parsed = JSON.parse(response.text ?? "{}") as Partial<CardFields>;
  const result = emptyCardFields();
  for (const f of CARD_FIELDS) {
    const v = parsed[f.key];
    if (typeof v === "string") result[f.key] = v.trim();
  }
  return result;
}
