import { describe, expect, it } from "vitest";
import { codeSchema, loginSchema, registerSchema } from "@/server/auth/validation";

describe("registerSchema", () => {
  const valid = { username: "Jane.Doe", email: " Jane@Example.COM ", password: "correct-horse" };

  it("accepts valid input and lower-cases username and email", () => {
    const r = registerSchema.parse(valid);
    expect(r.username).toBe("jane.doe");
    expect(r.email).toBe("jane@example.com");
  });

  it("trims whitespace around the username", () => {
    expect(registerSchema.parse({ ...valid, username: "  bob  " }).username).toBe("bob");
  });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(33)],
    ["illegal chars", "bob smith"],
    ["illegal chars", "bob<script>"],
    ["an email", "bob@example.com"],
  ])("rejects username: %s", (_label, username) => {
    expect(registerSchema.safeParse({ ...valid, username }).success).toBe(false);
  });

  it.each(["", "not-an-email", "a@b", "two@@example.com"])("rejects email %j", (email) => {
    const r = registerSchema.safeParse({ ...valid, email });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.email).toBeDefined();
  });

  it("rejects short passwords", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalises a username or email", () => {
    expect(loginSchema.parse({ identifier: " Alice ", password: "x" }).identifier).toBe("alice");
    expect(loginSchema.parse({ identifier: "Alice@Mail.com", password: "x" }).identifier).toBe("alice@mail.com");
  });

  it("requires both fields", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "" }).success).toBe(false);
  });
});

describe("codeSchema", () => {
  it.each(["123456", " 123 456 ", "123-456", "000000"])("accepts %j", (code) => {
    expect(codeSchema.parse(code)).toMatch(/^\d{6}$/);
  });

  it.each(["12345", "1234567", "abcdef", ""])("rejects %j", (code) => {
    expect(codeSchema.safeParse(code).success).toBe(false);
  });
});
