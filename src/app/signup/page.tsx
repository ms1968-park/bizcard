import AuthShell from "@/components/AuthShell";
import AuthForm from "@/components/AuthForm";
import { signup } from "@/app/auth-actions";

export default function SignupPage() {
  return (
    <AuthShell title="명함첩을 만들어 볼까요?">
      <AuthForm mode="signup" action={signup} />
    </AuthShell>
  );
}
