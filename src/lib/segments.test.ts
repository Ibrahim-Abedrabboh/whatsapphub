import { describe, it, expect } from "vitest";
import { matchContact, evalCondition, asStringArray, type MatchableContact, type SegmentRules } from "./segments";

const contact = (over: Partial<MatchableContact> = {}): MatchableContact => ({
  name: "Ahmed Ali",
  optedOut: false,
  tags: ["vip", "riyadh"],
  attributes: { city: "Riyadh", plan: "gold" },
  ...over,
});

const rules = (match: "all" | "any", conditions: SegmentRules["conditions"]): SegmentRules => ({ match, conditions });

describe("evalCondition — name", () => {
  it("eq matches case-insensitively", () => {
    expect(evalCondition(contact(), { field: "name", op: "eq", value: "ahmed ali" })).toBe(true);
  });
  it("eq rejects a different name", () => {
    expect(evalCondition(contact(), { field: "name", op: "eq", value: "Sara" })).toBe(false);
  });
  it("contains matches a substring", () => {
    expect(evalCondition(contact(), { field: "name", op: "contains", value: "ali" })).toBe(true);
  });
  it("neq is true when the name differs and when it's missing", () => {
    expect(evalCondition(contact(), { field: "name", op: "neq", value: "Sara" })).toBe(true);
    expect(evalCondition(contact({ name: null }), { field: "name", op: "neq", value: "Sara" })).toBe(true);
  });
  it("exists is false for a null or blank name", () => {
    expect(evalCondition(contact({ name: null }), { field: "name", op: "exists" })).toBe(false);
    expect(evalCondition(contact({ name: "  " }), { field: "name", op: "exists" })).toBe(false);
    expect(evalCondition(contact(), { field: "name", op: "exists" })).toBe(true);
  });
  it("eq/contains never match a missing name", () => {
    expect(evalCondition(contact({ name: null }), { field: "name", op: "eq", value: "" })).toBe(false);
    expect(evalCondition(contact({ name: null }), { field: "name", op: "contains", value: "a" })).toBe(false);
  });
});

describe("evalCondition — tag", () => {
  it("eq matches an exact tag (case-insensitive)", () => {
    expect(evalCondition(contact(), { field: "tag", op: "eq", value: "VIP" })).toBe(true);
  });
  it("eq rejects an absent tag", () => {
    expect(evalCondition(contact(), { field: "tag", op: "eq", value: "gold" })).toBe(false);
  });
  it("neq is true only when the tag is absent", () => {
    expect(evalCondition(contact(), { field: "tag", op: "neq", value: "gold" })).toBe(true);
    expect(evalCondition(contact(), { field: "tag", op: "neq", value: "vip" })).toBe(false);
  });
  it("contains matches a substring of any tag", () => {
    expect(evalCondition(contact(), { field: "tag", op: "contains", value: "riya" })).toBe(true);
    expect(evalCondition(contact(), { field: "tag", op: "contains", value: "xyz" })).toBe(false);
  });
  it("exists reflects having any tag at all", () => {
    expect(evalCondition(contact(), { field: "tag", op: "exists" })).toBe(true);
    expect(evalCondition(contact({ tags: [] }), { field: "tag", op: "exists" })).toBe(false);
  });
  it("tolerates a malformed tags column", () => {
    expect(evalCondition(contact({ tags: "not-an-array" }), { field: "tag", op: "eq", value: "vip" })).toBe(false);
    expect(evalCondition(contact({ tags: [1, "vip"] }), { field: "tag", op: "eq", value: "vip" })).toBe(true);
  });
});

describe("evalCondition — attributes", () => {
  it("attr:<key> eq matches the attribute value", () => {
    expect(evalCondition(contact(), { field: "attr:city", op: "eq", value: "riyadh" })).toBe(true);
  });
  it("attr:<key> eq rejects a different value or a missing key", () => {
    expect(evalCondition(contact(), { field: "attr:city", op: "eq", value: "Jeddah" })).toBe(false);
    expect(evalCondition(contact(), { field: "attr:missing", op: "eq", value: "x" })).toBe(false);
  });
  it("attr:<key> exists / neq handle a missing key", () => {
    expect(evalCondition(contact(), { field: "attr:plan", op: "exists" })).toBe(true);
    expect(evalCondition(contact(), { field: "attr:missing", op: "exists" })).toBe(false);
    expect(evalCondition(contact(), { field: "attr:missing", op: "neq", value: "gold" })).toBe(true);
  });
  it("tolerates malformed attributes and non-string values", () => {
    expect(evalCondition(contact({ attributes: null }), { field: "attr:city", op: "eq", value: "Riyadh" })).toBe(false);
    expect(evalCondition(contact({ attributes: { age: 30 } }), { field: "attr:age", op: "eq", value: "30" })).toBe(true);
    expect(evalCondition(contact({ attributes: { nested: { a: 1 } } }), { field: "attr:nested", op: "exists" })).toBe(false);
  });
});

describe("evalCondition — optedOut + unknown fields", () => {
  it("isTrue reflects the flag", () => {
    expect(evalCondition(contact({ optedOut: true }), { field: "optedOut", op: "isTrue" })).toBe(true);
    expect(evalCondition(contact(), { field: "optedOut", op: "isTrue" })).toBe(false);
  });
  it("eq/neq compare against 'true'/'false'", () => {
    expect(evalCondition(contact(), { field: "optedOut", op: "eq", value: "false" })).toBe(true);
    expect(evalCondition(contact(), { field: "optedOut", op: "neq", value: "true" })).toBe(true);
    expect(evalCondition(contact({ optedOut: true }), { field: "optedOut", op: "eq", value: "false" })).toBe(false);
  });
  it("isTrue on a non-boolean field is false", () => {
    expect(evalCondition(contact(), { field: "name", op: "isTrue" })).toBe(false);
    expect(evalCondition(contact(), { field: "tag", op: "isTrue" })).toBe(false);
  });
  it("an unknown field never matches", () => {
    expect(evalCondition(contact(), { field: "phone", op: "eq", value: "123" })).toBe(false);
    expect(evalCondition(contact(), { field: "", op: "exists" })).toBe(false);
  });
});

describe("matchContact — all / any", () => {
  const vipInRiyadh = rules("all", [
    { field: "tag", op: "eq", value: "vip" },
    { field: "attr:city", op: "eq", value: "Riyadh" },
  ]);

  it("all requires every condition", () => {
    expect(matchContact(contact(), vipInRiyadh)).toBe(true);
    expect(matchContact(contact({ tags: ["riyadh"] }), vipInRiyadh)).toBe(false);
  });

  it("any requires at least one condition", () => {
    const anyRules = rules("any", [
      { field: "tag", op: "eq", value: "gold" },
      { field: "attr:city", op: "eq", value: "Riyadh" },
    ]);
    expect(matchContact(contact(), anyRules)).toBe(true);
    expect(matchContact(contact({ attributes: {} }), anyRules)).toBe(false);
  });

  it("an empty or malformed rule set matches nobody", () => {
    expect(matchContact(contact(), rules("all", []))).toBe(false);
    expect(matchContact(contact(), { match: "any", conditions: undefined as never })).toBe(false);
  });
});

describe("asStringArray", () => {
  it("keeps string entries, drops the rest", () => {
    expect(asStringArray(["a", 1, null, "b"])).toEqual(["a", "b"]);
  });
  it("returns [] for non-arrays", () => {
    expect(asStringArray("x")).toEqual([]);
    expect(asStringArray(undefined)).toEqual([]);
  });
});
