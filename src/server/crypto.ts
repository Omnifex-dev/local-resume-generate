import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super("ENCRYPTION_KEY is not set. Add it to .env (openssl rand -base64 32) and restart the app.");
  }
}

function key(): Buffer {
  if (!env.ENCRYPTION_KEY) throw new EncryptionNotConfiguredError();
  return Buffer.from(env.ENCRYPTION_KEY, "base64");
}

/**
 * AES-256-GCM. `context` (e.g. the user id) is bound as associated data, so a
 * ciphertext copied to another user's row fails to decrypt.
 */
export function encryptSecret(plaintext: string, context: string, keyBytes: Buffer = key()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyBytes, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")}`;
}

export function decryptSecret(payload: string, context: string, keyBytes: Buffer = key()): string {
  const [version, data] = payload.split(":", 2);
  if (version !== VERSION || !data) throw new Error("Unsupported secret format");
  const raw = Buffer.from(data, "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes, iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}
