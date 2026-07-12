import type { ChatbotFlow } from "@/lib/validation";

// Pure chatbot runtime engine (V2 M3 Phase 4). No DB/AI/IO — ai/aiAgent output
// comes from an injected async responder, so the whole engine is unit-testable.
// The engine walks the flow, emitting outbound text and parking on the next
// wait-node (question | branch | aiAgent) or finishing at end.

export type ChatbotNode = ChatbotFlow["nodes"][string];

export interface SessionState {
  currentNodeId: string;
  variables: Record<string, string>;
  status: "ACTIVE" | "DONE" | "ABANDONED";
}

export interface RespondArgs {
  node: ChatbotNode;
  variables: Record<string, string>;
  inboundText: string;
  turn: number;
}
export type NodeResponder = (args: RespondArgs) => Promise<{ text: string; agentDone?: boolean }>;

export interface AdvanceResult {
  session: SessionState;
  outbound: string[];
  waiting: boolean;
  done: boolean;
}

/** Replace {{name}}/{{phone}}/{{savedVar}} with values; unknown tokens stay. */
export function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => (key in vars ? vars[key]! : m));
}

const turnKey = (nodeId: string) => `__turn:${nodeId}`;

/** Walk non-wait nodes from `nodeId`, emitting outbound, until a wait-node
 *  (park) or end (done). A `question` emits its prompt on arrival, then parks. */
async function walk(flow: ChatbotFlow, nodeId: string | undefined, session: SessionState, respond: NodeResponder): Promise<AdvanceResult> {
  const outbound: string[] = [];
  const vars = { ...session.variables };
  let cursor = nodeId;

  while (cursor) {
    const node: ChatbotNode | undefined = flow.nodes[cursor];
    if (!node) break; // dangling ref — stop safely
    if (node.type === "message") {
      outbound.push(substitute(node.text, vars));
      cursor = node.nextId;
      continue;
    }
    if (node.type === "ai") {
      const { text } = await respond({ node, variables: vars, inboundText: vars.__lastInbound ?? "", turn: 0 });
      outbound.push(text);
      cursor = node.nextId;
      continue;
    }
    if (node.type === "end") {
      return { session: { currentNodeId: cursor, variables: vars, status: "DONE" }, outbound, waiting: false, done: true };
    }
    // wait-node: question emits its prompt on arrival, then parks; branch/aiAgent just park.
    if (node.type === "question") outbound.push(substitute(node.text, vars));
    return { session: { currentNodeId: cursor, variables: vars, status: "ACTIVE" }, outbound, waiting: true, done: false };
  }
  // ran off the end with no explicit end node
  return { session: { currentNodeId: session.currentNodeId, variables: vars, status: "DONE" }, outbound, waiting: false, done: true };
}

/** Begin a new session: walk from the flow's startId. */
export function startRun(flow: ChatbotFlow, respond: NodeResponder, vars: Record<string, string> = {}): Promise<AdvanceResult> {
  const session: SessionState = { currentNodeId: flow.startId, variables: { ...vars }, status: "ACTIVE" };
  return walk(flow, flow.startId, session, respond);
}

/** Feed an inbound message to the parked wait-node, then walk onward. */
export async function advance(flow: ChatbotFlow, session: SessionState, inboundText: string, respond: NodeResponder): Promise<AdvanceResult> {
  const node: ChatbotNode | undefined = flow.nodes[session.currentNodeId];
  const vars: Record<string, string> = { ...session.variables, __lastInbound: inboundText };
  if (!node) return { session: { ...session, variables: vars, status: "DONE" }, outbound: [], waiting: false, done: true };

  if (node.type === "question") {
    vars[node.saveAs] = inboundText;
    return walk(flow, node.nextId, { ...session, variables: vars }, respond);
  }
  if (node.type === "branch") {
    const text = inboundText.toLowerCase();
    const hit = node.cases.find((c) => c.keywords.some((k) => text.includes(k.toLowerCase())));
    const nextId = hit ? hit.nextId : node.defaultNextId;
    if (!nextId) return { session: { ...session, variables: vars }, outbound: [], waiting: true, done: false }; // no route — keep waiting
    return walk(flow, nextId, { ...session, variables: vars }, respond);
  }
  if (node.type === "aiAgent") {
    const turn = Number(vars[turnKey(node.id)] ?? "0") + 1;
    vars[turnKey(node.id)] = String(turn);
    const { text, agentDone } = await respond({ node, variables: vars, inboundText, turn });
    const finished = agentDone === true || (typeof node.maxTurns === "number" && turn >= node.maxTurns);
    if (!finished) return { session: { ...session, variables: vars }, outbound: [text], waiting: true, done: false };
    const walked = await walk(flow, node.nextId, { ...session, variables: vars }, respond);
    return { ...walked, outbound: [text, ...walked.outbound] };
  }
  // parked on a non-wait node somehow — walk from its nextId if any
  const nextId = "nextId" in node ? node.nextId : undefined;
  return walk(flow, nextId, { ...session, variables: vars }, respond);
}
