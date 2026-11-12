import { redirect } from "next/navigation";

/** Email verification is disabled: registering signs the user in directly. */
export default function VerifyPage() {
  redirect("/register");
}
