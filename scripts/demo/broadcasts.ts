import type { PrismaClient } from "@prisma/client";
import { demoId } from "../../src/lib/demoSeed";

const STATUSES = ["READ", "READ", "DELIVERED", "SENT", "READ", "FAILED"] as const;

export async function seed(prisma: PrismaClient, clientId: string): Promise<void> {
  const templateId = demoId("template", "eid");
  await prisma.template.upsert({
    where: { id: templateId },
    create: {
      id: templateId, name: "demo_eid_promo", language: "ar",
      category: "MARKETING", variableCount: 1, status: "APPROVED",
    },
    update: { status: "APPROVED" },
  });

  const listId = demoId("list", "vip");
  const broadcastId = demoId("broadcast", "eid");
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  await prisma.broadcast.upsert({
    where: { id: broadcastId },
    create: {
      id: broadcastId, clientId, templateId, listId, status: "COMPLETED",
      totalCount: 6, sentCount: 5, failedCount: 1,
      startedAt: yesterday, completedAt: yesterday,
    },
    update: { status: "COMPLETED", sentCount: 5, failedCount: 1 },
  });

  for (let i = 0; i < STATUSES.length; i++) {
    const n = i + 1;
    const status = STATUSES[i]!;
    const recipientId = demoId("rcpt", n);
    const wamid = `wamid.demoseed.${broadcastId}.${n}`;
    await prisma.broadcastRecipient.upsert({
      where: { id: recipientId },
      create: {
        id: recipientId, broadcastId, contactId: demoId("contact", n), status, wamid,
        error: status === "FAILED" ? "(131049) outside 24h window" : null,
      },
      update: { status },
    });
  }

  // Two READ recipients tapped a button.
  for (const n of [1, 5]) {
    const eventId = demoId("evt", n);
    const wamid = `wamid.demoseed.${broadcastId}.${n}`;
    await prisma.messageEvent.upsert({
      where: { id: eventId },
      create: { id: eventId, recipientId: demoId("rcpt", n), wamid, type: "click", payload: { label: "Shop now" } },
      update: {},
    });
  }

  console.log("  template + broadcast + recipients + events seeded");
}
