import AuthShell from "@/components/AuthShell";
import SimpleAuthForm from "@/components/SimpleAuthForm";
import { requestPasswordReset } from "@/app/auth-actions";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="비밀번호를 잊으셨나요?">
      <SimpleAuthForm kind="forgot" action={requestPasswordReset} />
    </AuthShell>
  );
}
