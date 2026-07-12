import type { PrismaClient } from "@prisma/client";
import { demoId, demoName, demoPhone } from "../../src/lib/demoSeed";

const CONTACTS = [
  { n: 1, name: "Sara Al-Otaibi", tags: ["vip", "riyadh"], optedOut: false },
  { n: 2, name: "Mohammed Al-Ghamdi", tags: ["vip"], optedOut: false },
  { n: 3, name: "Layla Hassan", tags: ["jeddah"], optedOut: false },
  { n: 4, name: "Omar Khalid", tags: ["new"], optedOut: false },
  { n: 5, name: "Noura Al-Rashid", tags: ["vip", "jeddah"], optedOut: false },
  { n: 6, name: "Faisal Al-Dossary", tags: [], optedOut: true },
];

export async function seed(prisma: PrismaClient, clientId: string): Promise<void> {
  for (const c of CONTACTS) {
    const id = demoId("contact", c.n);
    await prisma.contact.upsert({
      where: { id },
      create: {
        id, clientId, phone: demoPhone(c.n), name: c.name,
        attributes: { source: "demo", city: c.tags.includes("jeddah") ? "Jeddah" : "Riyadh" },
        tags: c.tags, optedOut: c.optedOut,
      },
      update: { name: c.name, tags: c.tags, optedOut: c.optedOut },
    });
  }

  const listId = demoId("list", "vip");
  await prisma.contactList.upsert({
    where: { id: listId },
    create: { id: listId, clientId, name: demoName("VIP customers") },
    update: { name: demoName("VIP customers") },
  });

  // Memberships: contacts 1, 2, 5 are VIP. Composite PK → upsert by (contactId,listId).
  for (const n of [1, 2, 5]) {
    const contactId = demoId("contact", n);
    await prisma.contactListMembership.upsert({
      where: { contactId_listId: { contactId, listId } },
      create: { contactId, listId },
      update: {},
    });
  }

  const segmentId = demoId("segment", "active");
  await prisma.segment.upsert({
    where: { id: segmentId },
    create: {
      id: segmentId, clientId, name: demoName("Active in Riyadh"),
      rules: { all: [{ field: "attributes.city", op: "eq", value: "Riyadh" }] },
    },
    update: { name: demoName("Active in Riyadh") },
  });

  console.log("  contacts + list + segment seeded");
}
