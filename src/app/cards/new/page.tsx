import Link from "next/link";
import ScanCard from "@/components/ScanCard";

export default function NewCardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <Link href="/cards" className="text-2xl text-ink-soft" aria-label="뒤로">
          ←
        </Link>
        <h1 className="text-xl font-bold text-ink">명함 스캔</h1>
      </header>
      <ScanCard />
    </main>
  );
}
