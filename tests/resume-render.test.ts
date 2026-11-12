import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/themes";
import { contentKeys } from "@/server/ai/resume-content";
import { findChrome, renderPdf } from "@/server/pdf/chrome";
import { renderResumeHtml, rich, safeHref } from "@/resume/html";
import { buildResumeModel, displayUrl, parseLanguages, type ProfileSnapshot } from "@/resume/model";
import { SAMPLE_EXTRAS, SAMPLE_PROFILE } from "@/resume/sample";

const empty: ProfileSnapshot = { name: null, email: null, phone: null, linkedin: null, github: null, experiences: [], educations: [] };

describe("buildResumeModel", () => {
  it("falls back to the username and omits every empty field", () => {
    const m = buildResumeModel(
      { ...empty, experiences: [{ company: "Acme", role: "Dev", startDate: "2020-01", endDate: null }], educations: [{ university: "MIT", degree: null, location: null, startDate: "2015-09", endDate: "2019-06" }] },
      [],
      "carl",
    );
    expect(m.name).toBe("carl");
    expect(m.contact).toEqual([]);
    expect(m.experiences[0]).toEqual({ company: "Acme", role: "Dev", period: "Jan 2020 – Present", bullets: [] });
    expect(m.educations[0]).toEqual({ university: "MIT", period: "Sep 2015 – Jun 2019" });
  });

  it("builds contact links and display labels", () => {
    const m = buildResumeModel(SAMPLE_PROFILE, [], "x");
    expect(m.contact.map((c) => c.kind)).toEqual(["location", "email", "phone", "linkedin", "github"]);
    expect(m.contact[0]).toEqual({ kind: "location", label: "Springfield, USA" });
    expect(m.contact[2]).toMatchObject({ href: "tel:+15550102030" });
    expect(m.contact[3]).toMatchObject({ label: "linkedin.com/in/alexmorgan" });
  });

  it("treats whitespace-only new fields as missing", () => {
    const m = buildResumeModel(
      { ...empty, headline: "  ", location: "", languages: "\n \n", experiences: [{ company: "A", role: "B", location: " ", startDate: "2020-01", endDate: null }] },
      [],
      "x",
      { summary: "", skills: [{ category: "Empty", items: [] }], additional: [] },
    );
    expect(m).toMatchObject({ contact: [], skills: [], languages: [], additional: [] });
    expect(m).not.toHaveProperty("headline");
    expect(m).not.toHaveProperty("summary");
    expect(m.experiences[0]).not.toHaveProperty("location");
  });

  it("parses languages in common formats", () => {
    expect(parseLanguages("English — Fluent\n- German: B2\nFrench (basic)\nSpanish\nTagalog - Native")).toEqual([
      { name: "English", level: "Fluent" },
      { name: "German", level: "B2" },
      { name: "French", level: "basic" },
      { name: "Spanish" },
      { name: "Tagalog", level: "Native" },
    ]);
  });

  it("rich() bolds **keywords** only after escaping", () => {
    expect(rich("Built **Python** & **<b>x</b>** APIs")).toBe("Built <strong>Python</strong> &amp; <strong>&lt;b&gt;x&lt;/b&gt;</strong> APIs");
    expect(rich("odd ** marker")).toBe("odd  marker");
    expect(rich("** spaced **")).toBe(" spaced ");
  });

  it("displayUrl strips scheme, www and trailing slash", () => {
    expect(displayUrl("https://www.github.com/jane/")).toBe("github.com/jane");
  });

  it("aligns content keys with profile order, including duplicate companies", () => {
    expect(contentKeys([{ company: "Acme", role: "Sr" }, { company: "Beta", role: "x" }, { company: "acme", role: "Jr" }])).toEqual([
      "Acme (Sr)",
      "Beta",
      "acme (Jr)",
    ]);
  });
});

