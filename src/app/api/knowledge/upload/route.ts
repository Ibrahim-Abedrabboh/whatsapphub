import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthContext, getClientId } from "@/lib/users";
import { KnowledgeSchema } from "@/lib/validation";
import { chunkText, fileDocTitles, normalizeExtractedText, KB_DOC_MAX } from "@/lib/ai";

export const runtime = "nodejs";

// Guard the request body — extraction of a huge binary would pin the worker.
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Supported extensions → how we pull text out.
type Kind = "text" | "pdf" | "docx";
const KIND_BY_EXT: Record<string, Kind> = {
  txt: "text", md: "text", markdown: "text", csv: "text", text: "text",
  pdf: "pdf",
  docx: "docx",
};

/**
 * POST /api/knowledge/upload
 * multipart/form-data: file=<.txt|.md|.csv|.pdf|.docx>
 * Extracts the file's text, splits it into <=KB_DOC_MAX-char chunks, and creates
 * one KnowledgeDoc per chunk (title from the filename, numbered when split).
 */
export async function POST(req: NextRequest) {
  if (!(await getAuthContext(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "file is empty" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `file exceeds ${Math.round(MAX_BYTES / 1024 / 1024)} MB limit` }, { status: 413 });
  }

  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  const kind = KIND_BY_EXT[ext];
  if (!kind) {
    return NextResponse.json({ error: "unsupported file type — use .txt, .md, .csv, .pdf, or .docx" }, { status: 415 });
  }

  // Extract raw text per file kind. Binary parsers are imported lazily so a
  // plain-text upload never loads them, and a parser fault fails just this call.
  let raw: string;
  try {
    if (kind === "text") {
      raw = await file.text();
    } else if (kind === "pdf") {
      const buf = Buffer.from(await file.arrayBuffer());
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      try {
        // Join per-page text ourselves; the built-in `.text` interleaves
        // "-- N of M --" page-footer markers we don't want in the KB.
        raw = (await parser.getText()).pages.map((p) => p.text).join("\n\n");
      } finally {
        await parser.destroy();
      }
    } else {
      const buf = Buffer.from(await file.arrayBuffer());
      const mammoth = (await import("mammoth")).default;
      raw = (await mammoth.extractRawText({ buffer: buf })).value;
    }
  } catch {
    return NextResponse.json({ error: "could not read the file — it may be corrupt or password-protected" }, { status: 422 });
  }

  const text = normalizeExtractedText(raw);
  if (!text) return NextResponse.json({ error: "no readable text found in the file" }, { status: 422 });

  const baseName = dot >= 0 ? file.name.slice(0, dot) : file.name;
  const chunks = chunkText(text, KB_DOC_MAX);
  const titles = fileDocTitles(baseName, chunks.length);

  // Titles are unique per client (KnowledgeDoc @@unique[clientId,title]); make
  // ours distinct from what already exists AND from each other in this batch.
  const clientId = await getClientId(req);
  const existing = new Set(
    (await prisma.knowledgeDoc.findMany({ where: { clientId }, select: { title: true } })).map((d) => d.title),
  );

  const rows = chunks.map((content, i) => {
    const title = uniqueTitle(titles[i]!, existing);
    existing.add(title);
    const doc = { title, content, source: "upload" };
    // Defensive: every row must satisfy the same schema as the manual editor.
    KnowledgeSchema.parse(doc);
    return { ...doc, clientId };
  });

  await prisma.knowledgeDoc.createMany({ data: rows });
  return NextResponse.json({ created: rows.length, titles: rows.map((r) => r.title) }, { status: 201 });
}

/** Append " (2)", " (3)"… until the title is unused, keeping within 120 chars. */
function uniqueTitle(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, 120 - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}
