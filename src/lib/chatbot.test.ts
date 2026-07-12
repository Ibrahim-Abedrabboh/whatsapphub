import { describe, it, expect } from "vitest";
import { startRun, advance, resume, substitute, type NodeResponder } from "./chatbot";
import type { ChatbotFlow } from "./validation";

// respond stub: ai → canned answer; aiAgent → "done" once inbound says "bye"
const respond: NodeResponder = async ({ node, inboundText }) => {
  if (node.type === "aiAgent") return { text: `agent:${inboundText}`, agentDone: inboundText.includes("bye") };
  return { text: "ai-answer" };
};

const flow = (startId: string, nodes: ChatbotFlow["nodes"]): ChatbotFlow => ({ startId, nodes });

describe("substitute", () => {
  it("fills {{name}} and saved vars, leaves unknowns", () => {
    expect(substitute("Hi {{name}}, size {{size}}? {{x}}", { name: "Sara", size: "L" })).toBe("Hi Sara, size L? {{x}}");
  });
});

describe("startRun", () => {
  it("emits leading messages and parks on the first question", async () => {
    const f = flow("m", {
      m: { id: "m", type: "message", text: "Hi {{name}}", nextId: "q" },
      q: { id: "q", type: "question", text: "Size?", saveAs: "size", nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const r = await startRun(f, respond, { name: "Sara" });
    expect(r.outbound).toEqual(["Hi Sara", "Size?"]);
    expect(r.waiting).toBe(true);
    expect(r.session.currentNodeId).toBe("q");
    expect(r.done).toBe(false);
  });
  it("runs straight to end when there is no wait-node", async () => {
    const f = flow("m", { m: { id: "m", type: "message", text: "Bye", nextId: "e" }, e: { id: "e", type: "end" } });
    const r = await startRun(f, respond);
    expect(r.outbound).toEqual(["Bye"]);
    expect(r.done).toBe(true);
    expect(r.session.status).toBe("DONE");
  });
});

describe("advance — question", () => {
  it("captures the answer into variables and walks on", async () => {
    const f = flow("q", {
      q: { id: "q", type: "question", text: "Size?", saveAs: "size", nextId: "m" },
      m: { id: "m", type: "message", text: "Got {{size}}", nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "Large", respond);
    expect(r.session.variables.size).toBe("Large");
    expect(r.outbound).toEqual(["Got Large"]);
    expect(r.done).toBe(true);
  });
});

describe("advance — branch", () => {
  const f = flow("b", {
    b: { id: "b", type: "branch", cases: [{ keywords: ["yes"], nextId: "y" }], defaultNextId: "n" },
    y: { id: "y", type: "message", text: "yes!", nextId: "e" },
    n: { id: "n", type: "message", text: "no.", nextId: "e" },
    e: { id: "e", type: "end" },
  });
  it("routes on a keyword match", async () => {
    const start = await startRun(f, respond); // parks on branch (no emit)
    expect(start.session.currentNodeId).toBe("b");
    const r = await advance(f, start.session, "YES please", respond);
    expect(r.outbound).toEqual(["yes!"]);
  });
  it("falls back to defaultNextId with no match", async () => {
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "maybe", respond);
    expect(r.outbound).toEqual(["no."]);
  });
});

describe("advance — ai / aiAgent", () => {
  it("ai emits a one-shot answer then continues", async () => {
    const f = flow("q", {
      q: { id: "q", type: "question", text: "Ask?", saveAs: "x", nextId: "a" },
      a: { id: "a", type: "ai", nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "how much?", respond);
    expect(r.outbound).toEqual(["ai-answer"]);
    expect(r.done).toBe(true);
  });
  it("aiAgent stays on turns until it signals done", async () => {
    const f = flow("g", {
      g: { id: "g", type: "aiAgent", maxTurns: 5, nextId: "e" },
      e: { id: "e", type: "end" },
    });
    const start = await startRun(f, respond); // parks on agent
    const t1 = await advance(f, start.session, "hello", respond);
    expect(t1.outbound).toEqual(["agent:hello"]);
    expect(t1.waiting).toBe(true);
    expect(t1.done).toBe(false);
    const t2 = await advance(f, t1.session, "ok bye", respond);
    expect(t2.outbound).toEqual(["agent:ok bye"]);
    expect(t2.done).toBe(true);
  });
  it("aiAgent ends when maxTurns is reached", async () => {
    const f = flow("g", { g: { id: "g", type: "aiAgent", maxTurns: 1, nextId: "e" }, e: { id: "e", type: "end" } });
    const start = await startRun(f, respond);
    const t1 = await advance(f, start.session, "hi", respond);
    expect(t1.done).toBe(true);
  });
});

describe("advance — buttons", () => {
  const f = flow("bt", {
    bt: { id: "bt", type: "buttons", text: "Choose:", options: [{ label: "Pizza", nextId: "p" }, { label: "Pasta", nextId: "q" }] },
    p: { id: "p", type: "message", text: "Pizza!", nextId: "e" },
    q: { id: "q", type: "message", text: "Pasta!", nextId: "e" },
    e: { id: "e", type: "end" },
  });
  it("emits the prompt + numbered menu on arrival and parks", async () => {
    const r = await startRun(f, respond);
    expect(r.session.currentNodeId).toBe("bt");
    expect(r.waiting).toBe(true);
    expect(r.outbound).toEqual(["Choose:\n1. Pizza\n2. Pasta"]);
  });
  it("routes on the option number", async () => {
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "2", respond);
    expect(r.outbound).toEqual(["Pasta!"]);
  });
  it("routes on the option label (case-insensitive)", async () => {
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "PIZZA please", respond);
    expect(r.outbound).toEqual(["Pizza!"]);
  });
  it("re-sends the menu when the reply matches nothing", async () => {
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "burger", respond);
    expect(r.waiting).toBe(true);
    expect(r.session.currentNodeId).toBe("bt");
    expect(r.outbound).toEqual(["Choose:\n1. Pizza\n2. Pasta"]);
  });
});

describe("delay node", () => {
  const f = flow("m", {
    m: { id: "m", type: "message", text: "One", nextId: "d" },
    d: { id: "d", type: "delay", seconds: 5, nextId: "m2" },
    m2: { id: "m2", type: "message", text: "Two", nextId: "e" },
    e: { id: "e", type: "end" },
  });
  it("emits messages before the delay, then pauses with delayMs and parks on the delay node", async () => {
    const r = await startRun(f, respond);
    expect(r.outbound).toEqual(["One"]);
    expect(r.delayMs).toBe(5000);
    expect(r.done).toBe(false);
    expect(r.waiting).toBe(false);
    expect(r.session.currentNodeId).toBe("d");
  });
  it("resume() continues after the delay to completion", async () => {
    const start = await startRun(f, respond);
    const r = await resume(f, start.session, respond);
    expect(r.outbound).toEqual(["Two"]);
    expect(r.done).toBe(true);
  });
  it("ignores an inbound message while parked on a delay (waits for the timer)", async () => {
    const start = await startRun(f, respond);
    const r = await advance(f, start.session, "hello", respond);
    expect(r.outbound).toEqual([]);
    expect(r.done).toBe(false);
    expect(r.session.currentNodeId).toBe("d");
  });
});
