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
          Build a no-code chatbot from ordered steps — send a message, ask a question, branch on the reply, or
          hand off to AI. Save it, then (next phase) assign it to an automation trigger to run on your channels.
        </p>
        <ChatbotsManager />
      </main>
    </>
  );
}
