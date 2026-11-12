import "server-only";
import { asc, eq } from "drizzle-orm";
import type { ProfileData } from "@/lib/profile-schema";
import { db } from "../db/client";
import { educations, experiences, profiles } from "../db/schema";

/** Returns the user's profile; a user who never saved one gets empty values. */
export async function getProfile(userId: string): Promise<ProfileData & { exists: boolean }> {
  const [profileRows, experienceRows, educationRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select({
        company: experiences.company,
        role: experiences.role,
        location: experiences.location,
        startDate: experiences.startDate,
        endDate: experiences.endDate,
      })
      .from(experiences)
      .where(eq(experiences.userId, userId))
      .orderBy(asc(experiences.sortOrder)),
    db
      .select({
        university: educations.university,
        degree: educations.degree,
        field: educations.field,
        location: educations.location,
        startDate: educations.startDate,
        endDate: educations.endDate,
      })
      .from(educations)
      .where(eq(educations.userId, userId))
      .orderBy(asc(educations.sortOrder)),
  ]);

  const p = profileRows[0];
  return {
    exists: Boolean(p),
    name: p?.name ?? null,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    linkedin: p?.linkedin ?? null,
    github: p?.github ?? null,
    headline: p?.headline ?? null,
    location: p?.location ?? null,
    skills: p?.skills ?? null,
    languages: p?.languages ?? null,
    experiences: experienceRows,
    educations: educationRows,
  };
}

/** Saves the whole profile atomically; list order becomes sort order. */
export async function saveProfile(userId: string, data: ProfileData): Promise<void> {
  const contact = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    linkedin: data.linkedin,
    github: data.github,
    headline: data.headline,
    location: data.location,
    skills: data.skills,
    languages: data.languages,
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId, ...contact })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...contact, updatedAt: new Date() } });

    await tx.delete(experiences).where(eq(experiences.userId, userId));
    if (data.experiences.length > 0) {
      await tx.insert(experiences).values(data.experiences.map((e, i) => ({ ...e, userId, sortOrder: i })));
    }

    await tx.delete(educations).where(eq(educations.userId, userId));
    if (data.educations.length > 0) {
      await tx.insert(educations).values(data.educations.map((e, i) => ({ ...e, userId, sortOrder: i })));
    }
  });
}
