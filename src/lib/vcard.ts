import { linkedinHref, webHref, type CardRow } from "@/lib/card-fields";

// vCard 규칙: 쉼표, 세미콜론, 역슬래시, 줄바꿈은 앞에 \ 를 붙여야 한다
function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// 이름을 성과 이름으로 나눈다.
// 한글 "홍길동" → 성: 홍, 이름: 길동 / 영어 "Josh Dodge" → 성: Dodge, 이름: Josh
function splitName(full: string): { family: string; given: string } {
  const name = full.trim();
  if (/^[가-힣]{2,4}$/.test(name)) return { family: name[0], given: name.slice(1) };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { family: "", given: name };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") };
}

// 명함 한 장을 vCard(연락처 공통 양식) 글자로 바꾼다
export function cardToVCard(card: CardRow): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const fullName = card.name || card.company || "이름 없음";
  const { family, given } = splitName(card.name || "");

  lines.push(`N:${esc(family)};${esc(given)};;;`);
  lines.push(`FN:${esc(fullName)}`);
  if (card.company || card.department) {
    lines.push(`ORG:${esc(card.company ?? "")};${esc(card.department ?? "")}`);
  }
  if (card.title) lines.push(`TITLE:${esc(card.title)}`);
  if (card.mobile) lines.push(`TEL;TYPE=CELL,VOICE:${esc(card.mobile)}`);
  if (card.phone) lines.push(`TEL;TYPE=WORK,VOICE:${esc(card.phone)}`);
  if (card.fax) lines.push(`TEL;TYPE=WORK,FAX:${esc(card.fax)}`);
  if (card.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${esc(card.email)}`);
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${esc(card.address)};;;;`);
  if (card.website) lines.push(`URL;TYPE=WORK:${esc(webHref(card.website))}`);
  if (card.linkedin) {
    const url = linkedinHref(card.linkedin);
    lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${esc(url)}`);
    lines.push(`URL;TYPE=LinkedIn:${esc(url)}`);
  }

  const note = [card.memo, card.tags?.length ? `태그: ${card.tags.join(", ")}` : "", "BizCard에서 저장함"]
    .filter(Boolean)
    .join("\n");
  lines.push(`NOTE:${esc(note)}`);
  lines.push("END:VCARD");

  // vCard는 줄 끝을 \r\n 으로 써야 모든 기기가 잘 읽는다
  return lines.join("\r\n") + "\r\n";
}
