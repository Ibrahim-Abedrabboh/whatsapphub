import { describe, it, expect } from "vitest";
import { isWithinBusinessHours, ruleMatches, evaluateRules, type AutomationRuleDef } from "./automation";

// 2026-06-29 is a Monday. 09:00 UTC.
const monday9utc = new Date("2026-06-29T09:00:00Z");

describe("isWithinBusinessHours", () => {
  const weekdays = [1, 2, 3, 4, 5];
  it("is inside on a business day during hours", () => {
    expect(isWithinBusinessHours(monday9utc, weekdays, "09:00", "17:00")).toBe(true);
  });
  it("is outside before opening", () => {
    expect(isWithinBusinessHours(new Date("2026-06-29T08:59:00Z"), weekdays, "09:00", "17:00")).toBe(false);
  });
  it("is outside at/after closing (end exclusive)", () => {
    expect(isWithinBusinessHours(new Date("2026-06-29T17:00:00Z"), weekdays, "09:00", "17:00")).toBe(false);
  });
  it("is outside on a non-business day", () => {
    // 2026-06-28 is a Sunday
    expect(isWithinBusinessHours(new Date("2026-06-28T12:00:00Z"), weekdays, "09:00", "17:00")).toBe(false);
  });
  it("applies the tz offset to the wall clock", () => {
    // 06:00 UTC + 180min = 09:00 local → inside
    expect(isWithinBusinessHours(new Date("2026-06-29T06:00:00Z"), weekdays, "09:00", "17:00", 180)).toBe(true);
    // 05:59 UTC + 180min = 08:59 local → outside
    expect(isWithinBusinessHours(new Date("2026-06-29T05:59:00Z"), weekdays, "09:00", "17:00", 180)).toBe(false);
  });
});

const keywordRule: AutomationRuleDef = { enabled: true, trigger: { type: "keyword", keywords: ["price", "hours"] }, action: { type: "sendText", body: "Our prices are on the site." } };
const awayRule: AutomationRuleDef = { enabled: true, trigger: { type: "away", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }, action: { type: "sendText", body: "We're away — back at 9am." } };

describe("ruleMatches", () => {
  it("matches a keyword (case-insensitive, substring)", () => {
    expect(ruleMatches(keywordRule, { text: "What is the PRICE?", now: monday9utc })).toBe(true);
  });
  it("does not match when no keyword present", () => {
    expect(ruleMatches(keywordRule, { text: "hello there", now: monday9utc })).toBe(false);
  });
  it("disabled rule never matches", () => {
    expect(ruleMatches({ ...keywordRule, enabled: false }, { text: "price?", now: monday9utc })).toBe(false);
  });
  it("away rule fires outside business hours", () => {
    expect(ruleMatches(awayRule, { text: "hi", now: new Date("2026-06-29T20:00:00Z") })).toBe(true);
  });
  it("away rule does not fire during business hours", () => {
    expect(ruleMatches(awayRule, { text: "hi", now: monday9utc })).toBe(false);
  });
});

describe("evaluateRules", () => {
  it("returns actions for matching rules only", () => {
    const actions = evaluateRules([keywordRule, awayRule], { text: "price please", now: monday9utc });
    expect(actions).toEqual([{ type: "sendText", body: "Our prices are on the site." }]);
  });
  it("returns nothing when no rule matches", () => {
    expect(evaluateRules([keywordRule, awayRule], { text: "hello", now: monday9utc })).toEqual([]);
  });
});

describe("evaluateRules with startChatbot", () => {
  const botRule: AutomationRuleDef = { enabled: true, trigger: { type: "keyword", keywords: ["order"] }, action: { type: "startChatbot", chatbotId: "cb_9" } };
  it("returns a startChatbot action for a matching rule", () => {
    const actions = evaluateRules([botRule], { text: "I want to order", now: new Date("2026-01-05T09:00:00Z") });
    expect(actions).toEqual([{ type: "startChatbot", chatbotId: "cb_9" }]);
  });
});
