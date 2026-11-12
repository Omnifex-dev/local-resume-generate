import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, inTab, matchesQuery, type HistoryEntry } from "@/lib/history";

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: "0b6c7c64-6a3e-4c55-9d1b-6d2f7f0f6a11",
  status: "succeeded",
  role: "Senior Engineer",
  company: "Acme",
  model: "gpt",
  content: null,
  extras: null,
  jobDescription: "",
  error: null,
  pdfFileName: "Senior_Engineer-Acme-1762800000000.pdf",
  jsonFileName: null,
  createdAt: "2026-11-11T09:30:00.123Z",
  finishedAt: null,
  ...over,
});

describe("history cursor", () => {
  it("round-trips", () => {
    const e = entry();
    expect(decodeCursor(encodeCursor(e))).toEqual({ createdAt: new Date(e.createdAt), id: e.id });
  });
  it("rejects junk", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("nope")).toBeNull();
    expect(decodeCursor("not-a-date_0b6c7c64-6a3e-4c55-9d1b-6d2f7f0f6a11")).toBeNull();
    expect(decodeCursor("2026-11-11T09:30:00.000Z_'; drop table")).toBeNull();
  });
});

describe("matchesQuery", () => {
  it("matches role, company, PDF name and date text, case-insensitively", () => {
    const e = entry();
    expect(matchesQuery(e, "")).toBe(true);
    expect(matchesQuery(e, "senior")).toBe(true);
    expect(matchesQuery(e, "ACME")).toBe(true);
    expect(matchesQuery(e, "1762800000000.pdf")).toBe(true);
    expect(matchesQuery(e, "nov 11", "Nov 11, 2026, 09:30 AM 2026-11-11")).toBe(true);
    expect(matchesQuery(e, "designer")).toBe(false);
  });
  it("handles records without role or file name", () => {
    expect(matchesQuery(entry({ role: null, company: null, pdfFileName: null }), "x")).toBe(false);
  });
});

describe("inTab", () => {
  it("splits succeeded from pending and failed", () => {
    expect(inTab(entry(), "created")).toBe(true);
    expect(inTab(entry({ status: "pending" }), "not-created")).toBe(true);
    expect(inTab(entry({ status: "failed" }), "created")).toBe(false);
  });
});
