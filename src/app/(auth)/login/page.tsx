import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/server/auth/actions";

export const metadata = { title: "Sign in · Resume Generate" };

export default function LoginPage() {
  return <AuthForm mode="login" action={loginAction} />;
}
