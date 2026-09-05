---
paths:
  - "src/**"
  - "prisma/**"
  - "scripts/**"
  - "deploy/**"
---

# WhatsApp Hub V2 rules

- This is the V2 repository. Follow its own routes, schema, worker, and deployment files; do not copy V1 assumptions from `wa-broadcast`.
- Preserve explicit consent, opt-out enforcement, approved templates, signature verification, replay protection, idempotency, bounded retries, rate limits, and audit records.
- Derive workspace and account scope from authenticated server context.
- Never log message bodies, access tokens, webhook secrets, or full phone numbers.
- Production sends, backfills, migrations, and deployment require explicit approval.
