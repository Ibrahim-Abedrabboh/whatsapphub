import Nav from "@/components/Nav";
import UsersManager from "@/components/UsersManager";
import WhatsAppSetup from "@/components/WhatsAppSetup";
import EmbeddedSignup from "@/components/EmbeddedSignup";
import ClientsManager from "@/components/ClientsManager";
import CannedRepliesManager from "@/components/CannedRepliesManager";
import KnowledgeManager from "@/components/KnowledgeManager";
import AutomationRulesManager from "@/components/AutomationRulesManager";
import FlowsManager from "@/components/FlowsManager";
import CommerceManager from "@/components/CommerceManager";
import SettingsTabs from "@/components/SettingsTabs";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Settings</h1>
        {/* SUPERADMIN-only; renders nothing for regular users, so it lives above the tabs. */}
        <ClientsManager />
        <SettingsTabs
          tabs={[
            {
              id: "connection",
              label: "WhatsApp connection",
              content: (
                <>
                  {/* One-click Embedded Signup (renders nothing if not configured server-side). */}
                  <EmbeddedSignup />
                  <p className="note" style={{ maxWidth: 680, margin: "0 0 12px" }}>
                    Prefer to enter credentials by hand? Use the advanced setup below.
                  </p>
                  <WhatsAppSetup />
                </>
              ),
            },
            { id: "team", label: "Team", content: <UsersManager /> },
            { id: "replies", label: "Canned replies", content: <CannedRepliesManager /> },
            { id: "knowledge", label: "AI knowledge", content: <KnowledgeManager /> },
            { id: "automation", label: "Automation", content: <AutomationRulesManager /> },
            { id: "flows", label: "WhatsApp Flows", content: <FlowsManager /> },
            { id: "commerce", label: "Commerce", content: <CommerceManager /> },
          ]}
        />
      </main>
    </>
  );
}
