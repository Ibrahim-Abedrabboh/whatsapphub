import { z } from "zod";
import { resolveTzOffsetMin } from "./sendTime";

// E.164 without leading '+', 8–15 digits (covers KSA/Kuwait/Qatar/Jordan, etc.)
export const PhoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[^\d]/g, "")) // strip +, spaces, dashes
  .pipe(z.string().regex(/^\d{8,15}$/, "Phone must be 8–15 digits in E.164"));

export const ContactRowSchema = z.object({
  phone: PhoneSchema,
  name: z.string().trim().max(120).optional(),
  // any extra CSV columns become template variables
  attributes: z.record(z.string()).default({}),
});
export type ContactRow = z.infer<typeof ContactRowSchema>;

/** Build a single display name from first/last parts. Returns undefined if both are blank. */
export function composeName(first?: string | null, last?: string | null): string | undefined {
  const name = [first, last].map((p) => p?.trim()).filter(Boolean).join(" ");
  return name.length > 0 ? name : undefined;
}

// Add a single contact via the UI. The phone is expected as E.164 digits (the
// form composes country code + national number); PhoneSchema re-validates it.
export const CreateContactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional(),
  phone: PhoneSchema,
  listId: z.string().min(1).optional(),
  // extra key/value template variables
  attributes: z.record(z.string()).default({}),
});
export type CreateContactInput = z.infer<typeof CreateContactSchema>;

