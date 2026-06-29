// Who is allowed to set/reset another user's (or their own) password.
// Pure + dependency-free so it can be unit-tested and shared by the API route.
//
// Policy (see Settings → Team members):
//   - SUPERADMIN: may set anyone's password, in any client.
//   - ADMIN:      may set their OWN password, or a MEMBER's in their own client.
//   - MEMBER:     may not change any password — passwords are assigned to them.

export interface PwActor { email: string; role: string; clientId: string }

export function canSetPassword(caller: PwActor, target: PwActor): boolean {
  if (caller.role === "SUPERADMIN") return true;
  if (caller.role !== "ADMIN") return false; // MEMBER (or unknown) → never
  if (target.clientId !== caller.clientId) return false; // ADMINs are pinned to their tenant
  const isSelf = target.email.toLowerCase() === caller.email.toLowerCase();
  return isSelf || target.role === "MEMBER";
}
