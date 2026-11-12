import { describe, expect, it } from "vitest";
import { MAX_EXPERIENCES, normalizeUrl, profileSchema, toFieldErrors } from "@/lib/profile-schema";

const base = {
  name: "",
  email: "",
  phone: "",
  linkedin: "",
  github: "",
  experiences: [],
  educations: [],
};

const exp = { company: "Acme", role: "Engineer", startDate: "2020-01", endDate: "" };
const edu = { university: "MIT", degree: "", location: "", startDate: "2015-09", endDate: "2019-06" };

describe("normalizeUrl", () => {
  it("adds https when missing", () => {
    expect(normalizeUrl("linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
  });
  it("keeps explicit http(s)", () => {
    expect(normalizeUrl("http://github.com/jane")).toBe("http://github.com/jane");
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://x.com", "localhost", "not a url"])(
    "rejects %s",
    (v) => expect(normalizeUrl(v)).toBeNull(),
  );
});

describe("profileSchema", () => {
  it("turns empty strings into null", () => {
    const r = profileSchema.parse(base);
    expect(r).toMatchObject({ name: null, email: null, phone: null, linkedin: null, github: null });
  });

  it("normalises email and links", () => {
    const r = profileSchema.parse({ ...base, email: " Jane@Example.COM ", github: "github.com/jane" });
    expect(r.email).toBe("jane@example.com");
    expect(r.github).toBe("https://github.com/jane");
  });

  it("rejects bad contact fields with path-based errors", () => {
    const r = profileSchema.safeParse({ ...base, email: "nope", phone: "call me", linkedin: "javascript:x" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(Object.keys(toFieldErrors(r.error)).sort()).toEqual(["email", "linkedin", "phone"]);
    }
  });

  it("maps an empty end date to null (Present)", () => {
    const r = profileSchema.parse({ ...base, experiences: [exp] });
    expect(r.experiences[0]?.endDate).toBeNull();
  });

  it("requires company, role and a valid start", () => {
    const r = profileSchema.safeParse({ ...base, experiences: [{ company: " ", role: "", startDate: "2020", endDate: "" }] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errors = toFieldErrors(r.error);
      expect(errors).toHaveProperty("experiences.0.company");
      expect(errors).toHaveProperty("experiences.0.role");
      expect(errors).toHaveProperty("experiences.0.startDate");
    }
  });

  it("rejects an end before the start", () => {
    const r = profileSchema.safeParse({ ...base, educations: [{ ...edu, endDate: "2014-01" }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error)).toHaveProperty("educations.0.endDate");
  });

  it("keeps optional education fields null", () => {
    const r = profileSchema.parse({ ...base, educations: [edu] });
    expect(r.educations[0]).toMatchObject({ degree: null, location: null });
  });

  it("caps the number of companies", () => {
    const r = profileSchema.safeParse({ ...base, experiences: Array(MAX_EXPERIENCES + 1).fill(exp) });
    expect(r.success).toBe(false);
  });
});
