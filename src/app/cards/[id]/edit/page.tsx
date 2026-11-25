import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import CardForm from "@/components/CardForm";
import { CARD_FIELDS, type CardFields, type CardRow } from "@/lib/card-fields";

async function EditForm({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const { data: card } = await supabase.from("cards").select("*").eq("id", id).maybeSingle<CardRow>();
  if (!card) notFound();

  const initial = Object.fromEntries(CARD_FIELDS.map((f) => [f.key, card[f.key] ?? ""])) as CardFields;

  return (
    <div className="flex flex-col gap-4">
      <CardForm
        cardId={card.id}
        initial={initial}
        initialTags={(card.tags ?? []).join(", ")}
        initialMemo={card.memo ?? ""}
      />
      <Link href={`/cards/${card.id}`} className="py-2 text-center text-sm text-ink-soft">
        취소
      </Link>
    </div>
  );
}

export default function EditCardPage({ params }: PageProps<"/cards/[id]/edit">) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-ink">명함 수정</h1>
      </header>
      <Suspense fallback={<p className="py-16 text-center text-ink-soft">불러오는 중…</p>}>
        <EditForm params={params} />
      </Suspense>
    </main>
  );
}
