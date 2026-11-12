import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP-recommended minimums (19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false; // malformed hash
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Burn the same CPU time as a real check when the user doesn't exist,
 * so response timing doesn't reveal which usernames are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  await verifyPassword(await dummyHash, password);
}
