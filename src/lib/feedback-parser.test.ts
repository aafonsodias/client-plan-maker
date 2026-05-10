import { describe, it, expect } from "vitest";
import { parseRpeOverrideFromFeedback } from "./feedback-parser";

describe("parseRpeOverrideFromFeedback", () => {
  it("returns null for empty/null", () => {
    expect(parseRpeOverrideFromFeedback("")).toBeNull();
    expect(parseRpeOverrideFromFeedback(null)).toBeNull();
    expect(parseRpeOverrideFromFeedback("apenas mexe nas séries")).toBeNull();
  });

  it("parses 'começa em rpe 6.5'", () => {
    expect(parseRpeOverrideFromFeedback("começa em rpe 6.5")).toEqual({ rpe_ceiling: 7.5 });
    // 6.5 clamps up to 7.5 (schema floor for rpe_ceiling).
  });

  it("parses 'cap RPE at 8'", () => {
    expect(parseRpeOverrideFromFeedback("cap RPE at 8")).toEqual({ rpe_ceiling: 8 });
  });

  it("parses 'tecto 7.5'", () => {
    expect(parseRpeOverrideFromFeedback("tecto 7.5")).toEqual({ rpe_ceiling: 7.5 });
  });

  it("parses 'rpe 6-7' as floor+ceiling", () => {
    expect(parseRpeOverrideFromFeedback("rpe 6-7 esta semana")).toEqual({ rpe_floor: 6, rpe_ceiling: 7.5 });
  });

  it("parses 'start at rpe 7'", () => {
    expect(parseRpeOverrideFromFeedback("Please start at RPE 7")).toEqual({ rpe_ceiling: 7.5 });
  });

  it("uses the LAST mention as ceiling (refinement wins)", () => {
    expect(parseRpeOverrideFromFeedback("rpe 9 mas cap em 7.5")).toEqual({ rpe_ceiling: 7.5 });
  });

  it("ignores out-of-range numbers", () => {
    expect(parseRpeOverrideFromFeedback("rpe 12")).toBeNull();
    expect(parseRpeOverrideFromFeedback("rpe 2")).toBeNull();
  });

  it("clamps below 7.5 up to 7.5 (schema bound)", () => {
    expect(parseRpeOverrideFromFeedback("rpe 6")).toEqual({ rpe_ceiling: 7.5 });
  });
});
