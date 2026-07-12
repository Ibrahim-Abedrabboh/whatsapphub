import { describe, it, expect } from "vitest";
import { demoId, isDemoId, demoName, demoPhone, DEMO_NAME_PREFIX, CLEAR_ORDER } from "./demoSeed";

describe("demoId / isDemoId", () => {
  it("builds a prefixed id", () => {
    expect(demoId("contact", 1)).toBe("demoseed-contact-1");
  });
  it("recognises demo ids and rejects others", () => {
    expect(isDemoId(demoId("broadcast", "eid"))).toBe(true);
    expect(isDemoId("clx123realid")).toBe(false);
  });
});

describe("demoName", () => {
  it("prefixes a plain name", () => {
    expect(demoName("VIP customers")).toBe(`${DEMO_NAME_PREFIX}VIP customers`);
  });
  it("is idempotent (no double prefix)", () => {
    expect(demoName(demoName("VIP customers"))).toBe(`${DEMO_NAME_PREFIX}VIP customers`);
  });
});

describe("demoPhone", () => {
  it("zero-pads into the reserved range", () => {
    expect(demoPhone(1)).toBe("966500000001");
    expect(demoPhone(42)).toBe("966500000042");
  });
});

describe("CLEAR_ORDER", () => {
  const idx = (m: string) => CLEAR_ORDER.indexOf(m as typeof CLEAR_ORDER[number]);
  it("lists children before their parents", () => {
    expect(idx("messageEvent")).toBeLessThan(idx("broadcastRecipient"));
    expect(idx("broadcastRecipient")).toBeLessThan(idx("broadcast"));
    expect(idx("broadcast")).toBeLessThan(idx("template"));
    expect(idx("broadcast")).toBeLessThan(idx("contactList"));
    expect(idx("message")).toBeLessThan(idx("conversation"));
    expect(idx("internalNote")).toBeLessThan(idx("conversation"));
    expect(idx("contactListMembership")).toBeLessThan(idx("contactList"));
    expect(idx("broadcastRecipient")).toBeLessThan(idx("contact"));
    expect(idx("product")).toBeLessThan(idx("commerceCatalog"));
  });
  it("includes contact last among its dependents", () => {
    expect(idx("contact")).toBeGreaterThan(idx("broadcastRecipient"));
    expect(idx("contact")).toBeGreaterThan(idx("contactListMembership"));
  });
});
