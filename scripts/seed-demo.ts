// Demo-data seeder. Populates the admin client with realistic bilingual data
// across every shipped feature, idempotently. Run: `npm run seed:demo`
// Remove: `npm run seed:demo -- --clear`. Pure Prisma writes only — no queue,
// no WhatsApp API, no real sends.
import { PrismaClient } from "@prisma/client";
import { CLEAR_ORDER, DEMO_ID_PREFIX } from "../src/lib/demoSeed";
import { seed as seedContacts } from "./demo/contacts";
import { seed as seedBroadcasts } from "./demo/broadcasts";
import { seed as seedInbox } from "./demo/inbox";
import { seed as seedEngagement } from "./demo/engagement";
import { seed as seedCommerce } from "./demo/commerce";

const prisma = new PrismaClient();

/** The SUPERADMIN's client, else the first ADMIN's, else "default". */
async function resolveAdminClientId(): Promise<string> {
  const admin =
    (await prisma.user.findFirst({ where: { role: "SUPERADMIN" }, select: { clientId: true } })) ??
    (await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { clientId: true } }));
  return admin?.clientId ?? "default";
}

async function clearDemo(): Promise<void> {
  for (const model of CLEAR_ORDER) {
    const where =
      model === "contactListMembership"
        ? { listId: { startsWith: DEMO_ID_PREFIX } }
        : { id: { startsWith: DEMO_ID_PREFIX } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (prisma as any)[model].deleteMany({ where });
    console.log(`  cleared ${model}: ${res.count}`);
  }
}

async function main() {
  const clear = process.argv.includes("--clear");
  const clientId = await resolveAdminClientId();
  console.log(`Demo seed → client "${clientId}"${clear ? " (clear)" : ""}`);

  if (clear) {
    await clearDemo();
    console.log("Demo data cleared.");
    return;
  }

  // Ordered so parents exist before children reference them.
  await seedContacts(prisma, clientId);
  await seedBroadcasts(prisma, clientId);
  await seedInbox(prisma, clientId);
  await seedEngagement(prisma, clientId);
  await seedCommerce(prisma, clientId);
  console.log("Demo data seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
