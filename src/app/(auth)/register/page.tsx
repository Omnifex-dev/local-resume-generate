import { AuthForm } from "@/components/auth/auth-form";
import { registerAction } from "@/server/auth/actions";

export const metadata = { title: "Register · Resume Generate" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