export const CreateBroadcastSchema = z.object({
  templateId: z.string().min(1),
  // Audience: exactly one of listId / segmentId (refined below).
  listId: z.string().min(1).optional(),
  segmentId: z.string().min(1).optional(),
  // Map template {{1}},{{2}}... to a Contact field or literal.
  // e.g. [{ "from": "name" }, { "literal": "20% off" }]
  variableMap: z
    .array(
      z.union([
        z.object({ from: z.string().min(1) }),
        z.object({ literal: z.string() }),
      ]),
    )
    .default([]),
  // ISO 8601; null/absent = send now. Must be in the future if provided.
  scheduleAt: z
    .string()
    .datetime()
    .refine((s) => new Date(s).getTime() > Date.now(), "scheduleAt must be in the future")
    .optional(),
  // Media URL for the header — required when the chosen template has a media header.
  headerMediaUrl: z.string().url().optional(),
  // Coupon code — required when the chosen template has a COPY_CODE button.
  couponCode: z.string().trim().min(1).max(15).optional(),
  // A/B test (V2 M4 §2.7): send template B to a deterministic slice of the
  // audience. splitPercent = % of contacts that get variant A.
  abTest: z
    .object({
      templateBId: z.string().min(1),
      splitPercent: z.number().int().min(1).max(99).default(50),
    })
    .optional(),
  // Tracked link (V2 M4 §2.9): destination URL for a per-broadcast short link.
  // The template's URL button must be dynamic ({{1}}) and point at /r/.
  trackedUrl: z.string().trim().url("Tracked link must be a valid URL").max(2000).optional(),
  // Send-time optimization (V2 M4 §2.7): hold each recipient until HH:MM in
  // their own timezone, read from the named contact attribute. defaultTz is a
  // manual audience-wide fallback (offset or IANA name) for contacts without one.
  sendTime: z
    .object({
      targetLocal: z.string().regex(/^\d{2}:\d{2}$/, "Target time must be HH:MM"),
      tzAttr: z.string().trim().min(1).max(60).default("tz"),
      defaultTz: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .refine((v) => resolveTzOffsetMin(v, new Date()) !== null, {
          message: "Unknown timezone — use an offset like +3 or a name like Asia/Riyadh",
        })
        .optional(),
    })
    .optional(),
}).refine((b) => !!b.listId !== !!b.segmentId, {
  message: "Choose a recipient list or a segment (exactly one)",
  path: ["listId"],
}).refine((b) => !b.abTest || b.abTest.templateBId !== b.templateId, {
  message: "Variant B must use a different template than A",
  path: ["abTest"],
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const CreateListSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

// Create a WhatsApp template and submit it to Meta for approval.
export const CreateTemplateSchema = z
  .object({
    name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "Use lowercase letters, numbers, and underscores only"),
    language: z.string().trim().min(2).max(12),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
    // Optional media header (attachment). PDF counts as DOCUMENT. The example is
    // a sample media URL/handle Meta uses while reviewing the template.
    header: z
      .object({
        format: z.enum(["IMAGE", "DOCUMENT", "VIDEO"]),
        example: z.string().trim().min(1, "Add a sample media URL for the header"),
      })
      .optional(),
    body: z.string().trim().min(1).max(1024),
    bodyExamples: z.array(z.string()).default([]),
    footer: z.string().trim().max(60).optional(),
    buttons: z
      .array(
        z.object({
          type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE"]),
          text: z.string().trim().min(1).max(25),
          url: z.string().url().optional(),
          phoneNumber: z.string().trim().regex(/^\+?[0-9]{6,20}$/, "Use digits, optional leading +").optional(),
          couponExample: z.string().trim().min(1).max(15).optional(),
        }),
      )
      .max(3)
      .default([]),
    // Carousel: 2–10 cards, each a media URL + static body + optional URL button.
    carousel: z
      .object({
        cards: z
          .array(
            z.object({
              format: z.enum(["IMAGE", "VIDEO"]),
              mediaUrl: z.string().url(),
              body: z.string().trim().min(1).max(160),
              buttonText: z.string().trim().max(25).optional(),
              buttonUrl: z.string().url().optional(),
            }),
          )
          .min(2, "A carousel needs at least 2 cards")
          .max(10),
      })
      .optional(),
  })
  .refine((t) => t.buttons.every((b) => b.type !== "URL" || !!b.url), {
    message: "URL buttons need a URL",
    path: ["buttons"],
  })
  .refine((t) => t.buttons.every((b) => b.type !== "PHONE_NUMBER" || !!b.phoneNumber), {
    message: "Call buttons need a phone number",
    path: ["buttons"],
  })
  .refine((t) => t.buttons.every((b) => b.type !== "COPY_CODE" || !!b.couponExample), {
    message: "Copy-code buttons need a sample coupon code",
    path: ["buttons"],
  })
  .refine(
    (t) => {
      const vars = (t.body.match(/\{\{\d+\}\}/g) ?? []).length;
      return t.bodyExamples.filter((e) => e.trim()).length >= vars;
    },
    { message: "Provide an example value for each {{variable}}", path: ["bodyExamples"] },
  );

// 5-field cron (min hour dom month dow). Loose validation — BullMQ parses fully.
const CRON_RE = /^(\S+\s+){4}\S+$/;
export const CreateRecurringSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateId: z.string().min(1),
  listId: z.string().min(1),
  cron: z.string().trim().regex(CRON_RE, "cron must have 5 fields, e.g. 0 9 * * 1"),
  variableMap: z
    .array(z.union([z.object({ from: z.string().min(1) }), z.object({ literal: z.string() })]))
    .default([]),
});
export type CreateBroadcastInput = z.infer<typeof CreateBroadcastSchema>;

export const SendMessageSchema = z.object({
  text: z.string().trim().min(1, "Message can't be empty").max(4096),
});

// Update a conversation's helpdesk status and/or assignment (V2 §2.3).
// assignedToId: a User id, the literal "me", or null to unassign; omit to leave
// unchanged. status: omit to leave unchanged. At least one field is required.
export const UpdateConversationSchema = z
  .object({
    status: z.enum(["OPEN", "PENDING", "CLOSED"]).optional(),
    assignedToId: z.union([z.string().trim().min(1), z.null()]).optional(),
  })
  .refine((d) => d.status !== undefined || d.assignedToId !== undefined, {
    message: "nothing to update",
  });

// Internal note on a conversation (V2 §2.3) — agent-only, never sent.
export const CreateNoteSchema = z.object({
  body: z.string().trim().min(1, "Note can't be empty").max(4000),
});

