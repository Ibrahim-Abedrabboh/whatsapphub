import { describe, it, expect } from "vitest";
import {
  tokenExchangeUrl,
  phoneNumbersUrl,
  subscribedAppsUrl,
  parseTokenResponse,
  pickPhoneNumber,
  EmbeddedSignupError,
} from "./embeddedSignup";
import { EmbeddedSignupSchema } from "./validation";

describe("embedded signup — URL builders", () => {
  it("builds the oauth code→token exchange URL with platform credentials", () => {
    const u = new URL(tokenExchangeUrl("v21.0", "APP123", "SECRET", "the-code"));
    expect(u.pathname).toBe("/v21.0/oauth/access_token");
    expect(u.searchParams.get("client_id")).toBe("APP123");
    expect(u.searchParams.get("client_secret")).toBe("SECRET");
    expect(u.searchParams.get("code")).toBe("the-code");
  });

  it("builds phone-number discovery + subscribe URLs scoped to the WABA", () => {
    expect(phoneNumbersUrl("v21.0", "999")).toContain("/v21.0/999/phone_numbers");
    expect(subscribedAppsUrl("v21.0", "999")).toBe(
      "https://graph.facebook.com/v21.0/999/subscribed_apps",
    );
  });
});

describe("parseTokenResponse", () => {
  // POSITIVE: long-lived token with no expiry reported
  it("returns a null expiry for a long-lived token", () => {
    const r = parseTokenResponse({ access_token: "EAAG-long" });
    expect(r.accessToken).toBe("EAAG-long");
    expect(r.tokenExpiresAt).toBeNull();
  });

  // POSITIVE: computes the absolute expiry from expires_in
  it("computes tokenExpiresAt from expires_in", () => {
    const now = 1_700_000_000_000;
    const r = parseTokenResponse({ access_token: "EAAG", expires_in: 3600 }, now);
    expect(r.tokenExpiresAt?.getTime()).toBe(now + 3600 * 1000);
  });

  // NEGATIVE: a Graph error surfaces as EmbeddedSignupError
  it("throws on a Graph error payload", () => {
    expect(() => parseTokenResponse({ error: { message: "bad code" } })).toThrow(EmbeddedSignupError);
  });

  // NEGATIVE: a missing token is an error, not a silent empty string
  it("throws when no access_token is present", () => {
    expect(() => parseTokenResponse({})).toThrow(/did not return an access token/);
  });
});

describe("pickPhoneNumber", () => {
  // POSITIVE: first number with full metadata
  it("picks the first phone number and its metadata", () => {
    const picked = pickPhoneNumber({
      data: [{ id: "111", display_phone_number: "+966 50 000 0000", verified_name: "Nazzil" }],
    });
    expect(picked).toEqual({
      phoneNumberId: "111",
      displayPhoneNumber: "+966 50 000 0000",
      verifiedName: "Nazzil",
    });
  });

  // NEGATIVE: empty / malformed responses return null (caller errors clearly)
  it("returns null when no phone numbers exist", () => {
    expect(pickPhoneNumber({ data: [] })).toBeNull();
    expect(pickPhoneNumber({})).toBeNull();
    expect(pickPhoneNumber(null)).toBeNull();
  });
});

describe("EmbeddedSignupSchema", () => {
  // POSITIVE: code + numeric waba, phone number id optional
  it("accepts a valid payload without a phone number id", () => {
    const r = EmbeddedSignupSchema.safeParse({ code: "abc", wabaId: "1234567890" });
    expect(r.success).toBe(true);
  });

  // NEGATIVE: a non-numeric WABA id is rejected
  it("rejects a non-numeric waba id", () => {
    const r = EmbeddedSignupSchema.safeParse({ code: "abc", wabaId: "not-a-number" });
    expect(r.success).toBe(false);
  });

  // NEGATIVE: an empty code is rejected
  it("rejects an empty authorization code", () => {
    const r = EmbeddedSignupSchema.safeParse({ code: "", wabaId: "1234567890" });
    expect(r.success).toBe(false);
  });
});
