import { test, expect, request } from "@playwright/test";

// Mirrors dashboard.spec.ts: covers the /chatbot auth gate without needing
// seeded credentials. The authenticated build-and-save flow is exercised by the
// unit tests on lib/chatbotBuilder (blocksToFlow/flowToBlocks) + a manual smoke;
// an end-to-end logged-in build would need the storageState fixture from
// e2e/auth.spec.ts.

test.describe("Chatbot page & API auth gate", () => {
  // NEGATIVE: the builder page is behind auth — unauthenticated → /login
  test("chatbot page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/chatbot");
    await expect(page).toHaveURL(/\/login/);
  });

  // NEGATIVE: listing chatbots requires a session
  test("GET /api/chatbots → 401 unauthenticated", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${baseURL}/api/chatbots`);
    expect(res.status()).toBe(401);
  });

  // NEGATIVE: creating a chatbot requires a session
  test("POST /api/chatbots → 401 unauthenticated", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${baseURL}/api/chatbots`, { data: {} });
    expect(res.status()).toBe(401);
  });
});
