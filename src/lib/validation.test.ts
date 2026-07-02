import { describe, it, expect } from "vitest";
import { PhoneSchema, ContactRowSchema, CreateContactSchema, composeName, CreateClientSchema, SegmentSchema, CreateBroadcastSchema } from "./validation";

describe("PhoneSchema", () => {
  it("normalizes +966 50 000 0000 → 966500000000", () => {
    expect(PhoneSchema.parse("+966 50 000 0000")).toBe("966500000000");
  });
  it("rejects too-short numbers", () => {
    expect(PhoneSchema.safeParse("123").success).toBe(false);
  });
  it("rejects letters", () => {
    expect(PhoneSchema.safeParse("96650ABCDEF0").success).toBe(false);
  });
});

describe("ContactRowSchema", () => {
  it("accepts a valid row and defaults attributes", () => {
    const r = ContactRowSchema.parse({ phone: "96650000000", name: "Laglag" });
    expect(r.attributes).toEqual({});
  });
  it("rejects a row with an invalid phone", () => {
    expect(ContactRowSchema.safeParse({ phone: "nope" }).success).toBe(false);
  });
});

describe("composeName", () => {
  it("joins first and last", () => {
    expect(composeName("Ahmed", "Al-Saud")).toBe("Ahmed Al-Saud");
  });
  it("returns just the first name when last is blank", () => {
    expect(composeName("Ahmed", "  ")).toBe("Ahmed");
  });
  it("returns undefined when both are empty", () => {
    expect(composeName(undefined, null)).toBeUndefined();
  });
});

describe("CreateClientSchema", () => {
  it("accepts a name with no admin login", () => {
    const r = CreateClientSchema.parse({ name: "Acme Cafe" });
    expect(r.name).toBe("Acme Cafe");
    expect(r.adminEmail).toBeUndefined();
  });
  it("accepts an optional admin email + password", () => {
    const r = CreateClientSchema.parse({ name: "Acme", adminEmail: "owner@acme.com", adminPassword: "longenough1" });
    expect(r.adminEmail).toBe("owner@acme.com");
  });
  it("rejects an invalid admin email", () => {
    expect(CreateClientSchema.safeParse({ name: "Acme", adminEmail: "not-an-email" }).success).toBe(false);
  });
  it("rejects an admin password shorter than 8 chars", () => {
    expect(CreateClientSchema.safeParse({ name: "Acme", adminEmail: "owner@acme.com", adminPassword: "short" }).success).toBe(false);
  });
});

describe("CreateContactSchema", () => {
  it("accepts a valid contact and normalizes the phone", () => {
    const r = CreateContactSchema.parse({ firstName: "Ahmed", phone: "+966 50 000 0001" });
    expect(r.firstName).toBe("Ahmed");
    expect(r.phone).toBe("966500000001");
    expect(r.attributes).toEqual({});
  });
  it("rejects a missing first name", () => {
    expect(CreateContactSchema.safeParse({ phone: "966500000001" }).success).toBe(false);
  });
  it("rejects an invalid phone", () => {
    expect(CreateContactSchema.safeParse({ firstName: "Ahmed", phone: "123" }).success).toBe(false);
  });
});

describe("SegmentSchema", () => {
  const cond = (over: Record<string, unknown> = {}) => ({ field: "tag", op: "eq", value: "vip", ...over });

  it("accepts a valid segment", () => {
    const r = SegmentSchema.parse({ name: "VIPs", rules: { match: "all", conditions: [cond()] } });
    expect(r.rules.conditions).toHaveLength(1);
  });
  it("accepts attr:<key> fields and value-less exists/isTrue", () => {
    const ok = SegmentSchema.safeParse({
      name: "Riyadh",
      rules: { match: "any", conditions: [cond({ field: "attr:city" }), { field: "optedOut", op: "isTrue" }, { field: "tag", op: "exists" }] },
    });
    expect(ok.success).toBe(true);
  });
  it("rejects an unknown field", () => {
    expect(SegmentSchema.safeParse({ name: "X", rules: { match: "all", conditions: [cond({ field: "phone" })] } }).success).toBe(false);
  });
  it("rejects eq/neq/contains without a value", () => {
    for (const op of ["eq", "neq", "contains"]) {
      expect(SegmentSchema.safeParse({ name: "X", rules: { match: "all", conditions: [{ field: "tag", op }] } }).success).toBe(false);
    }
  });
  it("rejects an empty condition list and a blank name", () => {
    expect(SegmentSchema.safeParse({ name: "X", rules: { match: "all", conditions: [] } }).success).toBe(false);
    expect(SegmentSchema.safeParse({ name: "  ", rules: { match: "all", conditions: [cond()] } }).success).toBe(false);
  });
});

describe("CreateBroadcastSchema audience", () => {
  const base = { templateId: "t1", variableMap: [] };

  it("accepts a list audience", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, listId: "l1" }).success).toBe(true);
  });
  it("accepts a segment audience", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, segmentId: "s1" }).success).toBe(true);
  });
  it("rejects neither audience", () => {
    expect(CreateBroadcastSchema.safeParse(base).success).toBe(false);
  });
  it("rejects both audiences at once", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, listId: "l1", segmentId: "s1" }).success).toBe(false);
  });
});

describe("CreateBroadcastSchema A/B + send-time", () => {
  const base = { templateId: "t1", listId: "l1", variableMap: [] };

  it("accepts an A/B test and defaults the split to 50", () => {
    const r = CreateBroadcastSchema.parse({ ...base, abTest: { templateBId: "t2" } });
    expect(r.abTest?.splitPercent).toBe(50);
  });
  it("rejects variant B using the same template as A", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, abTest: { templateBId: "t1" } }).success).toBe(false);
  });
  it("rejects an out-of-range split", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, abTest: { templateBId: "t2", splitPercent: 0 } }).success).toBe(false);
    expect(CreateBroadcastSchema.safeParse({ ...base, abTest: { templateBId: "t2", splitPercent: 100 } }).success).toBe(false);
  });
  it("accepts send-time and defaults the tz attribute", () => {
    const r = CreateBroadcastSchema.parse({ ...base, sendTime: { targetLocal: "09:30" } });
    expect(r.sendTime).toEqual({ targetLocal: "09:30", tzAttr: "tz" });
  });
  it("rejects a malformed target time", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, sendTime: { targetLocal: "9:30" } }).success).toBe(false);
    expect(CreateBroadcastSchema.safeParse({ ...base, sendTime: { targetLocal: "morning" } }).success).toBe(false);
  });
});

describe("CreateBroadcastSchema sendTime.defaultTz", () => {
  const base = { templateId: "t1", listId: "l1", variableMap: [] };

  it("accepts an offset and an IANA name", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, sendTime: { targetLocal: "09:00", defaultTz: "+3" } }).success).toBe(true);
    expect(CreateBroadcastSchema.safeParse({ ...base, sendTime: { targetLocal: "09:00", defaultTz: "Asia/Riyadh" } }).success).toBe(true);
  });
  it("rejects an unknown timezone", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, sendTime: { targetLocal: "09:00", defaultTz: "Narnia/Somewhere" } }).success).toBe(false);
  });
  it("stays optional", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, sendTime: { targetLocal: "09:00" } }).success).toBe(true);
  });
});
