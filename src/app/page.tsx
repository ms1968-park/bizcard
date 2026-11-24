import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-3xl font-bold text-white">
        B
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-ink">BizCard</h1>
        <p className="text-lg text-ink-soft">명함을 찍으면, 연락처가 됩니다.</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Link href="/signup" className="rounded-full bg-brand py-3 font-medium text-white hover:bg-brand-dark">
          시작하기
        </Link>
        <Link href="/login" className="rounded-full bg-latte py-3 font-medium text-brand-dark">
          로그인
        </Link>
      </div>
    </main>
  );
}
