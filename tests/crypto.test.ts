import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/server/crypto";

const key = randomBytes(32);

describe("encryptSecret / decryptSecret", () => {
  it("round-trips", () => {
    const enc = encryptSecret("sk-test-123", "user-1", key);
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain("sk-test-123");
    expect(decryptSecret(enc, "user-1", key)).toBe("sk-test-123");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", "u", key)).not.toBe(encryptSecret("same", "u", key));
  });

  it("fails for another user's context (row swap)", () => {
    const enc = encryptSecret("sk-secret", "user-1", key);
    expect(() => decryptSecret(enc, "user-2", key)).toThrow();
  });

  it("fails with the wrong key", () => {
    const enc = encryptSecret("sk-secret", "u", key);
    expect(() => decryptSecret(enc, "u", randomBytes(32))).toThrow();
  });

  it("detects tampering", () => {
    const enc = encryptSecret("sk-secret", "u", key);
    const raw = Buffer.from(enc.slice(3), "base64");
    raw[raw.length - 1]! ^= 1;
    expect(() => decryptSecret(`v1:${raw.toString("base64")}`, "u", key)).toThrow();
  });
});