// Edit a contact (V2 M4 §2.6 adds tags + attributes to the existing fields).
export const UpdateContactSchema = z
  .object({
    optedOut: z.boolean().optional(),
    name: z.string().trim().max(120).optional(),
    phone: PhoneSchema.optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
    attributes: z.record(z.string()).optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), { message: "Nothing to update" });

// Dynamic segment (V2 M4 §2.7). Create + full update. Condition fields:
// "name", "optedOut", "tag", or "attr:<key>"; exists/isTrue need no value.
export const SegmentConditionSchema = z
  .object({
    field: z
      .string()
      .trim()
      .max(60)
      .regex(/^(name|optedOut|tag|attr:.+)$/, "field must be name, optedOut, tag, or attr:<key>"),
    op: z.enum(["eq", "neq", "contains", "exists", "isTrue"]),
    value: z.string().trim().max(120).optional(),
  })
  .refine((c) => c.op === "exists" || c.op === "isTrue" || (c.value ?? "").length > 0, {
    message: "This operator needs a value",
    path: ["value"],
  });

export const SegmentRulesSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(SegmentConditionSchema).min(1, "Add at least one condition").max(20),
});

export const SegmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  rules: SegmentRulesSchema,
});

// Public landing-page lead form. `website` is a honeypot — humans never see
// it; a non-empty value means a bot filled the form.
export const LeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: PhoneSchema,
  business: z.string().trim().max(120).optional(),
  website: z.string().max(200).optional(), // honeypot
});

// Send catalog products into a conversation (V2 M5 §2.10). One id → a single
// product message; more → a product_list (hard-capped at Meta's 30).
export const SendProductSchema = z.object({
  retailerIds: z.array(z.string().trim().min(1)).min(1, "Pick at least one product").max(30, "WhatsApp allows at most 30 products per message"),
  body: z.string().trim().max(1024).optional(),
});

// Order status change (V2 M5 §2.10). notify=false skips the customer message.
export const UpdateOrderSchema = z.object({
  status: z.enum(["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
  notify: z.boolean().default(true),
});

// Commerce catalog connection (V2 M5 §2.10). Meta catalog ids are numeric.
export const CommerceCatalogSchema = z.object({
  metaCatalogId: z.string().trim().regex(/^\d{5,32}$/, "Enter the numeric catalog ID from Meta Commerce Manager"),
});

// AI translate request (V2 M3 §2.4).
export const TranslateSchema = z.object({
  text: z.string().trim().min(1, "Nothing to translate").max(8000),
  target: z.enum(["AR", "EN"]),
});

// WhatsApp Flow (V2 M3 §2.5). Create + full update.
export const FlowSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  definition: z.record(z.unknown()),
});

// No-code inbound automation rule (V2 M3 §2.5). Create + full update.
export const AutomationRuleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  enabled: z.boolean().default(true),
  trigger: z.discriminatedUnion("type", [
    z.object({ type: z.literal("keyword"), keywords: z.array(z.string().trim().min(1)).min(1, "Add a keyword").max(20) }),
    z.object({
      type: z.literal("away"),
      days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
      start: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
      end: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
      tzOffset: z.number().int().min(-720).max(840).optional(),
    }),
  ]),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("sendText"), body: z.string().trim().min(1, "Reply body is required").max(1000) }),
    z.object({ type: z.literal("startChatbot"), chatbotId: z.string().trim().min(1, "Pick a chatbot") }),
  ]),
});

// FAQ knowledge-base document (V2 M3 §2.4). Used for create + full update.
export const KnowledgeSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  content: z.string().trim().min(1, "Content is required").max(20000),
  source: z.string().trim().max(40).optional(),
});

