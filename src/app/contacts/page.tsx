import Nav from "@/components/Nav";
import ContactsTable from "@/components/ContactsTable";
import AddContactForm from "@/components/AddContactForm";
import SegmentsManager from "@/components/SegmentsManager";
import { prisma } from "@/lib/db";
import { getClientIdFromCookies } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const lists = await prisma.contactList.findMany({
    where: { clientId: await getClientIdFromCookies() },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <Nav />
      <main className="app">
        <h1>Contacts</h1>
        <p className="note" style={{ marginBottom: 16 }}>
          Add a contact, search, opt out / re-subscribe, or delete. Opt-outs are excluded from every broadcast.
        </p>
        <section className="grid-forms" style={{ marginBottom: 16 }}>
          <AddContactForm lists={lists} />
        </section>
        <div className="card">
          <ContactsTable />
        </div>

        <h2 style={{ marginTop: 24 }}>Segments</h2>
        <p className="note" style={{ marginBottom: 16 }}>
          Save a rule set (tags, attributes, name) as a dynamic segment and broadcast to whoever matches at send time.
        </p>
        <SegmentsManager />
      </main>
    </>
  );
}
