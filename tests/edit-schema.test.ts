import { describe, expect, it } from "vitest";
import { normalizeEdit, resumeEditSchema } from "@/lib/edit-schema";

describe("resume edit", () => {
  it("trims text and drops empty bullets, skills and categories", () => {
    const e = normalizeEdit({
      role: "  Backend  Engineer ",
      company: "Acme",
      content: { Acme: ["  Built **APIs**  ", "", "   "] },
      extras: {
        summary: " Hello\n world ",
        skills: [
          { category: "Lang", items: [" Go", "", "TS "] },
          { category: "", items: ["x"] },
          { category: "Empty", items: [" "] },
        ],
        additional: ["", " Remote "],
      },
    });
    expect(e).toEqual({
      role: "Backend Engineer",
      company: "Acme",
      content: { Acme: ["Built **APIs**"] },
      extras: { summary: "Hello world", skills: [{ category: "Lang", items: ["Go", "TS"] }], additional: ["Remote"] },
    });
  });

  it("requires role and company", () => {
    const r = resumeEditSchema.safeParse({ role: " ", company: "A", content: {}, extras: { summary: "", skills: [], additional: [] } });
    expect(r.success).toBe(false);
  });
});
