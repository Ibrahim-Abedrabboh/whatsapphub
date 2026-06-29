import { z } from "zod";

// Validate process.env once at boot. Fail fast on misconfiguration.
const EnvSchema = z.object({
  GRAPH_API_VERSION: z.string().default("v21.0"),
  WA_PHONE_NUMBER_ID: z.string().min(1),
  WA_BUSINESS_ACCOUNT_ID: z.string().min(1),
  WA_APP_ID: z.string().default(""), // Meta App ID; only needed for media (template header) uploads

  // ─── Embedded Signup (V2 M1) — platform-level Meta app running the
  // one-click onboarding flow. META_APP_ID falls back to WA_APP_ID; both
  // config id and secret are required for the flow to be offered. ───
  META_APP_ID: z.string().default(""),
  META_CONFIG_ID: z.string().default(""), // Embedded Signup configuration id

  WA_ACCESS_TOKEN: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  WA_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WA_MPS: z.coerce.number().int().positive().default(80),
  OPT_OUT_KEYWORDS: z.string().default("STOP,UNSUBSCRIBE"),

  // ─── AI assist (V2 M3 §2.4) — Claude via the Anthropic SDK. Optional:
  // the AI features stay dark until ANTHROPIC_API_KEY is set, so builds and
  // non-AI deploys work without it. ───
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-8"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ─── Auth ───────────────────────────────────────────────────────
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be ≥32 chars"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(1), // bcrypt hash; see scripts/hash-password.mjs
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(5), // attempts
  LOGIN_RATE_WINDOW: z.coerce.number().int().positive().default(300), // seconds
});

// Strict at boot, but skippable at build time (e.g. `next build` in a Docker
// image / Railway, before runtime secrets exist). Set SKIP_ENV_VALIDATION=1.
export const env = process.env.SKIP_ENV_VALIDATION
  ? (process.env as unknown as z.infer<typeof EnvSchema>)
  : EnvSchema.parse(process.env);

export const optOutKeywords = (env.OPT_OUT_KEYWORDS || "STOP,UNSUBSCRIBE")
  .split(",")
  .map((k) => k.trim().toUpperCase())
  .filter(Boolean);
