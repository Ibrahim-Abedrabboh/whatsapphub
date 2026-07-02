// Orders from WhatsApp carts (V2 M5 §2.10). Pure logic — no DB — so parsing,
// totals math, and the status machine are unit-testable.

export interface OrderItem {
  retailerId: string;
  quantity: number;
  itemPrice: number | null; // unit price in currency units, as reported
  currency: string | null;
}

export interface ParsedOrder {
  catalogId: string | null;
  items: OrderItem[];
  itemCount: number; // total units across items
  total: number | null; // sum(quantity × itemPrice); null when any price is unknown
  currency: string | null; // first reported currency
}

/** Raw `order` object on an inbound WhatsApp webhook message. */
export interface InboundOrder {
  catalog_id?: string;
  text?: string;
  product_items?: {
    product_retailer_id?: string;
    quantity?: number | string;
    item_price?: number | string;
    currency?: string;
  }[];
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Normalize an inbound order message. Tolerant: items without a retailer id
 * are dropped, quantities default to 1, unknown prices make the order total
 * null (never a wrong number). Returns null when there are no usable items.
 */
export function parseOrderMessage(order: InboundOrder | null | undefined): ParsedOrder | null {
  const rawItems = Array.isArray(order?.product_items) ? order.product_items : [];
  const items: OrderItem[] = [];
  for (const it of rawItems) {
    const retailerId = typeof it?.product_retailer_id === "string" ? it.product_retailer_id.trim() : "";
    if (!retailerId) continue;
    items.push({
      retailerId,
      quantity: Math.max(1, Math.trunc(num(it.quantity) ?? 1)),
      itemPrice: num(it.item_price),
      currency: typeof it.currency === "string" && it.currency.trim() ? it.currency.trim().toUpperCase() : null,
    });
  }
  if (items.length === 0) return null;

  const itemCount = items.reduce((n, it) => n + it.quantity, 0);
  const total = items.every((it) => it.itemPrice !== null)
    ? Math.round(items.reduce((sum, it) => sum + it.quantity * it.itemPrice!, 0) * 100) / 100
    : null;

  return {
    catalogId: typeof order?.catalog_id === "string" && order.catalog_id ? order.catalog_id : null,
    items,
    itemCount,
    total,
    currency: items.find((it) => it.currency)?.currency ?? null,
  };
}

/** Thread/list preview line for an order. */
export function orderPreview(o: Pick<ParsedOrder, "itemCount" | "total" | "currency">): string {
  const amount = o.total !== null ? ` — ${o.currency ? `${o.currency} ` : ""}${o.total.toFixed(2)}` : "";
  return `🛒 Order: ${o.itemCount} item${o.itemCount === 1 ? "" : "s"}${amount}`;
}

// ── Status machine ────────────────────────────────────────────────────
export const ORDER_STATUSES = ["NEW", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** Is `from → to` a legal order-status move? (Same-status is not a move.) */
export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as OrderStatus] ?? []).includes(to as OrderStatus);
}

// ── Abandoned-cart reminders (Phase 4) ────────────────────────────────
export const REMIND_AFTER_HOURS = 6; // nudge once the cart has sat this long…
export const REMIND_MAX_AGE_HOURS = 48; // …but never for carts older than this

/**
 * Should this order get an abandoned-cart nudge now? Only NEW orders that
 * were never reminded, old enough to count as abandoned but young enough
 * that a reminder is still welcome (and the 24h window plausibly open).
 */
export function needsReminder(
  order: { status: string; createdAt: Date; remindedAt: Date | null },
  now: Date,
  opts: { afterHours?: number; maxAgeHours?: number } = {},
): boolean {
  const after = (opts.afterHours ?? REMIND_AFTER_HOURS) * 3_600_000;
  const maxAge = (opts.maxAgeHours ?? REMIND_MAX_AGE_HOURS) * 3_600_000;
  if (order.status !== "NEW" || order.remindedAt !== null) return false;
  const age = now.getTime() - order.createdAt.getTime();
  return age >= after && age <= maxAge;
}

/** Bilingual abandoned-cart nudge. */
export function cartReminderText(o: Pick<ParsedOrder, "itemCount">): string {
  return `Your cart with ${o.itemCount} item${o.itemCount === 1 ? "" : "s"} is still waiting — reply here to complete your order 🛒 / سلّتك ما زالت بانتظارك — راسلنا هنا لإتمام طلبك 🛒`;
}

/** Customer-facing notification for a status change (EN + AR in one message —
 *  we don't know the customer's language). */
export function statusNotification(to: OrderStatus): string {
  switch (to) {
    case "CONFIRMED":
      return "Your order has been confirmed ✅ / تم تأكيد طلبك ✅";
    case "SHIPPED":
      return "Your order is on its way 🚚 / طلبك في الطريق 🚚";
    case "DELIVERED":
      return "Your order was delivered 📦 Thank you! / تم تسليم طلبك 📦 شكرًا لك!";
    case "CANCELLED":
      return "Your order has been cancelled / تم إلغاء طلبك";
    default:
      return "";
  }
}
