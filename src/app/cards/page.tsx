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

const SORTS = {
  recent: { label: "최근 등록순", column: "created_at", ascending: false },
  name: { label: "이름순", column: "name", ascending: true },
  company: { label: "회사순", column: "company", ascending: true },
} as const;
type SortKey = keyof typeof SORTS;

// 검색어·태그·정렬을 주소(URL)에 담는다. 예: /cards?q=홍길동&tag=거래처&sort=name
function cardsHref(params: { q?: string; tag?: string; sort?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.tag) sp.set("tag", params.tag);
  if (params.sort && params.sort !== "recent") sp.set("sort", params.sort);
  const s = sp.toString();
  return s ? `/cards?${s}` : "/cards";
}

const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

async function CardsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const q = pick(sp.q);
  const tag = pick(sp.tag);
  const sort: SortKey = pick(sp.sort) in SORTS ? (pick(sp.sort) as SortKey) : "recent";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  // 1) 내가 쓴 태그 모음 (태그 버튼을 만들기 위해)
  const { data: tagRows } = await supabase.from("cards").select("tags");
  const totalCount = tagRows?.length ?? 0;
  const allTags = Array.from(new Set((tagRows ?? []).flatMap((r) => r.tags ?? []))).sort((a, b) =>
    a.localeCompare(b, "ko"),
  );

  // 2) 검색어·태그·정렬에 맞는 명함만 가져오기 (RLS 덕분에 내 명함만)
  let query = supabase.from("cards").select("id, name, company, title, tags");
  if (q) {
    // 검색 문법을 깨뜨릴 수 있는 기호는 빼고, 여러 칸에서 한꺼번에 찾는다
    const safe = q.replace(/[,()%*\\]/g, " ").trim();
    if (safe) {
      const like = `%${safe}%`;
      query = query.or(
        ["name", "company", "department", "title", "email", "mobile", "phone", "memo"]
          .map((col) => `${col}.ilike.${like}`)
          .join(","),
      );
    }
  }
  if (tag) query = query.contains("tags", [tag]);
  const s = SORTS[sort];
  query = query.order(s.column, { ascending: s.ascending, nullsFirst: false });
  const { data: cards } = await query;

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-16 text-center">
        <p className="text-4xl">📇</p>
        <p className="text-lg text-ink">첫 명함을 스캔해 볼까요?</p>
        <p className="text-sm text-ink-soft">아래 스캔 버튼을 눌러 명함을 찍어 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* 검색창: 엔터(또는 폰 키보드의 '검색')를 누르면 주소가 /cards?q=... 로 바뀐다 */}
      <form action="/cards" className="flex items-center gap-2 rounded-full bg-card px-4 py-2 ring-1 ring-latte focus-within:ring-2 focus-within:ring-brand">
        <span className="text-ink-faint">🔍</span>
        <input
          type="search"
          name="q"
          size={1}
          defaultValue={q}
          enterKeyHint="search"
          placeholder="이름, 회사, 전화번호, 메모 검색"
          className="min-w-0 flex-1 bg-transparent py-1 text-base text-ink outline-none placeholder:text-ink-faint"
        />
        {tag && <input type="hidden" name="tag" value={tag} />}
        {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
      </form>

      {/* 태그 버튼 */}
      {allTags.length > 0 && (
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
          <Link
            href={cardsHref({ q, sort })}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${!tag ? "bg-brand text-white" : "bg-latte text-brand-dark"}`}
          >
            전체
          </Link>
          {allTags.map((t) => (
            <Link
              key={t}
              href={cardsHref({ q, tag: t === tag ? "" : t, sort })}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${t === tag ? "bg-brand text-white" : "bg-latte text-brand-dark"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {/* 개수와 정렬 */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="text-ink-soft">
          {q || tag ? `찾은 명함 ${cards?.length ?? 0}장` : `명함 ${totalCount}장`}
        </span>
        <div className="flex gap-3">
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={cardsHref({ q, tag, sort: key })}
              className={key === sort ? "font-medium text-brand" : "text-ink-faint"}
            >
              {SORTS[key].label}
            </Link>
          ))}
        </div>
      </div>

      {!cards || cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-card px-6 py-12 text-center">
          <p className="text-3xl">🔎</p>
          <p className="text-ink">찾는 명함이 없어요.</p>
          <Link href="/cards" className="text-sm text-brand underline">
            검색 지우기
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((c) => {
            const display = c.name || c.company || "?";
            const [bg, fg] = pastel(display);
            return (
              <li key={c.id}>
                <Link
                  href={`/cards/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 hover:ring-1 hover:ring-latte"
                >
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
                    <span className="max-w-[40%] shrink-0 truncate rounded-full bg-latte px-3 py-1 text-xs text-brand-dark">
                      {c.tags[0]}
                      {c.tags.length > 1 && ` +${c.tags.length - 1}`}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CardsPage({ searchParams }: PageProps<"/cards">) {
  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-sm flex-col gap-6 px-5 py-8 pb-28">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">내 명함</h1>
        <form action={logout}>
          <button type="submit" className="rounded-full bg-latte px-4 py-2 text-sm text-brand-dark">
            로그아웃
          </button>
        </form>
      </header>

      <Suspense fallback={<p className="py-16 text-center text-ink-soft">불러오는 중…</p>}>
        <CardsView searchParams={searchParams} />
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
