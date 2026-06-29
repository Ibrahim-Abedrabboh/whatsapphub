import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthContext, setUserPassword } from "@/lib/users";
import { canSetPassword } from "@/lib/passwordPolicy";
import { bumpVersion } from "@/lib/tokenStore";

export const runtime = "nodejs";

const SetPasswordSchema = z.object({
  password: z.string().min(8, "password must be ≥8 chars").max(200),
});

/**
 * PATCH /api/users/:id/password — set (reset) a user's password.
 *
 * SUPERADMIN may reset anyone; a tenant ADMIN may reset their own password or a
 * MEMBER's within their own client. MEMBERs cannot change any password — theirs
 * is assigned to them. A successful reset revokes the target's refresh tokens,
 * forcing them to sign in again with the new password.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getAuthContext(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = SetPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, clientId: true },
  });
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (!canSetPassword(caller, target)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await setUserPassword(target.id, parsed.data.password);
  await bumpVersion(target.email); // sign the target out everywhere

  return NextResponse.json({ ok: true });
}
