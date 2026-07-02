import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";
import LiveProgress from "@/components/LiveProgress";
import { getClientIdFromCookies } from "@/lib/users";

export const dynamic = "force-dynamic";

interface VariantFunnel {
  id: string;
  label: string;
  templateName: string;
  total: number;
  sent: number;      // SENT or beyond
  delivered: number; // DELIVERED or beyond
  read: number;
  failed: number;
  clicks: number;
  uniqueClicks: number;
}

/** Per-variant funnel: recipient statuses (cumulative) + button clicks. */
async function variantFunnel(b: { id: string; variantLabel: string | null; template: { name: string } }): Promise<VariantFunnel> {
  const [grouped, clickEvents] = await Promise.all([
    prisma.broadcastRecipient.groupBy({ by: ["status"], where: { broadcastId: b.id }, _count: { _all: true } }),
    prisma.messageEvent.findMany({
      where: { type: "click", recipient: { broadcastId: b.id } },
      select: { recipientId: true },
    }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const read = counts.READ ?? 0;
  const delivered = read + (counts.DELIVERED ?? 0);
  const sent = delivered + (counts.SENT ?? 0);
  const total = sent + (counts.PENDING ?? 0) + (counts.FAILED ?? 0);
  return {
    id: b.id,
    label: b.variantLabel ?? "A",
    templateName: b.template.name,
    total,
    sent,
    delivered,
    read,
    failed: counts.FAILED ?? 0,
    clicks: clickEvents.length,
    uniqueClicks: new Set(clickEvents.map((c) => c.recipientId)).size,
  };
}

export default async function BroadcastDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const b = await prisma.broadcast.findFirst({
    where: { id, clientId: await getClientIdFromCookies() },
    include: {
      template: true,
      list: true,
      segment: true,
      variants: { include: { template: true } },
      variantParent: { include: { template: true, variants: { include: { template: true } } } },
    },
  });
  if (!b) notFound();

  const audience = b.list?.name ?? (b.segment ? `${b.segment.name} (segment)` : "(deleted segment)");

  // A/B pair: whether we're viewing A or B, compare from the parent down.
  const pairRoot = b.variantOf ? b.variantParent : b.variants.length > 0 ? b : null;
  const pair = pairRoot ? [pairRoot, ...(pairRoot.id === b.id ? b.variants : pairRoot.variants)] : [];
  const funnels = pair.length >= 2 ? await Promise.all(pair.map(variantFunnel)) : [];

  return (
    <>
      <Nav />
      <main className="app">
        <Link href="/dashboard" className="muted" style={{ fontSize: 13 }}>← Back to dashboard</Link>
        <h1>
          {b.template.name}
          {b.variantLabel && <span className="badge" style={{ marginInlineStart: 8, verticalAlign: "middle" }}>variant {b.variantLabel}</span>}
          {" "}<span className="muted" style={{ fontSize: 16, fontWeight: 400 }}>→ {audience}</span>
        </h1>
        <p className="note">
          {b.scheduledAt ? `Scheduled for ${b.scheduledAt.toLocaleString()} · ` : ""}
          {b.startedAt ? `Started ${b.startedAt.toLocaleString()} · ` : ""}
          {b.completedAt ? `Completed ${b.completedAt.toLocaleString()}` : "in progress"}
        </p>

        <LiveProgress
          broadcastId={b.id}
          initialStatus={b.status}
          initialCounts={{ total: b.totalCount, sent: b.sentCount, failed: b.failedCount }}
        />

        {funnels.length >= 2 && (
          <div className="card" style={{ marginTop: 20 }} data-test-id="ab-comparison">
            <h3>A/B comparison</h3>
            <p className="note">Cumulative funnel per variant — a read message also counts as sent and delivered.</p>
            <table className="table">
              <thead>
                <tr><th>Variant</th><th>Template</th><th>Total</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Failed</th><th>Clicks</th></tr>
              </thead>
              <tbody>
                {funnels.map((f) => (
                  <tr key={f.id} className={f.id === b.id ? "is-selected" : undefined}>
                    <td>
                      {f.id === b.id
                        ? <strong>{f.label} (this page)</strong>
                        : <Link href={`/broadcasts/${f.id}`} data-test-id="ab-variant-link">{f.label}</Link>}
                    </td>
                    <td>{f.templateName}</td>
                    <td>{f.total}</td>
                    <td>{f.sent}</td>
                    <td>{f.delivered}</td>
                    <td>{f.read}</td>
                    <td>{f.failed}</td>
                    <td>{f.clicks}{f.uniqueClicks > 0 ? ` (${f.uniqueClicks} unique)` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
