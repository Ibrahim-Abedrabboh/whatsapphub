import { describe, it, expect } from "vitest";
import { substituteVars } from "./cannedReplies";
import { CannedReplySchema } from "./validation";

describe("substituteVars", () => {
  // POSITIVE — known vars replaced
  it("replaces {{name}} and {{phone}}", () => {
    expect(substituteVars("Hi {{name}}, we'll text {{phone}}.", { name: "Ahmed", phone: "966500" }))
      .toBe("Hi Ahmed, we'll text 966500.");
  });

  // NEGATIVE — missing value leaves the placeholder intact (agent notices)
  it("leaves a placeholder when the value is missing", () => {
    expect(substituteVars("Hi {{name}}", { name: null })).toBe("Hi {{name}}");
    expect(substituteVars("Hi {{name}}", {})).toBe("Hi {{name}}");
  });

  // NEGATIVE — unknown placeholder is left untouched
  it("ignores unknown placeholders", () => {
    expect(substituteVars("Order {{orderId}} ready", { name: "X" })).toBe("Order {{orderId}} ready");
  });

  it("returns the body unchanged when there are no placeholders", () => {
    expect(substituteVars("Thanks!", { name: "A", phone: "1" })).toBe("Thanks!");
  });
});

describe("CannedReplySchema", () => {
  it("accepts a title + body (shortcut optional)", () => {
    expect(CannedReplySchema.safeParse({ title: "Greeting", body: "Hi {{name}}" }).success).toBe(true);
    expect(CannedReplySchema.safeParse({ title: "Greeting", shortcut: "/hi", body: "Hi" }).success).toBe(true);
  });
  it("rejects a missing title or body", () => {
    expect(CannedReplySchema.safeParse({ body: "Hi" }).success).toBe(false);
    expect(CannedReplySchema.safeParse({ title: "X", body: "" }).success).toBe(false);
  });
});
