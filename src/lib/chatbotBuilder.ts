import type { ChatbotFlow } from "@/lib/validation";

// The builder edits an ordered list of these; blocksToFlow compiles them to a
// ChatbotFlow state machine. Non-branch blocks chain linearly to the next block;
// a branch routes only via its explicit per-case targets + default target.
export type BlockType = "message" | "question" | "branch" | "ai" | "aiAgent" | "end";

export interface BranchCase {
  keywords: string; // comma-separated in the editor; split on compile
  nextId: string; // id of a target block
}

export interface Block {
  id: string;
  type: BlockType;
  text?: string; // message | question
  saveAs?: string; // question
  goal?: string; // aiAgent
  maxTurns?: number; // aiAgent
  cases?: BranchCase[]; // branch
  defaultNextId?: string; // branch
}

export const BLOCK_META: Record<BlockType, { label: string; wait: boolean }> = {
  message: { label: "Send message", wait: false },
  question: { label: "Ask & wait", wait: true },
  branch: { label: "Branch on reply", wait: true },
  ai: { label: "AI answer", wait: false },
  aiAgent: { label: "AI Agent", wait: true },
  end: { label: "End", wait: false },
};

/** A fresh block of the given type with sensible defaults. */
export function newBlock(type: BlockType): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case "message": return { id, type, text: "" };
    case "question": return { id, type, text: "", saveAs: "answer" };
    case "branch": return { id, type, cases: [{ keywords: "", nextId: "" }], defaultNextId: "" };
    case "aiAgent": return { id, type };
    default: return { id, type }; // ai | end
  }
}

const splitKeywords = (s: string): string[] => s.split(",").map((k) => k.trim()).filter(Boolean);

/** Compile ordered editor blocks into a validated-shape ChatbotFlow. Non-branch
 *  blocks point at the next block in order; branch blocks route via explicit
 *  targets. Throws on an empty list. The caller still runs ChatbotFlowSchema. */
export function blocksToFlow(blocks: Block[]): ChatbotFlow {
  const first = blocks[0];
  if (!first) throw new Error("A chatbot needs at least one step");

  const nodes: ChatbotFlow["nodes"] = {};
  blocks.forEach((blk, i) => {
    const linearNext = blocks[i + 1]?.id; // undefined on the last block
    switch (blk.type) {
      case "message":
        nodes[blk.id] = { id: blk.id, type: "message", text: blk.text ?? "", ...(linearNext ? { nextId: linearNext } : {}) };
        break;
      case "question":
        nodes[blk.id] = { id: blk.id, type: "question", text: blk.text ?? "", saveAs: blk.saveAs ?? "", ...(linearNext ? { nextId: linearNext } : {}) };
        break;
      case "ai":
        nodes[blk.id] = { id: blk.id, type: "ai", ...(linearNext ? { nextId: linearNext } : {}) };
        break;
      case "aiAgent":
        nodes[blk.id] = {
          id: blk.id, type: "aiAgent",
          ...(blk.goal?.trim() ? { goal: blk.goal.trim() } : {}),
          ...(typeof blk.maxTurns === "number" ? { maxTurns: blk.maxTurns } : {}),
          ...(linearNext ? { nextId: linearNext } : {}),
        };
        break;
      case "branch":
        nodes[blk.id] = {
          id: blk.id, type: "branch",
          cases: (blk.cases ?? []).map((c) => ({ keywords: splitKeywords(c.keywords), nextId: c.nextId })),
          ...(blk.defaultNextId ? { defaultNextId: blk.defaultNextId } : {}),
        };
        break;
      case "end":
        nodes[blk.id] = { id: blk.id, type: "end" };
        break;
    }
  });

  return { startId: first.id, nodes };
}

/** Decompile a saved flow into an ordered block list for editing. Walks from
 *  startId following linear/branch targets, then appends any unreferenced nodes
 *  so nothing is lost. */
export function flowToBlocks(flow: ChatbotFlow): Block[] {
  const order: string[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = flow.startId;
  while (cursor && !seen.has(cursor)) {
    const node: ChatbotFlow["nodes"][string] | undefined = flow.nodes[cursor];
    if (!node) break;
    seen.add(cursor); order.push(cursor);
    cursor = node.type === "branch" ? (node.defaultNextId ?? node.cases[0]?.nextId) : ("nextId" in node ? node.nextId : undefined);
  }
  for (const id of Object.keys(flow.nodes)) if (!seen.has(id)) order.push(id);

  return order.map((id) => {
    const node = flow.nodes[id]!;
    switch (node.type) {
      case "message": return { id, type: "message", text: node.text };
      case "question": return { id, type: "question", text: node.text, saveAs: node.saveAs };
      case "ai": return { id, type: "ai" };
      case "aiAgent": return { id, type: "aiAgent", goal: node.goal, maxTurns: node.maxTurns };
      case "branch": return { id, type: "branch", cases: node.cases.map((c) => ({ keywords: c.keywords.join(", "), nextId: c.nextId })), defaultNextId: node.defaultNextId ?? "" };
      case "end": return { id, type: "end" };
    }
  });
}
