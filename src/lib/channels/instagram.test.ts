import { describe, it, expect } from "vitest";
import {
  normalizeInstagramInbound,
  buildIgTextPayload,
  buildIgMediaPayload,
  type IgMessaging,
} from "./instagram";
import { verifyWebhookSignature } from "@/lib/webhookSig";
import { InstagramWebhookSchema } from "@/lib/validation";

describe("buildIgTextPayload", () => {
  it("targets the recipient by id with a text message", () => {
    expect(buildIgTextPayload("igsid_1", "hello")).toEqual({
      recipient: { id: "igsid_1" },
      message: { text: "hello" },
    });
  });
});

describe("buildIgMediaPayload", () => {
  it("sends an attachment by URL, reusable", () => {
    expect(buildIgMediaPayload("igsid_1", "image", "https://cdn/x.jpg")).toEqual({
      recipient: { id: "igsid_1" },
      message: { attachment: { type: "image", payload: { url: "https://cdn/x.jpg", is_reusable: true } } },
    });
  });
});

describe("normalizeInstagramInbound", () => {
  // POSITIVE — text
  it("maps a text DM into an InboundMessage", () => {
    const m: IgMessaging = { sender: { id: "u1" }, message: { mid: "mid.1", text: "hi" } };
    expect(normalizeInstagramInbound(m)).toEqual({ from: "u1", id: "mid.1", type: "text", text: { body: "hi" } });
  });

  // POSITIVE — image attachment → mediaId holds the CDN url
  it("maps an image attachment with the URL as the media id", () => {
    const m: IgMessaging = {
      sender: { id: "u1" },
      message: { mid: "mid.2", attachments: [{ type: "image", payload: { url: "https://cdn/p.jpg" } }] },
    };
    const out = normalizeInstagramInbound(m);
    expect(out).toMatchObject({ from: "u1", id: "mid.2", type: "image", image: { id: "https://cdn/p.jpg" } });
  });

  // NEGATIVE — echo of our own outbound is skipped
  it("returns null for an echo", () => {
    expect(normalizeInstagramInbound({ sender: { id: "u1" }, message: { is_echo: true, text: "x" } })).toBeNull();
  });

  // NEGATIVE — senderless event is skipped
  it("returns null when there is no sender", () => {
    expect(normalizeInstagramInbound({ message: { text: "x" } })).toBeNull();
  });

  // NEGATIVE — unknown attachment type falls back to a typed placeholder, no media
  it("falls back for an unsupported attachment", () => {
    const m: IgMessaging = {
      sender: { id: "u1" },
      message: { mid: "mid.3", attachments: [{ type: "story_mention", payload: {} }] },
    };
    expect(normalizeInstagramInbound(m)).toEqual({ from: "u1", id: "mid.3", type: "story_mention" });
  });
});

describe("instagram webhook security/parsing", () => {
  // NEGATIVE — a wrong app secret never verifies
  it("rejects a signature signed with the wrong secret", () => {
    const raw = JSON.stringify({ object: "instagram", entry: [] });
    const forged = "sha256=" + "0".repeat(64);
    expect(verifyWebhookSignature("the-real-secret", raw, forged)).toBe(false);
  });

  // POSITIVE/NEGATIVE — schema accepts a real shape, rejects garbage
  it("parses a valid instagram payload and rejects garbage", () => {
    const ok = InstagramWebhookSchema.safeParse({
      object: "instagram",
      entry: [{ id: "asset1", messaging: [{ sender: { id: "u1" }, message: { mid: "m", text: "hi" } }] }],
    });
    expect(ok.success).toBe(true);
    expect(InstagramWebhookSchema.safeParse("nope").success).toBe(false);
    expect(InstagramWebhookSchema.safeParse({ entry: [] }).success).toBe(false); // missing object
  });
});
