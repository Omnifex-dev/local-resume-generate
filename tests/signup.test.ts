import { describe, expect, it } from "vitest";
import { maskEmail } from "@/server/auth/signup";

describe("maskEmail", () => {
  it.each([
    ["jane.doe@gmail.com", "ja•••@gmail.com"],
    ["ab@x.io", "a•••@x.io"],
    ["a@x.io", "a•••@x.io"],
  ])("%s → %s", (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });
});
