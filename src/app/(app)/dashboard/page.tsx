import { redirect } from "next/navigation";

/** The workspace replaced the dashboard; old links and bookmarks still work. */
export default function DashboardPage() {
  redirect("/generate");
}