// No-code chatbot flow (V2 M3). A state machine: startId + nodes keyed by id.
// Wait-nodes (question | branch | aiAgent) pause for the next inbound message.
const ChatbotNodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("message"),
    text: z.string().trim().min(1, "Message text is required").max(1000),
    nextId: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("question"),
    text: z.string().trim().min(1, "Question text is required").max(1000),
    saveAs: z.string().trim().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "saveAs must be a valid variable name"),
    nextId: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("branch"),
    cases: z
      .array(z.object({ keywords: z.array(z.string().trim().min(1)).min(1, "Add a keyword"), nextId: z.string().min(1) }))
      .min(1, "Add at least one branch case"),
    defaultNextId: z.string().optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("buttons"),
    text: z.string().trim().min(1, "Prompt text is required").max(1000),
    options: z
      .array(z.object({ label: z.string().trim().min(1, "Add a label").max(24), nextId: z.string().min(1) }))
      .min(1, "Add at least one option")
      .max(3, "WhatsApp allows up to 3 buttons"),
  }),
  z.object({ id: z.string().min(1), type: z.literal("ai"), nextId: z.string().optional() }),
  z.object({
    id: z.string().min(1),
    type: z.literal("aiAgent"),
    goal: z.string().trim().max(500).optional(),
    maxTurns: z.number().int().min(1).max(20).optional(),
    nextId: z.string().optional(),
  }),
  z.object({ id: z.string().min(1), type: z.literal("end") }),
]);

export const ChatbotFlowSchema = z
  .object({ startId: z.string().min(1), nodes: z.record(z.string(), ChatbotNodeSchema) })
  .superRefine((flow, ctx) => {
    // Every node's map key must equal its own id.
    for (const [key, node] of Object.entries(flow.nodes)) {
      if (node.id !== key) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Node key "${key}" does not match its id "${node.id}"`, path: ["nodes", key] });
      }
    }
    // startId must resolve to a node.
    if (!flow.nodes[flow.startId]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `startId "${flow.startId}" is not a node`, path: ["startId"] });
    }
    // Every outgoing reference must resolve.
    const refs: { id: string; path: (string | number)[] }[] = [];
    for (const [key, node] of Object.entries(flow.nodes)) {
      if ("nextId" in node && node.nextId) refs.push({ id: node.nextId, path: ["nodes", key, "nextId"] });
      if (node.type === "branch") {
        node.cases.forEach((c, i) => refs.push({ id: c.nextId, path: ["nodes", key, "cases", i, "nextId"] }));
        if (node.defaultNextId) refs.push({ id: node.defaultNextId, path: ["nodes", key, "defaultNextId"] });
      }
      if (node.type === "buttons") {
        node.options.forEach((o, i) => refs.push({ id: o.nextId, path: ["nodes", key, "options", i, "nextId"] }));
      }
    }
    for (const r of refs) {
      if (!flow.nodes[r.id]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Reference to unknown node "${r.id}"`, path: r.path });
      }
    }
  });

export type ChatbotFlow = z.infer<typeof ChatbotFlowSchema>;

// Create / full-update payload for a chatbot.
export const CreateChatbotSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  flow: ChatbotFlowSchema,
});

// Per-client canned reply (V2 §2.3). Used for both create and full update.
export const CannedReplySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80),
  shortcut: z.string().trim().max(40).optional(),
  body: z.string().trim().min(1, "Body is required").max(4000),
});

export const CreateClientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Slug: 2–40 lowercase letters, numbers, or hyphens").optional(),
  // Optional: provision the client's first ADMIN login alongside the tenant.
  // Blank password → the server auto-generates a strong one and returns it once.
  adminEmail: z.string().trim().email("Enter a valid admin email").optional(),
  adminPassword: z.string().min(8, "Password must be ≥8 chars").max(200).optional(),
});

