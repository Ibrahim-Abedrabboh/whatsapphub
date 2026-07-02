import { prisma } from "./db";
import { sendQueue } from "./queue";
import { matchContact, type SegmentRules } from "./segments";
import { assignVariant } from "./abtest";
import { parseTzOffsetMin, localSendDelayMs } from "./sendTime";
import type { Broadcast, Contact, Template } from "@prisma/client";

// variableMap entries: { from: <field> } (pulls "name" / a contact attribute)
// or { literal: <text> }.
export type VariableMap = ({ from: string } | { literal: string })[];

export function resolveBodyParams(
  variableMap: VariableMap,
  contact: { name: string | null; attributes: unknown },
): string[] {
  const attrs = (contact.attributes ?? {}) as Record<string, string>;
  return variableMap.map((v) =>
    "literal" in v ? v.literal : v.from === "name" ? contact.name ?? "" : attrs[v.from] ?? "",
  );
}

export interface EnqueueResult {
  ok: boolean;
  broadcastId?: string;
  variantBId?: string;
  queued?: number;
  scheduledAt?: string | null;
  error?: string;
  code?: number;
}

interface PreparedTemplate {
  template: Template;
  headerMediaUrl: string | null;
  couponCode: string | null;
  carouselCards: { format: string; mediaUrl: string }[] | null;
}

/** Load + validate a template for this send (approved, media/coupon supplied). */
async function prepareTemplate(
  clientId: string,
  templateId: string,
  opts: { headerMediaUrl?: string | null; couponCode?: string | null },
): Promise<PreparedTemplate | { error: string; code: number }> {
  const template = await prisma.template.findFirst({ where: { id: templateId, clientId } });
  if (!template) return { error: "template not found", code: 404 };
  if (template.status !== "APPROVED") return { error: "template not approved by Meta", code: 422 };

  // A media-header template needs the media supplied for this send.
  const mediaHeader = ["IMAGE", "DOCUMENT", "VIDEO"].includes(template.headerFormat ?? "");
  const headerMediaUrl = mediaHeader ? (opts.headerMediaUrl ?? "").trim() : null;
  if (mediaHeader && !headerMediaUrl) {
    return { error: `template "${template.name}" has a media header — provide a media URL`, code: 422 };
  }

  // A copy-code (coupon) template needs the code for this send.
  const couponCode = template.copyCode ? (opts.couponCode ?? "").trim() : null;
  if (template.copyCode && !couponCode) {
    return { error: `template "${template.name}" has a copy-code button — provide a coupon code`, code: 422 };
  }

  // Carousel cards (media is reused from the template on every send).
  const carouselCards = Array.isArray(template.cards)
    ? (template.cards as { format: string; mediaUrl: string }[]).map((c) => ({ format: c.format, mediaUrl: c.mediaUrl }))
    : null;

  return { template, headerMediaUrl, couponCode, carouselCards };
}

/** Create the recipient rows + send jobs for one broadcast (one A/B variant = one call). */
async function enqueueGroup(
  broadcast: Broadcast,
  prepared: PreparedTemplate,
  variableMap: VariableMap,
  contacts: Contact[],
  timing: { now: Date; baseDelayMs: number; sendTime?: { targetLocal: string; tzAttr: string } | null },
): Promise<void> {
  for (const contact of contacts) {
    const rec = await prisma.broadcastRecipient.create({
      data: { broadcastId: broadcast.id, contactId: contact.id, status: "PENDING" },
    });

    // Send-time optimization: hold each recipient until the target local time
    // in their own timezone (attribute-driven). No/invalid tz → base schedule.
    let delay = timing.baseDelayMs;
    if (timing.sendTime) {
      const attrs = (contact.attributes ?? {}) as Record<string, unknown>;
      const tz = parseTzOffsetMin(attrs[timing.sendTime.tzAttr]);
      if (tz !== null) {
        delay = Math.max(timing.baseDelayMs, localSendDelayMs(timing.now, tz, timing.sendTime.targetLocal));
      }
    }

    await sendQueue.add(
      "send",
      {
        broadcastId: broadcast.id,
        clientId: broadcast.clientId,
        recipientId: rec.id,
        to: contact.phone,
        templateName: prepared.template.name,
        language: prepared.template.language,
        bodyParams: resolveBodyParams(variableMap, contact),
        headerFormat: prepared.template.headerFormat,
        headerMediaUrl: prepared.headerMediaUrl,
        couponCode: prepared.couponCode,
        carouselCards: prepared.carouselCards,
      },
      { jobId: `${broadcast.id}:${contact.id}`, delay },
    );
  }
}

/**
 * Create a broadcast and enqueue one send job per opted-in recipient.
 * Shared by the manual broadcast API and the recurring scheduler so the
 * opt-out filtering, idempotency, and scheduling logic live in one place.
 *
 * Audience: exactly one of listId (static membership) or segmentId (dynamic
 * rules, resolved against the client's contacts at send time — V2 M4 §2.7).
 * abTest: split the audience deterministically and send template B to the
 * B side as a linked variant broadcast. sendTime: delay each recipient until
 * the target local time in their timezone attribute.
 */
