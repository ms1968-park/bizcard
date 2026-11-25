// 명함에 적힌 정보 칸 목록 (화면과 서버가 함께 쓴다)
export const CARD_FIELDS = [
  { key: "name", label: "이름", type: "text" },
  { key: "company", label: "회사", type: "text" },
  { key: "department", label: "부서", type: "text" },
  { key: "title", label: "직책", type: "text" },
  { key: "mobile", label: "휴대폰", type: "tel" },
  { key: "phone", label: "회사 전화", type: "tel" },
  { key: "fax", label: "팩스", type: "tel" },
  { key: "email", label: "이메일", type: "email" },
  { key: "address", label: "주소", type: "text" },
  { key: "website", label: "홈페이지", type: "text" },
  { key: "linkedin", label: "LinkedIn", type: "text" },
] as const;

export type CardFieldKey = (typeof CARD_FIELDS)[number]["key"];
export type CardFields = Record<CardFieldKey, string>;

export function emptyCardFields(): CardFields {
  return Object.fromEntries(CARD_FIELDS.map((f) => [f.key, ""])) as CardFields;
}

// 데이터베이스(cards 표)의 한 줄 모양
export type CardRow = { id: string } & { [K in keyof CardFields]: string | null } & {
  memo: string | null;
  tags: string[] | null;
  image_path: string | null;
  image_back_path: string | null;
  created_at: string;
};

// 링크로 만들 때 쓰는 도우미들
export const telHref = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;
export const smsHref = (v: string) => `sms:${v.replace(/[^\d+]/g, "")}`;
export const webHref = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
export const linkedinHref = (v: string) =>
  /^https?:\/\//i.test(v)
    ? v
    : v.includes("linkedin.com")
      ? `https://${v}`
      : `https://www.linkedin.com/in/${v.replace(/^@/, "")}`;
export const mapHref = (v: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
