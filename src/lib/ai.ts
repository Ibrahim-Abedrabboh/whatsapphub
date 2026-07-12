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

// ── FAQ knowledge base (RAG) + message tagging (V2 M3 §2.4 Phase 2) ──

export interface KbDoc { id: string; title: string; content: string }

/** Word tokens (≥3 chars), Latin + Arabic. Pure. */
function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 3);
}

/** Rank KB docs by query-term overlap, return the top-k matches. Pure (keyword
 *  retrieval; embeddings are a later enhancement). */
export function rankDocs(query: string, docs: KbDoc[], k = 3): KbDoc[] {
  const terms = tokenize(query);
  if (terms.length === 0) return docs.slice(0, k);
  return docs
    .map((d) => {
      const hay = new Set(tokenize(`${d.title} ${d.content}`));
      const score = terms.reduce((n, t) => n + (hay.has(t) ? 1 : 0), 0);
      return { d, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.d);
}

/** Draft a KB-grounded answer for the agent to review (suggest-not-send). */
export async function faqAnswer(question: string, docs: KbDoc[]): Promise<string> {
  const kb = docs.map((d, i) => `[Doc ${i + 1}: ${d.title}]\n${d.content}`).join("\n\n") || "(empty)";
  const system =
    "You are an assistant to a human support agent. Using ONLY the knowledge base below, draft a concise, " +
    "friendly reply to the customer's question for the agent to review and send. If the answer is not in the " +
    "knowledge base, say you don't have that information. Reply with only the draft.\n\n" +
    "=== Knowledge base ===\n" + kb;
  return complete({ system, user: question, maxTokens: 600 });
}

export interface AiTags { intent: string; sentiment: string }

const TAG_SYSTEM =
  'Classify the customer\'s message. Reply ONLY a JSON object: {"intent": one of ' +
  '"question"|"complaint"|"request"|"feedback"|"greeting"|"other", "sentiment": one of ' +
  '"positive"|"neutral"|"negative"}. No prose.';

/** Tolerant parse of the tag JSON → {intent, sentiment} with safe defaults. Pure. */
export function parseTags(text: string): AiTags {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e > s) {
    try {
      const obj = JSON.parse(text.slice(s, e + 1)) as Record<string, unknown>;
      return {
        intent: typeof obj.intent === "string" ? obj.intent : "other",
        sentiment: typeof obj.sentiment === "string" ? obj.sentiment : "neutral",
      };
    } catch { /* fall through */ }
  }
  return { intent: "other", sentiment: "neutral" };
}

export async function tagMessage(text: string): Promise<AiTags> {
  return parseTags(await complete({ system: TAG_SYSTEM, user: text, maxTokens: 60 }));
}

/** Max characters per KnowledgeDoc.content (mirrors KnowledgeSchema). */
export const KB_DOC_MAX = 20000;

/**
 * Collapse the messy whitespace that PDF/DOCX extraction leaves behind: strip
 * carriage returns, trim trailing spaces on each line, and squeeze 3+ blank
 * lines down to a paragraph break. Pure.
 */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split text into chunks of at most `max` characters, preferring to break on
 * paragraph, then line, then whitespace boundaries so a chunk never cuts a word
 * in half unless a single "word" is itself longer than `max`. Pure.
 */
export function chunkText(text: string, max = KB_DOC_MAX): string[] {
  const clean = text.trim();
  if (clean.length <= max) return clean.length ? [clean] : [];

  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    // Prefer the last natural boundary inside the window; fall back to a hard
    // cut only when there is no boundary at all (e.g. one giant token).
    let cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    if (cut <= 0) cut = max;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length) chunks.push(rest);
  return chunks;
}

/**
 * Titles for the docs produced from one uploaded file. A single chunk keeps the
 * bare base name; multiple chunks are numbered "base (1/n)". Each title is
 * clamped to `maxLen` (KnowledgeSchema caps title at 120). Pure.
 */
export function fileDocTitles(base: string, count: number, maxLen = 120): string[] {
  const clean = base.trim() || "Untitled";
  if (count <= 1) return [clean.slice(0, maxLen)];
  return Array.from({ length: count }, (_, i) => {
    const suffix = ` (${i + 1}/${count})`;
    return clean.slice(0, maxLen - suffix.length) + suffix;
  });
}