export async function createAndEnqueueBroadcast(opts: {
  clientId: string;
  templateId: string;
  listId?: string | null;
  segmentId?: string | null;
  variableMap: VariableMap;
  scheduledAt?: Date | null;
  headerMediaUrl?: string | null;
  couponCode?: string | null;
  abTest?: { templateBId: string; splitPercent: number } | null;
  sendTime?: { targetLocal: string; tzAttr: string } | null;
}): Promise<EnqueueResult> {
  if (!!opts.listId === !!opts.segmentId) {
    return { ok: false, error: "provide a list or a segment (exactly one)", code: 422 };
  }

  // Scope everything to the caller's tenant so a broadcast can't reach another
  // client's template/list/contacts.
  const preparedA = await prepareTemplate(opts.clientId, opts.templateId, opts);
  if ("error" in preparedA) return { ok: false, ...preparedA };

  let preparedB: PreparedTemplate | null = null;
  if (opts.abTest) {
    const b = await prepareTemplate(opts.clientId, opts.abTest.templateBId, opts);
    if ("error" in b) return { ok: false, ...b };
    if (b.template.variableCount !== preparedA.template.variableCount) {
      return { ok: false, error: "variant B must use the same number of {{variables}} as template A", code: 422 };
    }
    preparedB = b;
  }

  const optOuts = new Set(
    (await prisma.optOut.findMany({ where: { clientId: opts.clientId }, select: { phone: true } })).map((o) => o.phone),
  );

  let candidates: Contact[];
  if (opts.listId) {
    const members = await prisma.contactListMembership.findMany({
      where: { listId: opts.listId, list: { clientId: opts.clientId } },
      include: { contact: true },
    });
    candidates = members.map((m) => m.contact).filter((c) => c.clientId === opts.clientId);
  } else {
    const segment = await prisma.segment.findFirst({ where: { id: opts.segmentId!, clientId: opts.clientId } });
    if (!segment) return { ok: false, error: "segment not found", code: 404 };
    const rules = segment.rules as unknown as SegmentRules;
    const contacts = await prisma.contact.findMany({ where: { clientId: opts.clientId } });
    candidates = contacts.filter((c) => matchContact(c, rules));
  }

  const recipients = candidates.filter((c) => !c.optedOut && !optOuts.has(c.phone));
  if (recipients.length === 0) return { ok: false, error: "no opted-in recipients in the selected audience", code: 422 };

  // A/B: deterministic per-contact split (a contact never flips sides).
  let groupA = recipients;
  let groupB: Contact[] = [];
  if (opts.abTest) {
    groupA = recipients.filter((c) => assignVariant(c.id, opts.abTest!.splitPercent) === "A");
    groupB = recipients.filter((c) => assignVariant(c.id, opts.abTest!.splitPercent) === "B");
    if (groupA.length === 0 || groupB.length === 0) {
      return { ok: false, error: "audience too small for an A/B split — one variant would get nobody", code: 422 };
    }
  }

  const now = new Date();
  const scheduledAt = opts.scheduledAt ?? null;
  const baseDelayMs = scheduledAt ? Math.max(0, scheduledAt.getTime() - now.getTime()) : 0;
  const timing = { now, baseDelayMs, sendTime: opts.sendTime };

  const shared = {
    clientId: opts.clientId,
    listId: opts.listId ?? null,
    segmentId: opts.segmentId ?? null,
    status: scheduledAt ? ("SCHEDULED" as const) : ("SENDING" as const),
    variableMap: opts.variableMap,
    scheduledAt,
    startedAt: scheduledAt ? null : now,
  };

  const broadcastA = await prisma.broadcast.create({
    data: {
      ...shared,
      templateId: opts.templateId,
      totalCount: groupA.length,
      headerMediaUrl: preparedA.headerMediaUrl,
      couponCode: preparedA.couponCode,
      variantLabel: opts.abTest ? "A" : null,
    },
  });

  let broadcastB: Broadcast | null = null;
  if (opts.abTest && preparedB) {
    broadcastB = await prisma.broadcast.create({
      data: {
        ...shared,
        templateId: opts.abTest.templateBId,
        totalCount: groupB.length,
        headerMediaUrl: preparedB.headerMediaUrl,
        couponCode: preparedB.couponCode,
        variantLabel: "B",
        variantOf: broadcastA.id,
      },
    });
  }

  await enqueueGroup(broadcastA, preparedA, opts.variableMap, groupA, timing);
  if (broadcastB && preparedB) {
    await enqueueGroup(broadcastB, preparedB, opts.variableMap, groupB, timing);
  }

  return {
    ok: true,
    broadcastId: broadcastA.id,
    variantBId: broadcastB?.id,
    queued: groupA.length + groupB.length,
    scheduledAt: scheduledAt?.toISOString() ?? null,
  };
}
