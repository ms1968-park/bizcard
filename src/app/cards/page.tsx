import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth-actions";

// 이름 첫 글자로 동그라미 색을 정한다 (같은 사람은 항상 같은 색)
const PASTELS = [
  ["#fbe3d6", "#9a4a2a"],
  ["#e3eedb", "#4c6a36"],
  ["#eae1f3", "#6a4e86"],
  ["#dceaf3", "#3b5670"],
  ["#f6e8c8", "#7a5a12"],
];
function pastel(seed: string) {
  let n = 0;
  for (const ch of seed) n = (n + ch.charCodeAt(0)) % PASTELS.length;
  return PASTELS[n];
}

// 내 명함 목록을 데이터베이스에서 읽어 온다
async function CardList() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS 덕분에 "내 명함"만 돌아온다
  const { data: cards } = await supabase
    .from("cards")
    .select("id, name, company, title, tags")
    .order("created_at", { ascending: false });

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-16 text-center">
        <p className="text-4xl">📇</p>
        <p className="text-lg text-ink">첫 명함을 스캔해 볼까요?</p>
        <p className="text-sm text-ink-soft">아래 스캔 버튼을 눌러 명함을 찍어 보세요.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {cards.map((c) => {
        const display = c.name || c.company || "?";
        const [bg, fg] = pastel(display);
        return (
          <li key={c.id}>
            <Link href={`/cards/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 hover:ring-1 hover:ring-latte">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-medium"
              style={{ background: bg, color: fg }}
            >
              {display.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{c.name || "(이름 없음)"}</p>
              <p className="truncate text-sm text-ink-soft">
                {[c.company, c.title].filter(Boolean).join(" · ")}
              </p>
            </div>
            {c.tags && c.tags.length > 0 && (
              <span className="shrink-0 rounded-full bg-latte px-3 py-1 text-xs text-brand-dark">
                {c.tags[0]}
              </span>
            )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function CardsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-6 px-6 py-8 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">내 명함</h1>
        <form action={logout}>
          <button type="submit" className="rounded-full bg-latte px-4 py-2 text-sm text-brand-dark">
            로그아웃
          </button>
        </form>
      </header>

      <Suspense fallback={<p className="py-16 text-center text-ink-soft">불러오는 중…</p>}>
        <CardList />
      </Suspense>

      <Link
        href="/cards/new"
        className="fixed bottom-6 right-6 rounded-full bg-brand px-6 py-4 text-base font-medium text-white shadow-lg hover:bg-brand-dark"
      >
        📷 스캔
      </Link>
    </main>
  );
}
