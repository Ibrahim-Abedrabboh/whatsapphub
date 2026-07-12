# Channel Connection Checklist
## Opal Hotel Social Media Growth Hub

### *"The True Meaning of Luxury"*

Use this checklist to gather everything you need to connect your channels — **WhatsApp Cloud API, Facebook Page, Messenger, Instagram Inbox, and Instagram Page** — into one unified team inbox. Tick each item as you collect it. All of it comes from **Meta** (Facebook), through one app and one Business Portfolio.

> 📝 **Note:** You set up the **shared foundation once**, then add each channel's specific IDs and token.

---

## 0. Shared Foundation *(needed for every channel)*

- [ ] **Meta App** created at **developers.facebook.com**
- [ ] **Meta App ID** — App → Settings → Basic
- [ ] **Meta App Secret** — App → Settings → Basic *(verifies every incoming webhook)*
- [ ] **Business Portfolio (Business Manager)** at **business.facebook.com**, owning your number, Page, and Instagram account
- [ ] **Webhook Verify Token** — a secret phrase **you choose** (used once, when Meta connects the webhook)

> ⚠️ **Warning:** The **App Secret** and **Verify Token** are **reused across all channels** — you don't need a separate one per channel.

---

## 1. WhatsApp Cloud API

- [ ] **Phone Number ID** — from WhatsApp → **API Setup**
- [ ] **WhatsApp Business Account ID (WABA)** — from WhatsApp → **API Setup**
- [ ] **Access Token** — a **permanent / system-user token** (Business Settings → System Users → generate)
- [ ] **App ID** *(shared)* — required for media & template-header uploads

> ⚠️ **Warning:** The **Phone Number ID** and the **WABA ID** are **different numbers**, and **neither is the Business Portfolio ID**. Using the wrong one makes template features fail. Take both straight from **WhatsApp → API Setup**.

> 💡 **Tip:** The easiest route is the built-in **one-click Embedded Signup** — log in with Facebook, pick your number, and the **WABA, Phone Number ID, and token are captured automatically**. No manual copying.

---

## 2. Facebook Page + Messenger

- [ ] **Facebook Page ID** — the Page → About / Page settings
- [ ] **Page Access Token (long-lived)** — generated from the app with the `pages_messaging` permission
- [ ] Page **subscribed to the app's webhook** for `messages` and `messaging_postbacks`

> 📝 **Note:** Messenger and the Facebook Page **share the same Page ID + Page Access Token** — one token covers both.

---

## 3. Instagram Inbox + Instagram Page

- [ ] **Instagram Business Account ID** (the IG "asset" id used to route inbound messages)
- [ ] **Page Access Token** of the **linked Facebook Page** *(Instagram messaging uses the connected Page's token)*
- [ ] Instagram account is a **Professional (Business/Creator)** account, **linked to the Facebook Page**
- [ ] App granted `instagram_manage_messages` / `instagram_basic`

> ⚠️ **Warning:** Instagram DMs **cannot** be managed from a personal IG account — convert it to a **Professional** account and link it to the Facebook Page first.

---

## 4. Meta App Permissions *(request these on the app)*

First add the right **products** to your Meta app, then request each **permission**. In development they work for app testers/roles; for the public they need **Advanced Access** (granted through App Review).

- [ ] **Products added:** WhatsApp · Messenger · Instagram · Facebook Login for Business *(App dashboard → Add products)*

| Permission | Purpose | WhatsApp | Messenger | Instagram |
|-----------|---------|:---:|:---:|:---:|
| `whatsapp_business_messaging` | Send & receive WhatsApp messages | ✅ | — | — |
| `whatsapp_business_management` | Manage WABA, phone numbers, templates | ✅ | — | — |
| `business_management` | Manage assets in Business Manager | ✅ | ✅ | ✅ |
| `pages_show_list` | List & select the Page | — | ✅ | ✅ |
| `pages_manage_metadata` | Subscribe the Page to webhooks | — | ✅ | ✅ |
| `pages_messaging` | Send & receive Page/IG messages | — | ✅ | ✅ |
| `pages_read_engagement` | Read Page context for messaging | — | ✅ | ✅ |
| `instagram_basic` | Access the linked IG account | — | — | ✅ |
| `instagram_manage_messages` | Send & receive Instagram DMs | — | — | ✅ |

> ⚠️ **Warning — Advanced Access:** Every permission above starts at **Standard Access** (works only for app admins/testers). Each must be upgraded to **Advanced Access** via **App Review** before real customers can message you on Messenger or Instagram.

> 📝 **Note:** Instagram messaging runs on the **Messenger platform**, which is why it also needs the `pages_*` permissions — the IG account is reached through its connected Facebook Page.

---

## The Complete "Prepare This" Matrix

| # | Item | WhatsApp | Messenger / FB Page | Instagram |
|---|------|:---:|:---:|:---:|
| 1 | Meta **App ID** | ✅ | ✅ | ✅ |
| 2 | Meta **App Secret** | ✅ | ✅ | ✅ |
| 3 | **Webhook Verify Token** (chosen) | ✅ | ✅ | ✅ |
| 4 | **Phone Number ID** | ✅ | — | — |
| 5 | **WABA ID** | ✅ | — | — |
| 6 | **WhatsApp Access Token** | ✅ | — | — |
| 7 | **Facebook Page ID** | — | ✅ | — |
| 8 | **Page Access Token** | — | ✅ | ✅ *(same token)* |
| 9 | **Instagram Business Account ID** | — | — | ✅ |

---

## Before You Go Live

> ⚠️ **Warning — App Review:** WhatsApp works with a verified number right away, but **Messenger and Instagram messaging only reach the public after Meta approves your app's permissions (App Review)**. Until then, they work only for people added as **testers/roles** on the app. Plan time for this review.

> ✅ **Success:** With the shared foundation, each channel's IDs, and **one long-lived (non-expiring) token per channel**, your WhatsApp, Messenger, and Instagram conversations all flow into the same unified team inbox.

---

*Opal Hotel Social Media Growth Hub · The True Meaning of Luxury · Channel Connection Checklist*
