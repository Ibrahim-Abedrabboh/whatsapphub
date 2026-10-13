import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIdFromCookies } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clientId = await getClientIdFromCookies();
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Parallel queries for performance
  const [
    totalRecipients,
    deliveredRecipients,
    readRecipients,
    failedRecipients,
    activeConversations,
    totalClicks,
    dailyStats,
    recentBroadcasts,
  ] = await Promise.all([
    // Total recipients
    prisma.broadcastRecipient.count({
      where: { broadcast: { clientId } },
    }),

    // Delivered (DELIVERED + READ)
    prisma.broadcastRecipient.count({
      where: {
        broadcast: { clientId },
        status: { in: ["DELIVERED", "READ"] },
      },
    }),

    // Read
    prisma.broadcastRecipient.count({
      where: {
        broadcast: { clientId },
        status: "READ",
      },
    }),

    // Failed
    prisma.broadcastRecipient.count({
      where: {
        broadcast: { clientId },
        status: "FAILED",
      },
    }),

    // Active conversations (last 7 days)
    prisma.conversation.count({
      where: {
        clientId,
        lastMessageAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),

    // Total link clicks
    prisma.linkClick.count({
      where: { shortLink: { clientId } },
    }),

    // Daily stats for chart (group by date)
    prisma.broadcastRecipient.groupBy({
      by: ["status"],
      where: {
        broadcast: {
          clientId,
          createdAt: { gte: startDate },
        },
      },
      _count: { status: true },
    }),

    // Recent broadcasts with details
    prisma.broadcast.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        template: true,
        list: true,
        segment: true,
        _count: {
          select: {
            recipients: {
              where: { status: { in: ["DELIVERED", "READ"] } },
            },
          },
        },
      },
    }),
  ]);

  // Calculate rates
  const deliveryRate = totalRecipients > 0 ? (deliveredRecipients / totalRecipients) * 100 : 0;
  const readRate = totalRecipients > 0 ? (readRecipients / totalRecipients) * 100 : 0;
  const failureRate = totalRecipients > 0 ? (failedRecipients / totalRecipients) * 100 : 0;

  // Get daily time series for the last N days
  const dailyTimeSeries = await getDailyTimeSeries(clientId, days);

  // Calculate trends (compare to previous period)
  const previousStartDate = new Date(startDate);
  previousStartDate.setDate(previousStartDate.getDate() - days);

  const [previousTotal, previousDelivered, previousRead] = await Promise.all([
    prisma.broadcastRecipient.count({
      where: {
        broadcast: {
          clientId,
          createdAt: { gte: previousStartDate, lt: startDate },
        },
      },
    }),
    prisma.broadcastRecipient.count({
      where: {
        broadcast: {
          clientId,
          createdAt: { gte: previousStartDate, lt: startDate },
        },
        status: { in: ["DELIVERED", "READ"] },
      },
    }),
    prisma.broadcastRecipient.count({
      where: {
        broadcast: {
          clientId,
          createdAt: { gte: previousStartDate, lt: startDate },
        },
        status: "READ",
      },
    }),
  ]);

  const totalTrend = previousTotal > 0 ? ((totalRecipients - previousTotal) / previousTotal) * 100 : 0;
  const deliveredTrend = previousDelivered > 0 ? ((deliveredRecipients - previousDelivered) / previousDelivered) * 100 : 0;
  const readTrend = previousRead > 0 ? ((readRecipients - previousRead) / previousRead) * 100 : 0;

  return NextResponse.json({
    stats: {
      total: totalRecipients,
      delivered: deliveredRecipients,
      read: readRecipients,
      failed: failedRecipients,
      activeConversations,
      clicks: totalClicks,
    },
    rates: {
      delivery: deliveryRate,
      read: readRate,
      failure: failureRate,
    },
    trends: {
      total: totalTrend,
      delivered: deliveredTrend,
      read: readTrend,
    },
    timeSeries: dailyTimeSeries,
    recentBroadcasts: recentBroadcasts.map((b) => ({
      id: b.id,
      templateName: b.template.name,
      audience: b.list?.name || (b.segment ? `${b.segment.name} (segment)` : "Deleted"),
      status: b.status,
      total: b.totalCount,
      sent: b.sentCount,
      delivered: b._count.recipients,
      failed: b.failedCount,
      createdAt: b.createdAt,
      scheduledAt: b.scheduledAt,
    })),
  });
}

async function getDailyTimeSeries(clientId: string, days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all recipients in the date range
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

  // Group by date and status
  const dailyMap = new Map<string, { sent: number; delivered: number; read: number; failed: number }>();

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    dailyMap.set(dateKey, { sent: 0, delivered: 0, read: 0, failed: 0 });
  }

  // Populate with actual data
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

  // Convert to array sorted by date
  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      ...data,
    }));
}
