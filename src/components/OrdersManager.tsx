"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiFetch";

interface OrderItem { retailerId: string; quantity: number; itemPrice: number | null; currency: string | null }
interface Order {
  id: string;
  phone: string;
  contactName: string | null;
  conversationId: string | null;
  items: OrderItem[];
  itemCount: number;
  total: string | number | null; // Prisma Decimal serializes as string
  currency: string | null;
  status: string;
  createdAt: string;
}

const FILTERS = ["ALL", "NEW", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

// Legal next steps per status (mirrors lib/orders.ts canTransition).
const NEXT: Record<string, { to: string; label: string }[]> = {
  NEW: [{ to: "CONFIRMED", label: "Confirm" }, { to: "CANCELLED", label: "Cancel" }],
  CONFIRMED: [{ to: "SHIPPED", label: "Mark shipped" }, { to: "CANCELLED", label: "Cancel" }],
  SHIPPED: [{ to: "DELIVERED", label: "Mark delivered" }],
  DELIVERED: [],
  CANCELLED: [],
};

/** /orders (V2 M5 §2.10): WhatsApp cart orders with a simple status pipeline.
 *  Status changes message the customer (best-effort — window-aware). */
export default function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = filter === "ALL" ? "" : `?status=${filter}`;
    const r = await apiFetch(`/api/orders${q}`);
    if (r.ok) setOrders((await r.json()).orders);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  async function move(id: string, to: string) {
    setBusy(`${id}:${to}`); setMsg(null);
    const r = await apiFetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) {
      setMsg(j.notified ? `Order ${to.toLowerCase()} — customer notified on WhatsApp.` :
        `Order ${to.toLowerCase()} — customer NOT notified${j.notifyError ? ` (${j.notifyError})` : ""}.`);
      await load();
    } else {
      setMsg(`Error: ${j.error ?? r.status}`);
    }
  }

  const fmtTotal = (o: Order) =>
    o.total != null ? `${o.currency ? `${o.currency} ` : ""}${Number(o.total).toFixed(2)}` : "—";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`btn ${filter === f ? "" : "btn--ghost"}`}
            style={{ minHeight: 32, padding: "4px 12px", fontSize: 12 }} onClick={() => setFilter(f)}>
            {f === "ALL" ? "All" : f}
          </button>
        ))}
      </div>

      {msg && <p className="note" data-test-id="orders-msg" style={{ marginBottom: 10 }}>{msg}</p>}

      <div className="card">
        <table className="table" data-test-id="orders-table">
          <thead>
            <tr><th>Placed</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(o.createdAt).toLocaleString()}</td>
                <td>
                  {o.contactName ?? <span className="muted" dir="ltr">{o.phone}</span>}
                  {o.conversationId && (
                    <>
                      {" "}
                      <Link href="/inbox" className="muted" style={{ fontSize: 12 }}>(thread)</Link>
                    </>
                  )}
                </td>
                <td>
                  {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {(Array.isArray(o.items) ? o.items : []).slice(0, 3).map((it) => `${it.quantity}× ${it.retailerId}`).join(", ")}
                    {Array.isArray(o.items) && o.items.length > 3 ? "…" : ""}
                  </div>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtTotal(o)}</td>
                <td><span className={`badge badge--${o.status}`}>{o.status}</span></td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(NEXT[o.status] ?? []).map((n) => (
                    <button key={n.to} type="button" className="btn btn--ghost" style={{ minHeight: 30, padding: "3px 10px", fontSize: 12 }}
                      disabled={busy !== null} onClick={() => void move(o.id, n.to)}>
                      {busy === `${o.id}:${n.to}` ? "…" : n.label}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 16 }}>
                No orders {filter !== "ALL" ? `with status ${filter}` : "yet"} — they appear when a customer sends a cart from your catalog.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
