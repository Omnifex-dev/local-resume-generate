import { HistoryBrowser } from "@/components/history/history-browser";
import { HISTORY_PAGE_SIZE } from "@/lib/history";
import { requireUser } from "@/server/auth/session";
import { searchGenerations } from "@/server/generation/repository";
import { failInterrupted } from "@/server/generation/service";
import { getSettings } from "@/server/settings/repository";

export const metadata = { title: "History · Resume Generate" };

export default async function HistoryPage() {
  const user = await requireUser();
  await failInterrupted(user.id);
  const [settings, first] = await Promise.all([
    getSettings(user.id),
    searchGenerations(user.id, { tab: "created", limit: HISTORY_PAGE_SIZE }),
  ]);

  return (
    <>
      <h1 className="sr-only">Resume history</h1>
      <HistoryBrowser initial={first} theme={settings.themeId} />
    </>
  );
}
