import { UsersAdmin } from "@/components/admin/users-admin";
import { listUsers } from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "Users · Admin · Resume Generate" };

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await listUsers();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-slate-600 dark:text-slate-400">Create accounts, disable access, reset passwords or delete users with all their data.</p>
      </div>
      <UsersAdmin users={users} currentAdminId={admin.id} />
    </div>
  );
}
