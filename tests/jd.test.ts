import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jdBatchSchema, parseJdBlock, singleJdSchema, splitJobDescriptions } from "@/lib/jd";
import { decodeText, detectKind, extractText } from "@/server/jd/parse-file";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const longText = "x".repeat(40);

describe("splitJobDescriptions", () => {
  it("splits on 8+ slashes, trims and drops empty blocks", () => {
    const text = "  JD one  \n////////\n\nJD two\n//////////////\n   \n////////";
    expect(splitJobDescriptions(text)).toEqual(["JD one", "JD two"]);
  });

  it("does not split on shorter slash runs such as URLs", () => {
    expect(splitJobDescriptions("see https://example.com/jobs//123")).toHaveLength(1);
  });

  it("normalises CRLF and collapses blank lines", () => {
    expect(splitJobDescriptions("a\r\n\r\n\r\n\r\nb  \r\n")).toEqual(["a\n\nb"]);
  });

  it("handles a real Windows-style file", () => {
    const blocks = splitJobDescriptions(decodeText(fixture("crlf-trailing-separator.txt")));
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatch(/^QA Engineer at Hooli/);
  });
});

describe("parseJdBlock", () => {
  it("reads role, company and JD headers (the user's file format)", () => {
    const [a, b] = splitJobDescriptions(
      "role: Full stack developer\ncompamy: Gamba\nJD: Build things.\nMore lines.\n////////////////\nRole: QA\nCompany: Hooli\nJD:\nTest things.",
    ).map(parseJdBlock);
    expect(a).toEqual({ role: "Full stack developer", company: "Gamba", description: "Build things.\nMore lines." });
    expect(b).toEqual({ role: "QA", company: "Hooli", description: "Test things." });
  });

  it("accepts a JSON-like wrapper with quotes and commas", () => {
    expect(parseJdBlock('{\n  "role": "Dev",\n  "company": "Acme",\n  "JD": "Do work"\n}')).toEqual({ role: "Dev", company: "Acme", description: "Do work" });
  });

  it("leaves a block without a header untouched", () => {
    const text = "Senior Engineer at Acme\nNote: remote OK";
    expect(parseJdBlock(text)).toEqual({ role: "", company: "", description: text });
  });
});

describe("detectKind", () => {
  const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
  const text = new TextEncoder().encode("hello");

  it.each([
    ["a.txt", text, "txt"],
    ["a.TXT", text, "txt"],
    ["a.doc", ole, "doc"],
    ["a.doc", zip, "docx"],
    ["a.docx", zip, "docx"],
  ] as const)("%s → %s", (name, bytes, kind) => expect(detectKind(name, bytes)).toBe(kind));

  it.each([
    ["renamed binary as .txt", "a.txt", ole],
    ["zip as .txt", "a.txt", zip],
    ["text as .doc", "a.doc", text],
    ["text as .docx", "a.docx", text],
    ["NUL bytes in .txt", "a.txt", Uint8Array.from([0x41, 0x00, 0x42])],
    ["pdf", "a.pdf", text],
    ["no extension", "README", text],
  ] as const)("rejects %s", (_l, name, bytes) => expect(detectKind(name, bytes)).toBeNull());

  it("accepts UTF-16 text (contains NUL bytes but has a BOM)", () => {
    expect(detectKind("a.txt", Uint8Array.from([0xff, 0xfe, 0x41, 0x00]))).toBe("txt");
  });
});

describe("decodeText", () => {
  it("strips the UTF-8 BOM", () => {
    expect(decodeText(Uint8Array.from([0xef, 0xbb, 0xbf, 0x68, 0x69]))).toBe("hi");
  });
  it("decodes UTF-16LE with BOM", () => {
    expect(decodeText(Uint8Array.from([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]))).toBe("hi");
  });
  it("falls back to Windows-1252 for invalid UTF-8", () => {
    expect(decodeText(Uint8Array.from([0x63, 0x61, 0x66, 0xe9]))).toBe("café");
  });
});

let hasWordExtractor = true;
try {
  await import(/* @vite-ignore */ "word-extractor");
} catch {
  hasWordExtractor = false;
}

describe.skipIf(!hasWordExtractor)("extractText (.docx, needs word-extractor)", () => {
  it("reads a .docx and splits it into two JDs", async () => {
    const bytes = fixture("two-jds.docx");
    expect(detectKind("two-jds.docx", bytes)).toBe("docx");
    const blocks = splitJobDescriptions(await extractText("docx", bytes));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatch(/^Senior Backend Engineer at Acme/);
    expect(blocks[1]).toMatch(/^Frontend Developer at Globex/);
  });
});

describe("JD schemas", () => {
  it("single mode requires role and company", () => {
    expect(singleJdSchema.safeParse({ role: "", company: "", description: longText }).success).toBe(false);
    expect(singleJdSchema.safeParse({ role: "Dev", company: "Acme", description: longText }).success).toBe(true);
  });

  it("single mode rejects too-short descriptions", () => {
    expect(singleJdSchema.safeParse({ role: "Dev", company: "Acme", description: "too short" }).success).toBe(false);
  });

  it("multi mode makes role/company optional (empty → null)", () => {
    const r = jdBatchSchema.parse([{ role: "", company: " ", description: longText }]);
    expect(r[0]).toMatchObject({ role: null, company: null });
  });

  it("multi mode needs at least one and at most 50 blocks", () => {
    expect(jdBatchSchema.safeParse([]).success).toBe(false);
    expect(jdBatchSchema.safeParse(Array(51).fill({ role: "", company: "", description: longText })).success).toBe(false);
  });
});
