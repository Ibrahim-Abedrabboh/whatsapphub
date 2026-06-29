import { prisma } from "./db";
import { env } from "./env";
import { DEFAULT_CLIENT_ID } from "./tenancy";

// Effective Messenger (Facebook Page) connection config, resolved from the
// per-client ChannelConnection row (channel = "MESSENGER"). Mirrors lib/igConfig.ts.

export interface PageConfig {
  pageId: string; // the Facebook Page id (entry.id we route inbound by)
  accessToken: string; // page access token used for sends
  appSecret: string; // for X-Hub-Signature-256 verification
  verifyToken: string;
  graphApiVersion: string;
}

async function pageRow(clientId: string) {
  return prisma.channelConnection
    .findUnique({ where: { clientId_channel: { clientId, channel: "MESSENGER" } } })
    .catch(() => null);
}

export async function getPageConfig(clientId: string = DEFAULT_CLIENT_ID): Promise<PageConfig> {
  const row = await pageRow(clientId);
  return {
    pageId: row?.pageId || row?.assetId || "",
    accessToken: row?.accessToken || "",
    appSecret: row?.appSecret || env.META_APP_SECRET,
    verifyToken: row?.verifyToken || "",
    graphApiVersion: row?.graphApiVersion || env.GRAPH_API_VERSION,
  };
}

/** Map an inbound webhook's Page id (entry.id) → owning client + app secret.
 *  Returns null when no Messenger connection exists (the dark-ship gate). */
export async function getClientByPageAsset(
  assetId: string,
): Promise<{ clientId: string; appSecret: string } | null> {
  const row = await prisma.channelConnection
    .findUnique({ where: { channel_assetId: { channel: "MESSENGER", assetId } }, select: { clientId: true } })
    .catch(() => null);
  if (!row) return null;
  const cfg = await getPageConfig(row.clientId);
  return { clientId: row.clientId, appSecret: cfg.appSecret };
}

/** True if the token matches any Messenger connection's verify token. */
export async function isMessengerVerifyToken(token: string): Promise<boolean> {
  if (!token) return false;
  const row = await prisma.channelConnection
    .findFirst({ where: { channel: "MESSENGER", verifyToken: token }, select: { id: true } })
    .catch(() => null);
  return !!row;
}
