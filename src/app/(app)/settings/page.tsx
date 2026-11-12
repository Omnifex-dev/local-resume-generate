import { redirect } from "next/navigation";

/** Now a modal in the workspace; old links and bookmarks still work. */
export default function Page() {
  redirect("/generate");
}
