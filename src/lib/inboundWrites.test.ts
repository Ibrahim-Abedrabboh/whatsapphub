import { describe, it, expect } from "vitest";
import { buildInboundWrites, shouldLinkContact } from "./inboundWrites";
import { type NormalizedMessage } from "./inboundMessage";

const norm: NormalizedMessage = { type: "text", text: "hi", mediaId: null, mediaMime: null, mediaFilename: null };
const now = new Date("2026-06-29T12:00:00Z");

describe("shouldLinkContact", () => {
  it("links a contact only on WhatsApp", () => {
    expect(shouldLinkContact("WHATSAPP")).toBe(true);
    expect(shouldLinkContact("INSTAGRAM")).toBe(false);
    expect(shouldLinkContact("MESSENGER")).toBe(false);
  });
});

describe("buildInboundWrites", () => {
  // POSITIVE — WhatsApp with a resolved contact
  it("keys the upsert by clientId+channel+phone and stamps the channel", () => {
    const w = buildInboundWrites({
      clientId: "c1", channel: "WHATSAPP", from: "966500000000", externalId: "wamid.1",
      normalized: norm, preview: "hi", contactId: "ct1", now,
    });
    expect(w.where.clientId_channel_phone).toEqual({ clientId: "c1", channel: "WHATSAPP", phone: "966500000000" });
    expect(w.create.channel).toBe("WHATSAPP");
    expect(w.create.contactId).toBe("ct1");
    expect(w.update.contactId).toBe("ct1");
    expect(w.create.unread).toBe(1);
    expect(w.update.unread).toEqual({ increment: 1 });

    const msg = w.message("conv1");
    expect(msg).toMatchObject({
      conversationId: "conv1", channel: "WHATSAPP", direction: "IN",
      type: "text", text: "hi", wamid: "wamid.1",
    });
  });

  // NEGATIVE — non-WhatsApp, no contact: contactId omitted from update, channel carried through
  it("omits contactId on update when none resolved and carries a non-WhatsApp channel", () => {
    const w = buildInboundWrites({
      clientId: "c1", channel: "INSTAGRAM", from: "igsid_1", externalId: "mid.1",
      normalized: norm, preview: "hi", contactId: null, now,
    });
    expect(w.where.clientId_channel_phone.channel).toBe("INSTAGRAM");
    expect(w.create.contactId).toBeNull();
    expect("contactId" in w.update).toBe(false);
    expect(w.message("x").channel).toBe("INSTAGRAM");
    expect(w.message("x").wamid).toBe("mid.1");
  });
});
