"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Catalog { metaCatalogId: string; name: string | null; lastSyncedAt: string | null }
interface Product { id: string; retailerId: string; name: string; priceText: string | null; availability: string | null; imageUrl: string | null }

/** Settings → Commerce (V2 M5 §2.10): connect a Meta Commerce Manager catalog
 *  and keep a local product cache in sync for product messages + orders. */
export default function CommerceManager() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "sync" | null>(null);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([apiFetch("/api/commerce/catalog"), apiFetch("/api/commerce/products")]);
    if (c.ok) {
      const j = await c.json();
      setCatalog(j.catalog);
      if (j.catalog) setCatalogId(j.catalog.metaCatalogId);
    }
    if (p.ok) setProducts((await p.json()).products);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveCatalog(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save"); setMsg(null);
    const r = await apiFetch("/api/commerce/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metaCatalogId: catalogId.trim() }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) { setMsg("Catalog saved — now run a sync."); setCatalog(j.catalog); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  async function sync() {
    setBusy("sync"); setMsg(null);
    const r = await apiFetch("/api/commerce/sync", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (r.ok) { setMsg(`Synced ${j.synced} products${j.removed ? `, removed ${j.removed} stale` : ""}.`); await load(); }
    else setMsg(`Error: ${j.error ?? r.status}`);
  }

  return (
    <div>
      <form onSubmit={saveCatalog} className="card" style={{ marginBottom: 16 }}>
        <h3>Meta catalog</h3>
        <p className="note">
          Create a catalog in <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer">Meta Commerce Manager</a>,
          connect it to your WhatsApp Business Account, then paste its numeric ID here. Product and order
          messages need this connection.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" data-test-id="commerce-catalog-id" value={catalogId} placeholder="e.g. 1234567890123456"
            onChange={(e) => setCatalogId(e.target.value)} style={{ flex: "1 1 220px" }} required pattern="\d{5,32}" />
          <button className="btn btn--sm" type="submit" disabled={busy !== null || !catalogId.trim()}>
            {busy === "save" ? "Saving…" : catalog ? "Update" : "Connect"}
          </button>
          {catalog && (
            <button className="btn btn--sm" type="button" data-test-id="commerce-sync" onClick={sync} disabled={busy !== null}>
              {busy === "sync" ? "Syncing…" : "Sync products"}
            </button>
          )}
        </div>
        {catalog?.lastSyncedAt && (
          <p className="note" style={{ marginTop: 8 }}>Last synced {new Date(catalog.lastSyncedAt).toLocaleString()}.</p>
        )}
        {msg && <p className="note" style={{ marginTop: 8 }} data-test-id="commerce-msg">{msg}</p>}
      </form>

      <div className="card">
        <h3>Products {products.length > 0 && <span className="muted" style={{ fontWeight: 400 }}>({products.length})</span>}</h3>
        <table className="table" data-test-id="commerce-products">
          <thead><tr><th></th><th>Name</th><th>Retailer ID</th><th>Price</th><th>Availability</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={{ width: 44 }}>
                  {p.imageUrl
                    ? // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} loading="lazy" width={36} height={36} style={{ borderRadius: 8, objectFit: "cover" }} />
                    : <span className="muted">—</span>}
                </td>
                <td>{p.name}</td>
                <td className="muted"><code>{p.retailerId}</code></td>
                <td>{p.priceText ?? "—"}</td>
                <td className="muted">{p.availability ?? "—"}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: 16 }}>
                {catalog ? "No products yet — run a sync." : "Connect a catalog above to start."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
