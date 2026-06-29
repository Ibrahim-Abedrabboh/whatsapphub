"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface User { id: string; email: string; name: string | null; role: string; createdAt: string }
interface Me { email: string; role: string }

// Client-side affordance only — the server re-checks via passwordPolicy.canSetPassword
// (which also enforces the tenant boundary). The team list is already scoped to the
// caller's client, so here we only need the role/self rule.
function canReset(me: Me | null, target: User): boolean {
  if (!me) return false;
  if (me.role === "SUPERADMIN") return true;
  if (me.role !== "ADMIN") return false;
  return target.email.toLowerCase() === me.email.toLowerCase() || target.role === "MEMBER";
}

// Browser-side strong password (mirrors lib/users generatePassword alphabet).
function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export default function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Per-row password reset state.
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/users");
    if (res.status === 403) { setForbidden(true); return; }
    if (res.ok) {
      const j = await res.json();
      setUsers(j.users);
      setMe(j.me ?? null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await apiFetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined, password, role }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg(`Created ${j.user.email}.`);
      setEmail(""); setName(""); setPassword("");
      await load();
    } else setMsg(`Error: ${j.error ?? res.status}`);
  }

  function openReset(id: string) {
    setResetId(id); setResetPw(""); setResetMsg(null);
  }

  async function saveReset(u: User) {
    setResetBusy(true); setResetMsg(null);
    const res = await apiFetch(`/api/users/${u.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPw }),
    });
    const j = await res.json().catch(() => ({}));
    setResetBusy(false);
    if (res.ok) {
      const self = me && u.email.toLowerCase() === me.email.toLowerCase();
      setResetMsg(`Password set for ${u.email}. ${self ? "Your other" : "Their"} sessions were signed out.`);
      setResetId(null); setResetPw("");
    } else setResetMsg(`Error: ${j.error ?? res.status}`);
  }

  if (forbidden) {
    return <p className="note">Only ADMIN users can manage team members.</p>;
  }

  return (
    <div className="grid-forms">
      <form onSubmit={invite} className="card">
        <h3>Invite teammate</h3>
        <div className="field">
          <label className="label">Email</label>
          <input className="input" data-test-id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Name (optional)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Temporary password (≥8 chars)</label>
          <input className="input" data-test-id="user-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field">
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN")}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button className="btn" type="submit" data-test-id="user-submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</button>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Team</h3>
        <p className="note" style={{ marginTop: 0 }}>
          Members can&apos;t change their own password — an admin assigns it. Setting a password signs that person out of all sessions.
        </p>
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Password</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name ?? "—"}</td>
                <td><span className={`badge badge--${u.role === "ADMIN" ? "READ" : "PENDING"}`}>{u.role}</span></td>
                <td>
                  {resetId === u.id ? (
                    <div className="field" style={{ margin: 0, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        className="input" type="text" placeholder="New password (≥8 chars)" autoFocus
                        data-test-id="reset-password-input" value={resetPw} minLength={8}
                        onChange={(e) => setResetPw(e.target.value)} style={{ minWidth: 200 }}
                      />
                      <button type="button" className="btn btn--ghost" onClick={() => setResetPw(generatePassword())}>Generate</button>
                      <button type="button" className="btn" data-test-id="reset-password-save" disabled={resetBusy || resetPw.length < 8} onClick={() => void saveReset(u)}>
                        {resetBusy ? "Saving…" : "Save"}
                      </button>
                      <button type="button" className="btn btn--ghost" disabled={resetBusy} onClick={() => setResetId(null)}>Cancel</button>
                    </div>
                  ) : canReset(me, u) ? (
                    <button type="button" className="btn btn--ghost" data-test-id="reset-password-open" onClick={() => openReset(u.id)}>Set password</button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>No users yet.</td></tr>}
          </tbody>
        </table>
        {resetMsg && <p className="note" style={{ marginTop: 10 }}>{resetMsg}</p>}
      </div>
    </div>
  );
}
