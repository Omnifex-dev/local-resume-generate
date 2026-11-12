// Creates the admin account, or updates it (role admin, active, new password) if the
// username exists. Reads ADMIN_USERNAME / ADMIN_PASSWORD from the environment or .env.
//   npm run admin:create
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import postgres from "postgres";

const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
  console.error("ADMIN_USERNAME must be 3-32 letters, numbers, dot, dash or underscore.");
  process.exit(1);
}
if (password.length < 8 || password.length > 128) {
  console.error("Set ADMIN_PASSWORD (8-128 characters) in .env or the environment.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Same Argon2id parameters as src/server/auth/password.ts.
const passwordHash = await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [row] = await sql`
    insert into users (username, password_hash, role, active)
    values (${username}, ${passwordHash}, 'admin', true)
    on conflict (username) do update
      set password_hash = excluded.password_hash, role = 'admin', active = true, updated_at = now()
    returning (xmax = 0) as inserted`;
  console.log(row.inserted ? `Admin "${username}" created.` : `Admin "${username}" updated (role, active, password).`);
} finally {
  await sql.end();
}
