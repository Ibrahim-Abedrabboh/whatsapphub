import Nav from "@/components/Nav";
import ChatbotsManager from "@/components/ChatbotsManager";

export const dynamic = "force-dynamic";

export default function ChatbotPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Chatbot</h1>
        <p className="note" style={{ marginBottom: 16 }}>
          No-code chatbots that reply automatically on your channels. Saved bots are assigned to an automation
          trigger and run when a matching message arrives. The visual drag-and-drop builder is on the way.
        </p>
        <ChatbotsManager />
      </main>
    </>
  );
}
