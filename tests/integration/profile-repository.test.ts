// Runs against the real Postgres from docker-compose (npm run db:up + db:migrate).
// Skipped automatically when DATABASE_URL isn't set (see tests/setup.ts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/profile-schema";

const enabled = process.env.HAS_TEST_DB === "1";

describe.skipIf(!enabled)("profile repository (integration)", () => {
  let userId: string;
  let mod: typeof import("@/server/profile/repository");
  let dbMod: typeof import("@/server/db/client");
  let schema: typeof import("@/server/db/schema");

  beforeAll(async () => {
    mod = await import("@/server/profile/repository");
    dbMod = await import("@/server/db/client");
    schema = await import("@/server/db/schema");
    const [u] = await dbMod.db
      .insert(schema.users)
      .values({ username: `it_${Date.now()}`, passwordHash: "x" })
      .returning({ id: schema.users.id });
    userId = u!.id;
  });

  afterAll(async () => {
    if (!userId) return;
    const { eq } = await import("drizzle-orm");
    await dbMod.db.delete(schema.users).where(eq(schema.users.id, userId)); // cascades
  });

  it("returns empty values for a user without a profile", async () => {
    const p = await mod.getProfile(userId);
    expect(p).toMatchObject({ exists: false, name: null, experiences: [], educations: [] });
  });

  it("saves, reloads in order, and replaces lists", async () => {
    const data = profileSchema.parse({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "",
      linkedin: "linkedin.com/in/jane",
      github: "",
      headline: "AI Engineer",
      location: "Manila, Philippines",
      skills: "Python, FastAPI",
      languages: "English — Fluent",
      experiences: [
        { company: "Beta", role: "Lead", location: "Remote", startDate: "2022-01", endDate: "" },
        { company: "Alpha", role: "Dev", startDate: "2019-05", endDate: "2021-12" },
      ],
      educations: [{ university: "MIT", degree: "BSc", field: "Computer Science", location: "", startDate: "2015-09", endDate: "2019-06" }],
    });
    await mod.saveProfile(userId, data);

    let p = await mod.getProfile(userId);
    expect(p.exists).toBe(true);
    expect(p.linkedin).toBe("https://linkedin.com/in/jane");
    expect(p.phone).toBeNull();
    expect(p.experiences.map((e) => e.company)).toEqual(["Beta", "Alpha"]);
    expect(p.experiences[0]?.endDate).toBeNull();
    expect(p).toMatchObject({ headline: "AI Engineer", location: "Manila, Philippines", skills: "Python, FastAPI", languages: "English — Fluent" });
    expect(p.experiences.map((e) => e.location)).toEqual(["Remote", null]);
    expect(p.educations[0]).toMatchObject({ university: "MIT", field: "Computer Science", location: null });

    // Remove a company, clear education, change the name.
    await mod.saveProfile(userId, { ...data, name: null, experiences: [data.experiences[1]!], educations: [] });
    p = await mod.getProfile(userId);
    expect(p.name).toBeNull();
    expect(p.experiences.map((e) => e.company)).toEqual(["Alpha"]);
    expect(p.educations).toEqual([]);
  });
});
