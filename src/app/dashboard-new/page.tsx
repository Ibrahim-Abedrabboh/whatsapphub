import Link from "next/link";
import { prisma } from "@/lib/db";
import { getClientIdFromCookies } from "@/lib/users";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { StatCard } from "@/components/ui/StatCard";
import DeliveryChart from "@/components/ui/DeliveryChart";

export const dynamic = "force-dynamic";

export default async function DashboardNew() {
  const clientId = await getClientIdFromCookies();

  // Fetch all data in parallel
  const [
    totalContacts,
    optedOut,
    totalRecipients,
    deliveredRecipients,
    readRecipients,
    failedRecipients,
    activeConversations,
    totalClicks,
    recentBroadcasts,
    timeSeriesData,
  ] = await Promise.all([
    prisma.contact.count({ where: { clientId } }),
    prisma.contact.count({ where: { clientId, optedOut: true } }),
    prisma.broadcastRecipient.count({ where: { broadcast: { clientId } } }),
    prisma.broadcastRecipient.count({
      where: { broadcast: { clientId }, status: { in: ["DELIVERED", "READ"] } },
    }),
    prisma.broadcastRecipient.count({
      where: { broadcast: { clientId }, status: "READ" },
    }),
    prisma.broadcastRecipient.count({
      where: { broadcast: { clientId }, status: "FAILED" },
    }),
    prisma.conversation.count({
      where: {
        clientId,
        lastMessageAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.linkClick.count({ where: { shortLink: { clientId } } }),
    prisma.broadcast.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        template: true,
        list: true,
        segment: true,
        _count: {
          select: { recipients: { where: { status: { in: ["DELIVERED", "READ"] } } } },
        },
      },
    }),
    getTimeSeriesData(clientId, 30),
  ]);

  // Calculate rates
  const deliveryRate = totalRecipients > 0 ? ((deliveredRecipients / totalRecipients) * 100).toFixed(1) : "0";
  const readRate = totalRecipients > 0 ? ((readRecipients / totalRecipients) * 100).toFixed(1) : "0";

  return (
    <SidebarLayout>
      <div className="dashboard-new">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              <span data-lang="ar">لوحة التحكم</span>
              <span data-lang="en">Dashboard</span>
            </h1>
            <p className="dashboard-subtitle">
              <span data-lang="ar">نظرة عامة على أداء الرسائل</span>
              <span data-lang="en">Overview of your messaging performance</span>
            </p>
          </div>
          <div className="dashboard-actions">
            <Link href="/broadcasts/new" className="btn btn--primary">
              <span data-lang="ar">+ بث جديد</span>
              <span data-lang="en">+ New Broadcast</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <StatCard
            icon="📨"
            label={{ ar: "إجمالي الرسائل", en: "Total Messages" }}
            value={totalRecipients.toLocaleString()}
            trend={undefined}
          />
          <StatCard
            icon="✅"
            label={{ ar: "تم التوصيل", en: "Delivered" }}
            value={deliveredRecipients.toLocaleString()}
            subtitle={`${deliveryRate}%`}
          />
          <StatCard
            icon="👁"
            label={{ ar: "تمت القراءة", en: "Read" }}
            value={readRecipients.toLocaleString()}
            subtitle={`${readRate}%`}
          />
          <StatCard
            icon="💬"
            label={{ ar: "محادثات نشطة", en: "Active Conversations" }}
            value={activeConversations.toLocaleString()}
            subtitle={{ ar: "آخر ٧ أيام", en: "Last 7 days" }}
          />
        </div>

        {/* Secondary Stats */}
        <div className="stats-grid stats-grid--secondary">
          <StatCard
            icon="👥"
            label={{ ar: "جهات الاتصال", en: "Contacts" }}
            value={totalContacts.toLocaleString()}
            size="sm"
          />
          <StatCard
            icon="🚫"
            label={{ ar: "انسحبوا", en: "Opted Out" }}
            value={optedOut.toLocaleString()}
            size="sm"
          />
          <StatCard
            icon="🔗"
            label={{ ar: "نقرات الروابط", en: "Link Clicks" }}
            value={totalClicks.toLocaleString()}
            size="sm"
          />
          <StatCard
            icon="❌"
            label={{ ar: "فشل التوصيل", en: "Failed" }}
            value={failedRecipients.toLocaleString()}
            size="sm"
          />
        </div>

        {/* Chart */}
        <div className="card chart-card">
          <div className="chart-card__header">
            <h2 className="chart-card__title">
              <span data-lang="ar">تحليلات التوصيل</span>
              <span data-lang="en">Delivery Analytics</span>
            </h2>
            <span className="chart-card__period">
              <span data-lang="ar">آخر ٣٠ يوم</span>
              <span data-lang="en">Last 30 days</span>
            </span>
          </div>
          <DeliveryChart data={timeSeriesData} />
        </div>

        {/* Recent Broadcasts */}
        <div className="card broadcasts-card">
          <div className="broadcasts-card__header">
            <h2 className="broadcasts-card__title">
              <span data-lang="ar">أحدث البثوث</span>
              <span data-lang="en">Recent Broadcasts</span>
            </h2>
            <Link href="/broadcasts" className="broadcasts-card__link">
              <span data-lang="ar">عرض الكل ←</span>
              <span data-lang="en">View All ←</span>
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table table--new">
              <thead>
                <tr>
                  <th><span data-lang="ar">القالب</span><span data-lang="en">Template</span></th>
                  <th><span data-lang="ar">الجمهور</span><span data-lang="en">Audience</span></th>
                  <th><span data-lang="ar">الحالة</span><span data-lang="en">Status</span></th>
                  <th><span data-lang="ar">أرسل</span><span data-lang="en">Sent</span></th>
                  <th><span data-lang="ar">وصّل</span><span data-lang="en">Delivered</span></th>
                  <th><span data-lang="ar">التاريخ</span><span data-lang="en">Date</span></th>
                </tr>
              </thead>
              <tbody>
                {recentBroadcasts.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/broadcasts/${b.id}`} className="broadcast-link">
                        {b.template.name}
                      </Link>
                      {b.variantLabel && (
                        <span className="badge badge--variant">{b.variantLabel}</span>
                      )}
                    </td>
                    <td className="text-muted">
                      {b.list?.name ?? (b.segment ? `${b.segment.name} (segment)` : "—")}
                    </td>
                    <td>
                      <span className={`badge badge--${b.status.toLowerCase()}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>{b.sentCount.toLocaleString()}</td>
                    <td>{b._count.recipients.toLocaleString()}</td>
                    <td className="text-muted">
                      {b.scheduledAt
                        ? new Date(b.scheduledAt).toLocaleDateString()
                        : new Date(b.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {recentBroadcasts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      <span data-lang="ar">لا توجد بثوث بعد</span>
                      <span data-lang="en">No broadcasts yet</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

async function getTimeSeriesData(clientId: string, days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const recipients = await prisma.broadcastRecipient.findMany({
    where: {
      broadcast: {
        clientId,
        createdAt: { gte: startDate },
      },
    },
    select: {
      status: true,
      updatedAt: true,
    },
  });

  const dailyMap = new Map<string, { sent: number; delivered: number; read: number; failed: number }>();

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    dailyMap.set(dateKey, { sent: 0, delivered: 0, read: 0, failed: 0 });
  }

  recipients.forEach((r) => {
    const dateKey = r.updatedAt.toISOString().split("T")[0];
    const dayData = dailyMap.get(dateKey);
    if (dayData) {
      if (r.status === "SENT") dayData.sent++;
      else if (r.status === "DELIVERED") dayData.delivered++;
      else if (r.status === "READ") dayData.read++;
      else if (r.status === "FAILED") dayData.failed++;
    }
  });

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      ...data,
    }));
}
