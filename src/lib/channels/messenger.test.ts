import { describe, it, expect } from "vitest";
import {
  normalizeMessengerInbound,
  buildMsgrTextPayload,
  buildMsgrMediaPayload,
  type MsgrMessaging,
} from "./messenger";
import { verifyWebhookSignature } from "@/lib/webhookSig";
import { MessengerWebhookSchema } from "@/lib/validation";

describe("buildMsgrTextPayload", () => {
  it("sends a RESPONSE text to the recipient id", () => {
    expect(buildMsgrTextPayload("psid_1", "hello")).toEqual({
      recipient: { id: "psid_1" },
      messaging_type: "RESPONSE",
      message: { text: "hello" },
    });
  });
});

describe("buildMsgrMediaPayload", () => {
  it("sends an attachment by URL, reusable", () => {
    expect(buildMsgrMediaPayload("psid_1", "video", "https://cdn/v.mp4")).toEqual({
      recipient: { id: "psid_1" },
      messaging_type: "RESPONSE",
      message: { attachment: { type: "video", payload: { url: "https://cdn/v.mp4", is_reusable: true } } },
    });
  });
});

describe("normalizeMessengerInbound", () => {
  // POSITIVE — text
  it("maps a text message into an InboundMessage", () => {
    const m: MsgrMessaging = { sender: { id: "u1" }, message: { mid: "mid.1", text: "hi" } };
    expect(normalizeMessengerInbound(m)).toEqual({ from: "u1", id: "mid.1", type: "text", text: { body: "hi" } });
  });

  // POSITIVE — file attachment → document with the URL as media id
  it("maps a file attachment to a document with the URL as media id", () => {
    const m: MsgrMessaging = {
      sender: { id: "u1" },
      message: { mid: "mid.2", attachments: [{ type: "file", payload: { url: "https://cdn/d.pdf" } }] },
    };
    expect(normalizeMessengerInbound(m)).toMatchObject({ type: "document", document: { id: "https://cdn/d.pdf" } });
  });

  // NEGATIVE — echo / senderless
  it("returns null for an echo and for a senderless event", () => {
    expect(normalizeMessengerInbound({ sender: { id: "u1" }, message: { is_echo: true, text: "x" } })).toBeNull();
    expect(normalizeMessengerInbound({ message: { text: "x" } })).toBeNull();
  });

  // NEGATIVE — unknown attachment falls back
  it("falls back for an unsupported attachment", () => {
    const m: MsgrMessaging = {
      sender: { id: "u1" },
      message: { mid: "mid.3", attachments: [{ type: "fallback", payload: {} }] },
    };
    expect(normalizeMessengerInbound(m)).toEqual({ from: "u1", id: "mid.3", type: "fallback" });
  });
});

describe("messenger webhook security/parsing", () => {
  it("rejects a signature signed with the wrong secret", () => {
    const raw = JSON.stringify({ object: "page", entry: [] });
    expect(verifyWebhookSignature("real-secret", raw, "sha256=" + "0".repeat(64))).toBe(false);
  });

  it("parses a valid page payload and rejects garbage", () => {
    const ok = MessengerWebhookSchema.safeParse({
      object: "page",
      entry: [{ id: "page1", messaging: [{ sender: { id: "u1" }, message: { mid: "m", text: "hi" } }] }],
    });
    expect(ok.success).toBe(true);
    expect(MessengerWebhookSchema.safeParse(42).success).toBe(false);
    expect(MessengerWebhookSchema.safeParse({ entry: [] }).success).toBe(false); // missing object
  });
});
