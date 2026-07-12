import { prisma } from "@/lib/db";
import { isAiConfigured, faqAnswer, agentReply, rankDocs, type KbDoc } from "@/lib/ai";
import type { NodeResponder } from "@/lib/chatbot";

/** Contact-derived template vars for {{name}}/{{phone}}. */
export function substitutionVars(name: string | null, phone: string): Record<string, string> {
  return { name: name ?? "there", phone };
}

/** Wire a real responder for ai/aiAgent nodes: retrieves this client's KB docs
 *  and calls Claude. Degrades to a safe line when AI is not configured. */
export async function buildResponder(clientId: string, loadTranscript: () => Promise<string>): Promise<NodeResponder> {
  const rows = await prisma.knowledgeDoc.findMany({ where: { clientId }, select: { id: true, title: true, content: true } });
  const docs: KbDoc[] = rows;

  return async ({ node, inboundText }) => {
    if (!isAiConfigured()) return { text: "Thanks — a team member will follow up shortly.", agentDone: true };
    try {
      if (node.type === "aiAgent") {
        const transcript = await loadTranscript();
        const { text, done } = await agentReply(node.goal ?? "", `${transcript}\nCustomer: ${inboundText}`, rankDocs(inboundText, docs, 3));
        return { text: text || "…", agentDone: done };
      }
      // one-shot ai node
      const text = await faqAnswer(inboundText, rankDocs(inboundText, docs, 3));
      return { text };
    } catch {
      return { text: "Sorry — I couldn't process that right now.", agentDone: true };
    }
  };
}
