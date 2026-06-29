import Nav from "@/components/Nav";
import UsersManager from "@/components/UsersManager";
import WhatsAppSetup from "@/components/WhatsAppSetup";
import EmbeddedSignup from "@/components/EmbeddedSignup";
import ClientsManager from "@/components/ClientsManager";
import CannedRepliesManager from "@/components/CannedRepliesManager";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Settings</h1>
        {/* SUPERADMIN-only; renders nothing for regular users. */}
        <ClientsManager />
        <h2 style={{ marginTop: 32 }}>WhatsApp connection</h2>
        {/* One-click Embedded Signup (renders nothing if not configured server-side). */}
        <EmbeddedSignup />
        <p className="note" style={{ maxWidth: 680, margin: "0 0 12px" }}>
          Prefer to enter credentials by hand? Use the advanced setup below.
        </p>
        <WhatsAppSetup />
        <h2 style={{ marginTop: 32 }}>Team members</h2>
        <UsersManager />
        <h2 style={{ marginTop: 32 }}>Canned replies</h2>
        <CannedRepliesManager />
      </main>
    </>
  );
}
