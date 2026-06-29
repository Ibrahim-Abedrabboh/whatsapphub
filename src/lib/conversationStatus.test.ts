import { describe, it, expect } from "vitest";
import { closedAtFor, autoAssignee, isFirstResponse } from "./conversationStatus";
import { UpdateConversationSchema } from "./validation";

const now = new Date("2026-06-29T12:00:00Z");

describe("closedAtFor", () => {
  it("stamps closedAt when closing", () => {
    expect(closedAtFor("CLOSED", now)).toBe(now);
  });
  it("clears closedAt when (re)opening", () => {
    expect(closedAtFor("OPEN", now)).toBeNull();
    expect(closedAtFor("PENDING", now)).toBeNull();
  });
});

describe("autoAssignee", () => {
  // POSITIVE — claims an unassigned thread for the acting agent
  it("assigns an unassigned thread to the actor", () => {
    expect(autoAssignee(null, "u1")).toBe("u1");
  });
  // NEGATIVE — never steals an already-owned thread
  it("leaves an assigned thread untouched", () => {
    expect(autoAssignee("u2", "u1")).toBeNull();
  });
  // NEGATIVE — no DB actor (env-admin) → no change
  it("does nothing when there is no actor", () => {
    expect(autoAssignee(null, null)).toBeNull();
  });
});

describe("isFirstResponse", () => {
  it("is true on the first reply after an inbound", () => {
    expect(isFirstResponse(null, now)).toBe(true);
  });
  it("is false once already stamped", () => {
    expect(isFirstResponse(now, now)).toBe(false);
  });
  it("is false with no inbound to respond to", () => {
    expect(isFirstResponse(null, null)).toBe(false);
  });
});

describe("UpdateConversationSchema", () => {
  // POSITIVE
  it("accepts a status change", () => {
    expect(UpdateConversationSchema.safeParse({ status: "CLOSED" }).success).toBe(true);
  });
  it("accepts assign, 'me', and unassign", () => {
    expect(UpdateConversationSchema.safeParse({ assignedToId: "u1" }).success).toBe(true);
    expect(UpdateConversationSchema.safeParse({ assignedToId: "me" }).success).toBe(true);
    expect(UpdateConversationSchema.safeParse({ assignedToId: null }).success).toBe(true);
  });
  // NEGATIVE
  it("rejects an empty patch", () => {
    expect(UpdateConversationSchema.safeParse({}).success).toBe(false);
  });
  it("rejects an unknown status", () => {
    expect(UpdateConversationSchema.safeParse({ status: "ARCHIVED" }).success).toBe(false);
  });
});
