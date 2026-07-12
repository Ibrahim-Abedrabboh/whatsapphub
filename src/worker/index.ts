import { DelayedError, Queue, Worker } from "bullmq";
// Relative imports (not "@/..."): the worker runs under tsx, which does not
// resolve tsconfig `paths` the way Next.js does.
import { connection, SEND_QUEUE, type SendJob, CHATBOT_QUEUE, type ChatbotResumeJob } from "../lib/queue";
import { RECURRING_QUEUE, recurringQueue, upsertSchedule, type RecurringJob } from "../lib/recurring";
import { resumeChatbotSession } from "../lib/chatbotRun";
import { createAndEnqueueBroadcast, type VariableMap } from "../lib/broadcast";
import { sendTemplate, WhatsAppError } from "../lib/whatsapp";
import { getWaConfig, DEFAULT_CLIENT_ID } from "../lib/waConfig";
import { parseQuality, shouldPause } from "../lib/quality";
import { prisma } from "../lib/db";
import { env } from "../lib/env";

// Rate-limited consumer. `limiter.max` per `duration` ms caps throughput to
// Meta's allowance (default tier = 80 msg/s). Raise WA_MPS only after upgrade.
const worker = new Worker<SendJob>(
  SEND_QUEUE,
  async (job, token) => {
    const { recipientId, to, templateName, language, bodyParams, headerFormat, headerMediaUrl, couponCode, carouselCards, urlButtonParam, clientId } = job.data;

    // Auto-pause gate (V2 M4 §2.9): while the client's number quality is RED,
    // hold queued sends by re-delaying the job (does not burn retry attempts).
    const cfgRow = await prisma.whatsAppConfig.findUnique({
      where: { clientId: clientId ?? DEFAULT_CLIENT_ID },
      select: { sendPaused: true },
    });
    if (cfgRow?.sendPaused) {
      console.log(`[worker] client ${clientId ?? DEFAULT_CLIENT_ID} paused (quality RED) — delaying job ${job.id} 5m`);
      await job.moveToDelayed(Date.now() + 5 * 60_000, token);
      throw new DelayedError();
    }

    // First job of a scheduled broadcast flips it to SENDING.
    await prisma.broadcast.updateMany({
      where: { id: job.data.broadcastId, status: "SCHEDULED" },
      data: { status: "SENDING", startedAt: new Date() },
    });

    try {
      const wamid = await sendTemplate({ to, templateName, language, bodyParams, headerFormat, headerMediaUrl, couponCode, carouselCards, urlButtonParam, clientId });

      await prisma.broadcastRecipient.update({
        where: { id: recipientId },
        data: { status: "SENT", wamid },
      });
      await prisma.broadcast.update({
        where: { id: job.data.broadcastId },
        data: { sentCount: { increment: 1 } },
      });
      return { wamid };
    } catch (err) {
      const retryable = err instanceof WhatsAppError ? err.retryable : true;
      const message = err instanceof Error ? err.message : "unknown error";

      // On the final attempt (or a permanent error), record failure.
      const isFinal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (!retryable || isFinal) {
        await prisma.broadcastRecipient.update({
          where: { id: recipientId },
          data: { status: "FAILED", error: message },
        });
        await prisma.broadcast.update({
          where: { id: job.data.broadcastId },
          data: { failedCount: { increment: 1 } },
        });
      }
      if (retryable) throw err; // let BullMQ retry with backoff
      return { skipped: true, reason: message };
    }
  },
  {
    connection,
    concurrency: Math.min(env.WA_MPS, 50),
    limiter: { max: env.WA_MPS, duration: 1000 },
  },
);

