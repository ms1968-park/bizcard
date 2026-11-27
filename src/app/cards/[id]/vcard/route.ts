import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cardToVCard } from "@/lib/vcard";
import type { CardRow } from "@/lib/card-fields";

// /cards/명함ID/vcard 로 오면 연락처 파일(.vcf)을 만들어서 돌려준다
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS 덕분에 내 명함이 아니면 찾을 수 없다
  const { data: card } = await supabase.from("cards").select("*").eq("id", id).maybeSingle<CardRow>();
  if (!card) return new NextResponse("명함을 찾을 수 없어요.", { status: 404 });

  const fileName = `${card.name || card.company || "contact"}.vcf`;

  return new NextResponse(cardToVCard(card), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      // 한글 파일 이름도 깨지지 않게
      "Content-Disposition": `attachment; filename="contact.vcf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
