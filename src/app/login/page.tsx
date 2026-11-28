import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import AuthErrorNotice from "@/components/AuthErrorNotice";
import AuthForm from "@/components/AuthForm";
import { login } from "@/app/auth-actions";

export default function LoginPage() {
  return (
    <AuthShell title="다시 만나서 반가워요">
      <Suspense fallback={null}>
        <AuthErrorNotice />
      </Suspense>
      <AuthForm mode="login" action={login} />
    </AuthShell>
  );
}