// Mark broadcast COMPLETED when its queue drains.
worker.on("completed", async (job) => {
  const { broadcastId } = job.data;
  const b = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (b && b.sentCount + b.failedCount >= b.totalCount && b.status === "SENDING") {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log(`[worker] listening on "${SEND_QUEUE}" @ ${env.WA_MPS} msg/s`);

// ── Recurring campaign scheduler ─────────────────────────────────────
const recurringWorker = new Worker<RecurringJob>(
  RECURRING_QUEUE,
  async (job) => {
    const campaign = await prisma.recurringCampaign.findUnique({ where: { id: job.data.campaignId } });
    if (!campaign || !campaign.active) return { skipped: true };

    const result = await createAndEnqueueBroadcast({
      clientId: campaign.clientId,
      templateId: campaign.templateId,
      listId: campaign.listId,
      variableMap: (campaign.variableMap ?? []) as VariableMap,
    });
    await prisma.recurringCampaign.update({
      where: { id: campaign.id },
      data: { lastRunAt: new Date() },
    });
    console.log(`[recurring] ${campaign.name}: ${result.ok ? `queued ${result.queued}` : `skipped (${result.error})`}`);
    return result;
  },
  { connection },
);
recurringWorker.on("failed", (job, err) => console.error(`[recurring] ${job?.id} failed:`, err.message));

// On boot, re-register schedules for all active campaigns (in case Redis was reset).
(async () => {
  const active = await prisma.recurringCampaign.findMany({ where: { active: true } });
  for (const c of active) await upsertSchedule(c.id, c.cron);
  if (active.length) console.log(`[recurring] synced ${active.length} active schedule(s)`);
})();

// ── Chatbot session resume (V2 M3 delay node) ────────────────────────
// A delay node parks a session; a delayed job fires here to continue the flow.
const chatbotResumeWorker = new Worker<ChatbotResumeJob>(
  CHATBOT_QUEUE,
  async (job) => { await resumeChatbotSession(job.data.sessionId); },
  { connection },
);
chatbotResumeWorker.on("failed", (job, err) => console.error(`[chatbot] resume ${job?.id} failed:`, err.message));
console.log(`[chatbot] listening on "${CHATBOT_QUEUE}"`);

// ── Number-quality poller + auto-pause (V2 M4 §2.9) ──────────────────
// Every 15 minutes: read each connected client's quality_rating from Meta,
// store a QualitySnapshot, and pause sending when it drops to RED. Errors are
// isolated per client so one bad token can't stall the loop; resume is manual.
const QUALITY_QUEUE = "wa-quality";
const qualityQueue = new Queue(QUALITY_QUEUE, { connection });

const qualityWorker = new Worker(
  QUALITY_QUEUE,
  async () => {
    const rows = await prisma.whatsAppConfig.findMany({ select: { clientId: true } });
    const clientIds = [...new Set([DEFAULT_CLIENT_ID, ...rows.map((r) => r.clientId)])];

    let polled = 0;
    for (const clientId of clientIds) {
      try {
        const cfg = await getWaConfig(clientId);
        if (!cfg.phoneNumberId || !cfg.accessToken) continue;

        const res = await fetch(
          `https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.phoneNumberId}?fields=quality_rating,messaging_limit_tier`,
          { headers: { Authorization: `Bearer ${cfg.accessToken}` } },
        );
        if (!res.ok) {
          console.error(`[quality] ${clientId}: Meta responded ${res.status}`);
          continue;
        }

        const { qualityRating, messagingTier } = parseQuality(await res.json().catch(() => null));
        await prisma.qualitySnapshot.create({
          data: { clientId, phoneNumberId: cfg.phoneNumberId, qualityRating, messagingTier },
        });
        polled++;

        if (shouldPause(qualityRating)) {
          const updated = await prisma.whatsAppConfig.updateMany({
            where: { clientId, sendPaused: false },
            data: { sendPaused: true },
          });
          if (updated.count > 0) console.error(`[quality] ${clientId}: rating RED — sending PAUSED (manual resume required)`);
        }
      } catch (err) {
        console.error(`[quality] ${clientId}:`, err instanceof Error ? err.message : err);
      }
    }
    return { polled };
  },
  { connection },
);
qualityWorker.on("failed", (job, err) => console.error(`[quality] ${job?.id} failed:`, err.message));

(async () => {
  await qualityQueue.upsertJobScheduler("quality-poll", { every: 15 * 60 * 1000 }, { name: "poll", data: {} });
  console.log("[quality] polling every 15m");
})();

// Keep the import referenced even if unused above (queue is created on import).
void recurringQueue;

