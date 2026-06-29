import { describe, it, expect } from "vitest";
import { canSetPassword, type PwActor } from "./passwordPolicy";

const superAdmin: PwActor = { email: "root@hub.com", role: "SUPERADMIN", clientId: "default" };
const adminA: PwActor = { email: "admin@a.com", role: "ADMIN", clientId: "client-a" };
const memberA: PwActor = { email: "mem@a.com", role: "MEMBER", clientId: "client-a" };
const memberB: PwActor = { email: "mem@b.com", role: "MEMBER", clientId: "client-b" };
const adminB: PwActor = { email: "admin@b.com", role: "ADMIN", clientId: "client-b" };

describe("canSetPassword", () => {
  it("SUPERADMIN may set anyone's password, across clients", () => {
    expect(canSetPassword(superAdmin, superAdmin)).toBe(true); // own
    expect(canSetPassword(superAdmin, adminA)).toBe(true);
    expect(canSetPassword(superAdmin, memberA)).toBe(true);
    expect(canSetPassword(superAdmin, memberB)).toBe(true); // different client
  });

  it("ADMIN may set their own password", () => {
    expect(canSetPassword(adminA, adminA)).toBe(true);
    // case-insensitive self match
    expect(canSetPassword(adminA, { ...adminA, email: "ADMIN@A.com" })).toBe(true);
  });

  it("ADMIN may set a MEMBER's password within their own client", () => {
    expect(canSetPassword(adminA, memberA)).toBe(true);
  });

  it("ADMIN may NOT set another ADMIN's or SUPERADMIN's password", () => {
    const otherAdminA: PwActor = { email: "admin2@a.com", role: "ADMIN", clientId: "client-a" };
    expect(canSetPassword(adminA, otherAdminA)).toBe(false);
    expect(canSetPassword(adminA, { ...superAdmin, clientId: "client-a" })).toBe(false);
  });

  it("ADMIN may NOT cross the tenant boundary", () => {
    expect(canSetPassword(adminA, memberB)).toBe(false);
    expect(canSetPassword(adminA, adminB)).toBe(false);
  });

  it("MEMBER may not change any password, including their own", () => {
    expect(canSetPassword(memberA, memberA)).toBe(false);
    expect(canSetPassword(memberA, memberB)).toBe(false);
  });

  it("an unknown role may change nothing", () => {
    const ghost: PwActor = { email: "x@a.com", role: "GUEST", clientId: "client-a" };
    expect(canSetPassword(ghost, memberA)).toBe(false);
  });
});
