import Link from "next/link";

// 로그인·회원가입 화면의 공통 틀 (로고 + 제목)
export default function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <Link href="/" className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-white">
          B
        </span>
        <span className="text-xl font-bold text-ink">BizCard</span>
      </Link>
      <h1 className="text-center text-2xl font-bold text-ink">{title}</h1>
      {children}
      <Link href="/privacy" className="text-center text-sm text-ink-faint hover:underline">
        개인정보처리방침
      </Link>
    </main>
  );
}
