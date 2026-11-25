import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import DeleteCardButton from "@/components/DeleteCardButton";
import {
  CARD_FIELDS,
  linkedinHref,
  mapHref,
  smsHref,
  telHref,
  webHref,
  type CardRow,
} from "@/lib/card-fields";

// 각 칸을 누르면 어디로 연결할지
function linkFor(key: string, value: string): string | null {
  switch (key) {
    case "mobile":
    case "phone":
      return telHref(value);
    case "email":
      return `mailto:${value}`;
    case "address":
      return mapHref(value);
    case "website":
      return webHref(value);
    case "linkedin":
      return linkedinHref(value);
    default:
      return null;
  }
}

function QuickButton({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-card py-3 text-brand"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs text-ink-soft">{label}</span>
    </a>
  );
}

async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();

  // RLS 덕분에 내 명함이 아니면 아무것도 돌아오지 않는다
  const { data: card } = await supabase.from("cards").select("*").eq("id", id).maybeSingle<CardRow>();
  if (!card) notFound();

  // 비공개 보관함의 사진은 "1시간짜리 임시 열람 링크"를 만들어서 보여 준다
  const photoPaths = [card.image_path, card.image_back_path].filter(Boolean) as string[];
  const photos =
    photoPaths.length > 0
      ? ((await supabase.storage.from("card-images").createSignedUrls(photoPaths, 3600)).data ?? [])
      : [];

  const quick = [
    card.mobile && { href: telHref(card.mobile), icon: "📞", label: "전화" },
    card.mobile && { href: smsHref(card.mobile), icon: "💬", label: "문자" },
    card.email && { href: `mailto:${card.email}`, icon: "✉️", label: "이메일" },
    card.address && { href: mapHref(card.address), icon: "📍", label: "지도" },
  ].filter(Boolean) as { href: string; icon: string; label: string }[];

  return (
    <div className="flex flex-col gap-6">
      {photos.length > 0 && (
        <div className="flex snap-x gap-3 overflow-x-auto">
          {photos.map((p, i) =>
            p.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.path ?? i}
                src={p.signedUrl}
                alt={i === 0 ? "명함 앞면" : "명함 뒷면"}
                className="aspect-[1.75] w-full shrink-0 snap-center rounded-3xl object-cover"
              />
            ) : null,
          )}
        </div>
      )}

      <div className="text-center">
        <h2 className="text-2xl font-bold text-ink">{card.name || "(이름 없음)"}</h2>
        <p className="mt-1 text-ink-soft">
          {[card.company, card.department, card.title].filter(Boolean).join(" · ")}
        </p>
        {card.tags && card.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {card.tags.map((t) => (
              <span key={t} className="rounded-full bg-latte px-3 py-1 text-xs text-brand-dark">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {quick.length > 0 && (
        <div className="flex gap-2">
          {quick.map((q) => (
            <QuickButton key={q.label} {...q} />
          ))}
        </div>
      )}

      <dl className="flex flex-col divide-y divide-latte rounded-3xl bg-card px-5">
        {CARD_FIELDS.filter((f) => !["name", "company", "department", "title"].includes(f.key)).map((f) => {
          const value = card[f.key];
          if (!value) return null;
          const href = linkFor(f.key, value);
          return (
            <div key={f.key} className="flex flex-col gap-0.5 py-3">
              <dt className="text-xs text-ink-soft">{f.label}</dt>
              <dd className="break-all text-ink">
                {href ? (
                  <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {card.memo && (
        <div className="rounded-3xl bg-latte px-5 py-4">
          <p className="text-xs text-brand-dark">메모</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{card.memo}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Link href={`/cards/${card.id}/edit`} className="rounded-full bg-brand py-3 text-center font-medium text-white hover:bg-brand-dark">
          수정하기
        </Link>
        <DeleteCardButton id={card.id} />
      </div>
    </div>
  );
}

export default function CardDetailPage({ params }: PageProps<"/cards/[id]">) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <Link href="/cards" className="text-2xl text-ink-soft" aria-label="목록으로">
          ←
        </Link>
        <h1 className="text-xl font-bold text-ink">명함 보기</h1>
      </header>
      <Suspense fallback={<p className="py-16 text-center text-ink-soft">불러오는 중…</p>}>
        <CardDetail params={params} />
      </Suspense>
    </main>
  );
}
