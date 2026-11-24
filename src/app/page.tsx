export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-3xl font-bold text-white">
        B
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-ink">BizCard</h1>
        <p className="text-lg text-ink-soft">명함을 찍으면, 연락처가 됩니다.</p>
      </div>
      <span className="rounded-full bg-latte px-5 py-2 text-sm text-brand-dark">
        곧 문을 엽니다 ☕
      </span>
    </main>
  );
}
