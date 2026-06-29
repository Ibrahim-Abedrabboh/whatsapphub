import { describe, it, expect } from "vitest";
import { validateFlowDefinition } from "./flows";
import { FlowSchema } from "./validation";

describe("validateFlowDefinition", () => {
  // POSITIVE
  it("accepts an object with a non-empty screens array", () => {
    expect(validateFlowDefinition({ version: "5.0", screens: [{ id: "WELCOME" }] })).toEqual({ ok: true });
  });
  // NEGATIVE
  it("rejects a non-object", () => {
    expect(validateFlowDefinition("nope").ok).toBe(false);
    expect(validateFlowDefinition([]).ok).toBe(false);
    expect(validateFlowDefinition(null).ok).toBe(false);
  });
  it("rejects a missing or empty screens array", () => {
    expect(validateFlowDefinition({}).ok).toBe(false);
    expect(validateFlowDefinition({ screens: [] }).ok).toBe(false);
  });
});

describe("FlowSchema", () => {
  it("accepts a name + JSON-object definition", () => {
    expect(FlowSchema.safeParse({ name: "Lead form", definition: { screens: [] } }).success).toBe(true);
  });
  it("rejects a missing name", () => {
    expect(FlowSchema.safeParse({ definition: {} }).success).toBe(false);
  });
});
