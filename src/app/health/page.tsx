import { Suspense } from "react";
import { connection } from "next/server";

// Supabase 연결 테스트 페이지: /health
async function SupabaseStatus() {
  await connection(); // 미리 만들어 두지 말고, 접속할 때마다 새로 확인하기

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return (
      <p className="text-red-600">
        ❌ 환경 변수가 없어요. (.env.local 또는 Vercel 설정을 확인하세요)
      </p>
    );
  }

  // 먼저 결과만 알아내고, 화면(JSX)은 try/catch 밖에서 만든다
  let status: number | "network-error";
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    status = res.status;
  } catch {
    status = "network-error";
  }

  if (status === "network-error") {
    return <p className="text-red-600">❌ Supabase 주소에 접속하지 못했어요.</p>;
  }
  if (status >= 200 && status < 300) {
    return <p className="text-green-700">✅ Supabase에 연결됐어요!</p>;
  }
  return (
    <p className="text-red-600">
      ❌ 연결은 됐지만 거절당했어요. (응답 코드 {status}) 열쇠를 확인하세요.
    </p>
  );
}

export default function HealthPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
      <h1 className="text-2xl font-bold text-gray-900">연결 상태 점검</h1>
      <Suspense fallback={<p className="text-gray-500">확인 중…</p>}>
        <SupabaseStatus />
      </Suspense>
    </main>
  );
}