describe.each(THEMES.map((t) => t.id))("theme %s", (theme) => {
  it("leaves out empty sections, labels and placeholders", () => {
    const html = renderResumeHtml(buildResumeModel(empty, [], "carl"), theme);
    expect(html).toContain("carl");
    for (const word of [
      "Experience",
      "Education",
      "Contact",
      "Summary",
      "Skills",
      "Languages",
      "Additional",
      `class="headline"`,
      "LinkedIn",
      "GitHub",
      "<svg",
      "mailto:",
      "null",
      "undefined",
      "<ul></ul>",
      "<strong></strong>",
    ]) {
      expect(html).not.toContain(word);
    }
  });

  it("renders everything from a full profile", () => {
    const html = renderResumeHtml(buildResumeModel(SAMPLE_PROFILE, [["Did <b>things</b> & more"]], "x"), theme, "Letter");
    expect(html).toContain("size:Letter");
    expect(html).toContain("Alex Morgan");
    expect(html).toContain("Northwind Labs");
    expect(html).toContain("B.Sc. Computer Science");
    expect(html).toContain('href="mailto:alex.morgan@example.com"');
    expect(html).toContain("Did &lt;b&gt;things&lt;/b&gt; &amp; more");
  });

  it("renders headline, location, summary, skills, languages and additional info", () => {
    const html = renderResumeHtml(buildResumeModel(SAMPLE_PROFILE, [["Built **Kafka** pipelines"]], "x", SAMPLE_EXTRAS), theme);
    expect(html).toContain("Senior Software Engineer");
    expect(html).toContain("Springfield, USA");
    expect(html).toContain("<strong>backend services</strong>");
    expect(html).toContain("Built <strong>Kafka</strong> pipelines");
    expect(html).toContain("Cloud &amp; DevOps");
    expect(html).toContain("Terraform");
    expect(html).toContain("Spanish");
    expect(html).toContain("Conversational");
    expect(html).toContain("Distributed Systems");
    expect(html).toContain("available to start within four weeks");
    expect(html).not.toContain("**");
  });

  it("escapes hostile profile text and drops unsafe links", () => {
    const evil: ProfileSnapshot = {
      ...empty,
      name: '<script>alert(1)</script>',
      linkedin: "javascript:alert(1)",
      experiences: [{ company: '"><img src=x onerror=alert(1)>', role: "r", startDate: "2020-01", endDate: null }],
    };
    const html = renderResumeHtml(
      buildResumeModel({ ...evil, headline: "<script>x</script>", languages: "<img src=x>" }, [["**<script>**"]], "x", {
        summary: "**<img src=x onerror=1>**",
        skills: [{ category: "<script>", items: ["<img>"] }],
        additional: ["<iframe>"],
      }),
      theme,
    );
    expect(html).not.toMatch(/<script|<img|<iframe|href="javascript/i);
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("safeHref", () => {
  it.each(["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "//evil.com"])("rejects %s", (h) => expect(safeHref(h)).toBeNull());
  it("escapes quotes in allowed links", () => expect(safeHref('https://a.com/"x')).toBe("https://a.com/&quot;x"));
});

const chrome = findChrome(process.env.CHROME_PATH);
const hasPdftotext = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!chrome)("renderPdf (needs Chrome)", () => {
  it("prints a real PDF whose text is extractable (ATS-friendly)", { timeout: 60_000 }, async () => {
    const html = renderResumeHtml(buildResumeModel(SAMPLE_PROFILE, [["Cut latency by 40%"], ["Shipped CI"]], "x"), "modern");
    const pdf = await renderPdf(html);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    if (hasPdftotext) {
      const text = execFileSync("pdftotext", ["-", "-"], { input: pdf }).toString();
      expect(text).toContain("Alex Morgan");
      expect(text).toContain("Cut latency by 40%");
    }
  });

  it("does not load remote resources", { timeout: 60_000 }, async () => {
    // If network were allowed this would hang or fetch; it must still render quickly.
    const started = Date.now();
    const pdf = await renderPdf('<!doctype html><img src="http://example.com/x.png"><p>ok</p>', { timeoutMs: 20_000 });
    expect(pdf.length).toBeGreaterThan(500);
    expect(Date.now() - started).toBeLessThan(20_000);
  });

  it("reports a missing Chrome clearly", async () => {
    await expect(renderPdf("<p>x</p>", { chromePath: "/nonexistent/chrome" })).rejects.toThrow(/not found/);
  });
});

describe.skipIf(!chrome || !hasPdftotext)("ATS text extraction (needs Chrome + pdftotext)", () => {
  it.each(THEMES.map((t) => t.id))("%s headings extract as whole words", { timeout: 60_000 }, async (theme) => {
    const pdf = await renderPdf(renderResumeHtml(buildResumeModel(SAMPLE_PROFILE, [["Built **Kafka** pipelines"], ["y"]], "x", SAMPLE_EXTRAS), theme));
    const text = execFileSync("pdftotext", ["-", "-"], { input: pdf }).toString();
    expect(text).toContain("Built Kafka pipelines");
    expect(text).toMatch(/EXPERIENCE|Experience/);
    expect(text).toMatch(/EDUCATION|Education/);
    expect(text).toMatch(/SKILLS|Skills/);
    expect(text).not.toMatch(/E X P|C O N|E D U|S K I|S U M/);
  });
});