// Inbound webhook payload — only the fields we consume, validated defensively.
export const WebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string().optional(), // WABA id → owning client
      changes: z.array(
        z.object({
          field: z.string().optional(),
          value: z.object({
            // Identifies which business phone number (→ which client) this is for.
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            // Template approval/rejection updates (field: message_template_status_update)
            event: z.string().optional(),
            message_template_name: z.string().optional(),
            message_template_language: z.string().optional(),
            reason: z.string().nullish(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.enum(["sent", "delivered", "read", "failed"]),
                  recipient_id: z.string().optional(),
                  errors: z.array(z.object({ title: z.string() })).optional(),
                }),
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string().optional(), // wamid of the inbound message
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                  // Reply context: id = wamid of the message being replied to
                  // (i.e. the template we sent) — links a click back to a recipient.
                  context: z.object({ id: z.string() }).optional(),
                  // Quick-reply button tap on a template message.
                  button: z.object({ text: z.string().optional(), payload: z.string().optional() }).optional(),
                  // Interactive reply buttons / lists.
                  interactive: z
                    .object({
                      type: z.string().optional(),
                      button_reply: z.object({ id: z.string().optional(), title: z.string().optional() }).optional(),
                      list_reply: z.object({ id: z.string().optional(), title: z.string().optional() }).optional(),
                    })
                    .optional(),
                  // Inbound media (we store the id + type; download is a follow-up).
                  image: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().optional() }).optional(),
                  document: z.object({ id: z.string().optional(), mime_type: z.string().optional(), filename: z.string().optional(), caption: z.string().optional() }).optional(),
                  audio: z.object({ id: z.string().optional(), mime_type: z.string().optional() }).optional(),
                  video: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().optional() }).optional(),
                  sticker: z.object({ id: z.string().optional(), mime_type: z.string().optional() }).optional(),
                  reaction: z.object({ emoji: z.string().optional(), message_id: z.string().optional() }).optional(),
                  location: z.object({ latitude: z.number().optional(), longitude: z.number().optional(), name: z.string().optional(), address: z.string().optional() }).optional(),
                  // Cart order (V2 M5 §2.10) — items the customer placed.
                  order: z
                    .object({
                      catalog_id: z.string().optional(),
                      text: z.string().optional(),
                      product_items: z
                        .array(
                          z.object({
                            product_retailer_id: z.string().optional(),
                            quantity: z.union([z.number(), z.string()]).optional(),
                            item_price: z.union([z.number(), z.string()]).optional(),
                            currency: z.string().optional(),
                          }),
                        )
                        .optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});
export type WebhookPayload = z.infer<typeof WebhookSchema>;

// Instagram Messaging / Messenger webhooks share the Meta Platform "messaging"
// shape (object differs: "instagram" vs "page"). Defensive + optional-chaining
// safe: route handlers re-check `object` and verify the HMAC signature.
const MessagingEventSchema = z.object({
  sender: z.object({ id: z.string().optional() }).optional(),
  recipient: z.object({ id: z.string().optional() }).optional(),
  timestamp: z.number().optional(),
  message: z
    .object({
      mid: z.string().optional(),
      text: z.string().optional(),
      is_echo: z.boolean().optional(),
      attachments: z
        .array(z.object({ type: z.string().optional(), payload: z.object({ url: z.string().optional() }).optional() }))
        .optional(),
    })
    .optional(),
});

export const InstagramWebhookSchema = z.object({
  object: z.string(),
  entry: z
    .array(z.object({ id: z.string().optional(), messaging: z.array(MessagingEventSchema).optional() }))
    .default([]),
});
export type InstagramWebhookPayload = z.infer<typeof InstagramWebhookSchema>;

export const MessengerWebhookSchema = InstagramWebhookSchema;
export type MessengerWebhookPayload = z.infer<typeof MessengerWebhookSchema>;

// ─── Embedded Signup (V2 M1) ────────────────────────────────────────
// Body posted by the client after Meta's popup returns. The phone number id
// is optional — when the popup doesn't surface it, the server discovers it
// from the WABA. Meta ids are numeric strings; the code is an opaque token.
export const EmbeddedSignupSchema = z.object({
  code: z.string().trim().min(1, "Authorization code is required").max(2048),
  wabaId: z.string().trim().regex(/^\d{5,32}$/, "Invalid WhatsApp Business Account id"),
  phoneNumberId: z.string().trim().regex(/^\d{5,32}$/, "Invalid phone number id").optional(),
});
export type EmbeddedSignupInput = z.infer<typeof EmbeddedSignupSchema>;
