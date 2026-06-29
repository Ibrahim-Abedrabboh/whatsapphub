import { prisma } from "./db";
import { env } from "./env";
import { DEFAULT_CLIENT_ID } from "./tenancy";

// Effective Instagram Messaging connection config, resolved from the per-client
// ChannelConnection row (channel = "INSTAGRAM"). Mirrors lib/waConfig.ts. The
// app secret + Graph version fall back to the shared Meta app env vars so an IG
// connection only needs to store its asset id + page token + verify token.

export interface IgConfig {
  igBusinessId: string; // the IG business/asset id (entry.id we route inbound by)
  accessToken: string; // page access token used for sends
  appSecret: string; // for X-Hub-Signature-256 verification
  verifyToken: string;
  graphApiVersion: string;
}

async function igRow(clientId: string) {
  return prisma.channelConnection
    .findUnique({ where: { clientId_channel: { clientId, channel: "INSTAGRAM" } } })
    .catch(() => null);
}

export async function getIgConfig(clientId: string = DEFAULT_CLIENT_ID): Promise<IgConfig> {
  const row = await igRow(clientId);
  return {
    igBusinessId: row?.igBusinessId || row?.assetId || "",
    accessToken: row?.accessToken || "",
    appSecret: row?.appSecret || env.META_APP_SECRET,
    verifyToken: row?.verifyToken || "",
    graphApiVersion: row?.graphApiVersion || env.GRAPH_API_VERSION,
  };
}

/** Map an inbound webhook's IG asset id (entry.id) → owning client + app secret.
 *  Returns null when no IG connection exists (the dark-ship gate). */
export async function getClientByInstagramAsset(
  assetId: string,
): Promise<{ clientId: string; appSecret: string } | null> {
  const row = await prisma.channelConnection
    .findUnique({ where: { channel_assetId: { channel: "INSTAGRAM", assetId } }, select: { clientId: true } })
    .catch(() => null);
  if (!row) return null;
  const cfg = await getIgConfig(row.clientId);
  return { clientId: row.clientId, appSecret: cfg.appSecret };
}

/** True if the token matches any Instagram connection's verify token. */
export async function isInstagramVerifyToken(token: string): Promise<boolean> {
  if (!token) return false;
  const row = await prisma.channelConnection
    .findFirst({ where: { channel: "INSTAGRAM", verifyToken: token }, select: { id: true } })
    .catch(() => null);
  return !!row;
}
