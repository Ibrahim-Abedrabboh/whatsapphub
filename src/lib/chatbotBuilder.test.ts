import { describe, it, expect } from "vitest";
import { newBlock, blocksToFlow, flowToBlocks, BLOCK_META, type Block } from "./chatbotBuilder";
import { ChatbotFlowSchema } from "./validation";

// helper: a fixed-id block so assertions are deterministic
const b = (over: Partial<Block> & { id: string; type: Block["type"] }): Block => ({ ...over });

describe("newBlock", () => {
  it("makes a message block with a unique id and empty text", () => {
    const a = newBlock("message");
    const c = newBlock("message");
    expect(a.type).toBe("message");
    expect(a.text).toBe("");
    expect(a.id).not.toBe(c.id);
  });
  it("seeds a question with a default saveAs and a branch with one case", () => {
    expect(newBlock("question").saveAs).toBe("answer");
    expect(newBlock("branch").cases).toHaveLength(1);
  });
});

describe("BLOCK_META", () => {
  it("marks question/branch/aiAgent as wait-nodes and message/ai/end as non-wait", () => {
    expect(BLOCK_META.question.wait).toBe(true);
    expect(BLOCK_META.branch.wait).toBe(true);
    expect(BLOCK_META.aiAgent.wait).toBe(true);
    expect(BLOCK_META.message.wait).toBe(false);
    expect(BLOCK_META.ai.wait).toBe(false);
    expect(BLOCK_META.end.wait).toBe(false);
  });
});

describe("blocksToFlow", () => {
  it("throws on an empty block list", () => {
    expect(() => blocksToFlow([])).toThrow();
  });
  it("chains a linear flow and sets startId to the first block", () => {
    const blocks: Block[] = [
      b({ id: "m", type: "message", text: "Hi {{name}}" }),
      b({ id: "q", type: "question", text: "Size?", saveAs: "size" }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(flow.startId).toBe("m");
    expect(flow.nodes.m).toEqual({ id: "m", type: "message", text: "Hi {{name}}", nextId: "q" });
    expect(flow.nodes.q).toEqual({ id: "q", type: "question", text: "Size?", saveAs: "size", nextId: "e" });
    expect(flow.nodes.e).toEqual({ id: "e", type: "end" });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
  it("compiles a branch: splits keywords, keeps explicit targets, no linear nextId on the branch", () => {
    const blocks: Block[] = [
      b({ id: "br", type: "branch", cases: [{ keywords: "yes, y", nextId: "e" }], defaultNextId: "e" }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(flow.nodes.br).toEqual({ id: "br", type: "branch", cases: [{ keywords: ["yes", "y"], nextId: "e" }], defaultNextId: "e" });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
  it("omits maxTurns/goal when blank on an aiAgent and passes schema", () => {
    const flow = blocksToFlow([b({ id: "ag", type: "aiAgent" }), b({ id: "e", type: "end" })]);
    expect(flow.nodes.ag).toEqual({ id: "ag", type: "aiAgent", nextId: "e" });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
});

describe("flowToBlocks round-trip", () => {
  it("round-trips a linear flow exactly", () => {
    const blocks: Block[] = [
      b({ id: "m", type: "message", text: "Hi" }),
      b({ id: "q", type: "question", text: "Size?", saveAs: "size" }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(blocksToFlow(flowToBlocks(flow))).toEqual(flow);
  });
  it("recovers every node id from a branch flow", () => {
    const flow = blocksToFlow([
      b({ id: "br", type: "branch", cases: [{ keywords: "hi", nextId: "e" }], defaultNextId: "e" }),
      b({ id: "e", type: "end" }),
    ]);
    const ids = flowToBlocks(flow).map((x) => x.id).sort();
    expect(ids).toEqual(["br", "e"]);
  });
});

describe("blocksToFlow / flowToBlocks buttons", () => {
  it("compiles a buttons node with options and passes schema", () => {
    const blocks: Block[] = [
      b({ id: "bt", type: "buttons", text: "Pick", options: [{ label: "Yes", nextId: "e" }] }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(flow.nodes.bt).toEqual({ id: "bt", type: "buttons", text: "Pick", options: [{ label: "Yes", nextId: "e" }] });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
  it("recovers a buttons node id via flowToBlocks", () => {
    const flow = blocksToFlow([
      b({ id: "bt", type: "buttons", text: "Pick", options: [{ label: "Yes", nextId: "e" }] }),
      b({ id: "e", type: "end" }),
    ]);
    expect(flowToBlocks(flow).map((x) => x.id).sort()).toEqual(["bt", "e"]);
  });
});

describe("blocksToFlow delay", () => {
  it("compiles a delay node that chains linearly and passes schema", () => {
    const blocks: Block[] = [
      b({ id: "d", type: "delay", seconds: 8 }),
      b({ id: "e", type: "end" }),
    ];
    const flow = blocksToFlow(blocks);
    expect(flow.nodes.d).toEqual({ id: "d", type: "delay", seconds: 8, nextId: "e" });
    expect(ChatbotFlowSchema.safeParse(flow).success).toBe(true);
  });
});
