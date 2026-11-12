import { describe, expect, it } from "vitest";
import { formatMonth, formatPeriod } from "@/lib/period";

describe("period formatting", () => {
  it("formats months", () => {
    expect(formatMonth("2021-03")).toBe("Mar 2021");
    expect(formatMonth("1999-12")).toBe("Dec 1999");
  });

  it("returns invalid input unchanged", () => {
    expect(formatMonth("2021-13")).toBe("2021-13");
  });

  it("uses Present for an open end", () => {
    expect(formatPeriod("2020-01", null)).toBe("Jan 2020 – Present");
    expect(formatPeriod("2020-01", "2022-06")).toBe("Jan 2020 – Jun 2022");
  });
});
