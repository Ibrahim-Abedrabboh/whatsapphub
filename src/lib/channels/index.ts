// Channel adapter registry. `getChannel` dispatches by a (possibly DB-sourced)
// channel string and throws if the channel isn't configured — which is also the
// "not yet live" gate for Instagram/Messenger until their adapters are registered
// (Phases 2/3) and a ChannelConnection exists.

import { type Channel, type ChannelAdapter } from "./types";
import { whatsappAdapter } from "./whatsapp";
import { instagramAdapter } from "./instagram";
import { messengerAdapter } from "./messenger";

const REGISTRY: Partial<Record<Channel, ChannelAdapter>> = {
  WHATSAPP: whatsappAdapter,
  INSTAGRAM: instagramAdapter,
  MESSENGER: messengerAdapter,
};

/** Resolve the adapter for a channel string. Throws on unknown/unconfigured. */
export function getChannel(channel: string): ChannelAdapter {
  const adapter = REGISTRY[channel as Channel];
  if (!adapter) throw new Error(`channel ${channel} is not configured`);
  return adapter;
}

export { type Channel, type ChannelAdapter } from "./types";
