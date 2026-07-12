import { describe, it, expect } from "vitest";
import { PhoneSchema, ContactRowSchema, CreateContactSchema, composeName, CreateClientSchema, SegmentSchema, CreateBroadcastSchema, LeadSchema, ChatbotFlowSchema, CreateChatbotSchema, AutomationRuleSchema } from "./validation";

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

describe("CreateBroadcastSchema trackedUrl", () => {
  const base = { templateId: "t1", listId: "l1", variableMap: [] };

  it("accepts a valid URL and stays optional", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, trackedUrl: "https://x.co/offer" }).success).toBe(true);
    expect(CreateBroadcastSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a non-URL", () => {
    expect(CreateBroadcastSchema.safeParse({ ...base, trackedUrl: "not a url" }).success).toBe(false);
  });
});

describe("LeadSchema", () => {
  it("accepts a valid lead and normalizes the phone", () => {
    const r = LeadSchema.parse({ name: "Ahmed", phone: "+966 50 000 0001", business: "Nazzil Cafe" });
    expect(r.phone).toBe("966500000001");
  });
  it("rejects a missing name", () => {
    expect(LeadSchema.safeParse({ name: "  ", phone: "966500000001" }).success).toBe(false);
  });
  it("rejects a bad phone", () => {
    expect(LeadSchema.safeParse({ name: "Ahmed", phone: "123" }).success).toBe(false);
  });
  it("rejects an overlong business name", () => {
    expect(LeadSchema.safeParse({ name: "Ahmed", phone: "966500000001", business: "x".repeat(121) }).success).toBe(false);
  });
});

const linearFlow = {
  startId: "n1",
  nodes: {
    n1: { id: "n1", type: "message", text: "Hi {{name}}!", nextId: "n2" },
    n2: { id: "n2", type: "question", text: "What size?", saveAs: "size", nextId: "n3" },
    n3: { id: "n3", type: "end" },
  },
};

const branchFlow = {
  startId: "b1",
  nodes: {
    b1: { id: "b1", type: "branch", cases: [{ keywords: ["yes", "y"], nextId: "b2" }], defaultNextId: "b3" },
    b2: { id: "b2", type: "ai", nextId: "b3" },
    b3: { id: "b3", type: "aiAgent", goal: "Close the sale", maxTurns: 6, nextId: "b4" },
    b4: { id: "b4", type: "end" },
  },
};

describe("ChatbotFlowSchema", () => {
  it("accepts a valid linear flow", () => {
    expect(ChatbotFlowSchema.safeParse(linearFlow).success).toBe(true);
  });
  it("accepts a valid branch + ai + aiAgent flow", () => {
    expect(ChatbotFlowSchema.safeParse(branchFlow).success).toBe(true);
  });
  it("rejects a startId that is not a node", () => {
    expect(ChatbotFlowSchema.safeParse({ ...linearFlow, startId: "ghost" }).success).toBe(false);
  });
  it("rejects a dangling nextId", () => {
    const bad = { startId: "n1", nodes: { n1: { id: "n1", type: "message", text: "hi", nextId: "gone" } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a dangling branch case nextId", () => {
    const bad = {
      startId: "b1",
      nodes: { b1: { id: "b1", type: "branch", cases: [{ keywords: ["x"], nextId: "missing" }] } },
    };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a node whose key does not match its id", () => {
    const bad = { startId: "n1", nodes: { n1: { id: "OTHER", type: "end" } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a branch with no cases", () => {
    const bad = { startId: "b1", nodes: { b1: { id: "b1", type: "branch", cases: [] } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a question with an invalid saveAs name", () => {
    const bad = { startId: "n1", nodes: { n1: { id: "n1", type: "question", text: "?", saveAs: "1bad" } } };
    expect(ChatbotFlowSchema.safeParse(bad).success).toBe(false);
  });
});

describe("CreateChatbotSchema", () => {
  it("defaults status to DRAFT", () => {
    const r = CreateChatbotSchema.parse({ name: "Order bot", flow: linearFlow });
    expect(r.status).toBe("DRAFT");
  });
  it("rejects an empty name", () => {
    expect(CreateChatbotSchema.safeParse({ name: "  ", flow: linearFlow }).success).toBe(false);
  });
  it("rejects a flow that fails ChatbotFlowSchema", () => {
    const badFlow = { startId: "ghost", nodes: {} };
    expect(CreateChatbotSchema.safeParse({ name: "Bot", flow: badFlow }).success).toBe(false);
  });
});

describe("AutomationRuleSchema action", () => {
  const base = { name: "Bot on hi", enabled: true, trigger: { type: "keyword", keywords: ["hi"] } };
  it("accepts a sendText action", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "sendText", body: "Hello" } }).success).toBe(true);
  });
  it("accepts a startChatbot action with a chatbotId", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "startChatbot", chatbotId: "cb_123" } }).success).toBe(true);
  });
  it("rejects a startChatbot action with no chatbotId", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "startChatbot", chatbotId: "" } }).success).toBe(false);
  });
  it("rejects an unknown action type", () => {
    expect(AutomationRuleSchema.safeParse({ ...base, action: { type: "explode" } }).success).toBe(false);
  });
});

describe("ChatbotFlowSchema buttons node", () => {
  const withNode = (btn: Record<string, unknown>) => ({
    startId: "b",
    nodes: { b: { id: "b", type: "buttons", ...btn }, e: { id: "e", type: "end" } },
  });
  it("accepts a valid buttons node", () => {
    expect(ChatbotFlowSchema.safeParse(withNode({ text: "Pick one", options: [{ label: "Yes", nextId: "e" }] })).success).toBe(true);
  });
  it("rejects buttons with no options", () => {
    expect(ChatbotFlowSchema.safeParse(withNode({ text: "Pick", options: [] })).success).toBe(false);
  });
  it("accepts up to 10 options", () => {
    const opts = Array.from({ length: 10 }, (_, n) => ({ label: `o${n}`, nextId: "e" }));
    expect(ChatbotFlowSchema.safeParse(withNode({ text: "Pick", options: opts })).success).toBe(true);
  });
  it("rejects more than 10 options", () => {
    const opts = Array.from({ length: 11 }, (_, n) => ({ label: `o${n}`, nextId: "e" }));
    expect(ChatbotFlowSchema.safeParse(withNode({ text: "Pick", options: opts })).success).toBe(false);
  });
  it("rejects a dangling option target", () => {
    expect(ChatbotFlowSchema.safeParse(withNode({ text: "Pick", options: [{ label: "Yes", nextId: "ghost" }] })).success).toBe(false);
  });
});

describe("ChatbotFlowSchema delay node", () => {
  const f = (delay: Record<string, unknown>) => ({
    startId: "d",
    nodes: { d: { id: "d", type: "delay", ...delay }, e: { id: "e", type: "end" } },
  });
  it("accepts a valid delay node", () => {
    expect(ChatbotFlowSchema.safeParse(f({ seconds: 30, nextId: "e" })).success).toBe(true);
  });
  it("rejects a non-integer or zero delay", () => {
    expect(ChatbotFlowSchema.safeParse(f({ seconds: 0, nextId: "e" })).success).toBe(false);
    expect(ChatbotFlowSchema.safeParse(f({ seconds: 1.5, nextId: "e" })).success).toBe(false);
  });
  it("rejects a dangling delay nextId", () => {
    expect(ChatbotFlowSchema.safeParse(f({ seconds: 5, nextId: "ghost" })).success).toBe(false);
  });
});
