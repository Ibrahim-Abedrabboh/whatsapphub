// AI assist (V2 M3 §2.4) — Claude via the Anthropic SDK. Server-side only; the
// API key is read here and never reaches the client. Features gate on
// isAiConfigured() so the app builds and runs without a key (they stay dark).

import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured");
    this.name = "AiNotConfiguredError";
  }
}

/** True once ANTHROPIC_API_KEY is set (drives the UI gate + 503 responses). */
export function isAiConfigured(): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export interface ThreadMsg { direction: "IN" | "OUT"; text: string | null; type: string }

/** Serialize a thread into a Customer/Agent transcript for the model. Pure. */
export function threadToTranscript(messages: ThreadMsg[]): string {
  return messages
    .map((m) => {
      const who = m.direction === "IN" ? "Customer" : "Agent";
      const body = (m.text && m.text.trim()) || `[${m.type}]`;
      return `${who}: ${body}`;
    })
    .join("\n");
}

/** Tolerant parse of the model's suggestion output → up to 3 short strings. Pure. */
export function parseSuggestions(text: string): string[] {
  const trimmed = text.trim();
  // Prefer a JSON array if one is present.
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
    } catch { /* fall through to line parsing */ }
  }
  // Fallback: one suggestion per line, stripping numbering / bullets / wrapping quotes.
  return trimmed
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").replace(/^["'`]+|["'`]+$/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

const SUGGEST_SYSTEM =
  "You are an assistant to a human customer-support agent in a WhatsApp business inbox. " +
  "Given the conversation transcript, propose exactly 3 short, friendly, ready-to-send replies the agent could choose from. " +
  "Reply in the customer's language. Return ONLY a JSON array of 3 strings — no prose, no numbering.";

const SUMMARY_SYSTEM =
  "Summarize this customer-support conversation in one short paragraph (2–3 sentences): who the customer is, " +
  "what they want, and the current state. Be factual and concise. Reply with only the summary.";

/** System prompt for translation. Pure (used by tests). */
export function buildTranslateSystem(target: "AR" | "EN"): string {
  const lang = target === "AR" ? "Arabic" : "English";
  return `Translate the user's message into ${lang}. Preserve meaning and tone. Reply with only the translation — no quotes, no commentary.`;
}

async function complete(args: { system: string; user: string; maxTokens?: number }): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: args.maxTokens ?? 1024,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export async function suggestReplies(messages: ThreadMsg[]): Promise<string[]> {
  const text = await complete({ system: SUGGEST_SYSTEM, user: threadToTranscript(messages), maxTokens: 512 });
  return parseSuggestions(text);
}

export async function summarizeThread(messages: ThreadMsg[]): Promise<string> {
  return complete({ system: SUMMARY_SYSTEM, user: threadToTranscript(messages), maxTokens: 400 });
}

export async function translateText(text: string, target: "AR" | "EN"): Promise<string> {
  return complete({ system: buildTranslateSystem(target), user: text, maxTokens: 1024 });
}
