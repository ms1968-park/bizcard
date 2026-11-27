import AuthShell from "@/components/AuthShell";
import SimpleAuthForm from "@/components/SimpleAuthForm";
import { updatePassword } from "@/app/auth-actions";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="새 비밀번호를 정해 주세요">
      <SimpleAuthForm kind="reset" action={updatePassword} />
    </AuthShell>
  );
}
