# Opal Hotel Social Media Growth Hub — User Guide

### *"The True Meaning of Luxury"*

Welcome. This guide walks you through **everything** the Opal Hotel Social Media Growth Hub can do, one click at a time — written for a non-technical user. If you can send a WhatsApp message on your phone, you can run this. Take it section by section; nothing here can break anything.

> A styled, shareable web version of this guide is published at **`/USER-GUIDE.html`** on your Hub.

---

## 1. What This Is

The Opal Hotel Social Media Growth Hub is a **website your team logs into** to talk to guests and customers on WhatsApp — far more powerfully than from a phone. With it you can:

- 📇 Keep an organized **address book** of your customers
- 📣 Send **one message to many people at once** (a "broadcast")
- 💬 **Chat back and forth** with guests in a shared inbox
- 🤖 Build a **chatbot** that answers automatically, 24/7
- 🛍️ Take **orders** from a product catalog (optional)

> **📝 Note:** Everything happens in your **web browser**. There's nothing to download or install.

## 2. What You'll Need Before You Start

1. **The web address (link)** for your Hub — bookmark it.
2. **Your login email and password** — your administrator creates these.
3. **A connected WhatsApp Business number** — set up once by an admin (Section 13).
4. **A modern web browser** on a computer (best) or phone.

> **⚠️ Warning:** Keep your password private — anyone with your login can message customers as your business.

## 3. Logging In

1. Go to **your Hub link**.
2. On the **"Sign in"** screen, type your **Email**, then your **Password**.
3. Click **Sign in**.

> **✅ Success:** the page changes to a **Dashboard** with a menu across the top.

> **⚠️ Common mistake:** extra spaces before your email/password (common when copy-pasting).

> **💡 Tip:** use the **☀ / ☾ toggle** (top-right) to switch between the light cream theme and the dark black-and-gold theme. Your choice is remembered.

## 4. The Main Menu

| Menu item | What it's for |
|-----------|---------------|
| **Dashboard** | Home screen — quick overview |
| **Inbox** | Live back-and-forth chats |
| **Orders** | Customer orders (if you sell products) |
| **Contacts** | Your customer address book |
| **Lists** | Groups of contacts |
| **Templates** | Pre-approved message designs for broadcasts |
| **Campaigns** | Send a message to many people at once |
| **Chatbot** | Build automatic-reply bots |
| **Settings** | Setup: number, team, AI, automation… |

The gold logo in the top-left always returns you to the Dashboard.

## 5. Adding Contacts

**Add one person:** Click **Contacts** → in the **"Add contact"** form enter a **First name** and a **Phone with country code** (e.g. `+966 50 000 0000`) → **Add**.

**Add many (import a spreadsheet):** find **Upload CSV**, download the example file, put your customers in that format, **Save as CSV**, then **Choose file** → **Upload**.

> **⚠️ Warning:** always include the country code, and only upload people who **agreed** to hear from you — messaging non-opted-in people can get your number blocked by Meta.

> **📝 Note:** customers who reply **STOP** are auto-removed from all future broadcasts.

## 6. Lists

A **List** is a named group of contacts (e.g. "VIP guests"). Click **Lists** → **"New list"** → type a name → **Create**. Lists are how you choose **who** receives a broadcast.

> **📝 Note:** a **List** is built by hand; a **Segment** fills itself from rules. Beginners can stick to Lists.

## 7. Message Templates

> **📝 The "24-hour window":** WhatsApp only lets you free-type within **24 hours** of the customer's last message. Outside that, you must use a **pre-approved template**.

A **template** is a message design that **Meta reviews and approves**. Click **Templates → New template**, give it a name/language/body (use `{{1}}` as a personalization blank), and **Submit**.

> **✅ Success:** it appears as **PENDING**, then **APPROVED** (minutes to hours).

> **⚠️ Common mistake:** you can only broadcast with **APPROVED** templates.

## 8. Sending a Broadcast

Click **Campaigns** → new broadcast → **choose an APPROVED template** → **choose an audience** (List/Segment) → **fill the blanks** → **Send now** or **Schedule** → **Send**.

> **✅ Success:** a live bar showing **Queued → Sending → Sent**.

> **💡 Tip:** for your first broadcast, make a tiny test List with just your own number.

> **⚠️ Common mistake:** double-check the audience — a broadcast can't be "unsent."

## 9. The Inbox

Click **Inbox** → click a conversation → type your reply → **Send**. You can mark chats **Open / Pending / Closed**, **assign** them, leave private **internal notes**, insert **canned replies**, and (if AI is on) use **Suggest reply / Summarize / Translate**.

> **📝 Note:** AI **suggests**; nothing reaches the customer until **you** click Send.

> **⚠️ Warning:** if a customer hasn't messaged in 24 hours, use an approved **template** to re-open the chat.

## 10. Building a Chatbot

Click **Chatbot → + New chatbot**, name it, and add **steps** (hover any step for a tooltip):

| Step | What it does |
|------|--------------|
| **Send message** | Sends text, then continues |
| **Ask & wait** | Asks a question, saves the reply |
| **Buttons / menu** | Up to 10 choices; branches on the pick |
| **Branch on reply** | Routes by keywords |
| **Delay** | Waits a set time before the next step |
| **AI answer** | Answers from your uploaded knowledge |
| **AI Agent** | Smart AI that chats until done |
| **End** | Ends the conversation |

**Drag** steps to reorder; each **Buttons/Branch** choice picks its next step via **"→ go to…"**. Set **Status → Published** and **Save**.

> **⚠️ Warning:** AI steps only give real answers if your admin turned on AI + uploaded knowledge. The other 6 steps always work.

> **📝 Note:** a saved bot doesn't run until you connect it to a **trigger** (next section).

## 11. Automation — Making the Bot Start

Go to **Settings → Automation** → new rule → choose a **Trigger** (**Keyword match** or **Outside business hours**) → choose an **Action** (**Send auto-reply text** or **Start a chatbot**) → **Save**.

> **⚠️ Common mistake:** only **Published** chatbots appear under "Start a chatbot."

> **💡 Tip:** if you reply manually to a chat the bot is handling, the bot steps aside.

## 12. Orders & Selling (optional)

Customers send a **cart** from WhatsApp → it appears under **Orders** → moves **NEW → CONFIRMED → SHIPPED → DELIVERED**, messaging the customer automatically at each step.

> **📝 Note:** an admin must connect your catalog in **Settings → Commerce** first.

## 13. Settings — One-Time Setup

| Tab | What it's for |
|-----|---------------|
| **WhatsApp connection** | Connect your number (**required** before sending) |
| **Team** | Add teammates + permission levels |
| **Canned replies** | Reusable inbox snippets |
| **AI knowledge** | Upload documents AI steps answer from |
| **Automation** | The rules from Section 11 |
| **WhatsApp Flows** | Advanced forms (until Meta approves) |
| **Commerce** | Connect your product catalog for Orders |

> **⚠️ Warning:** turning on AI requires your administrator to add a secret API key on the server. If AI says *"not configured,"* that key isn't set yet.

## 14. Troubleshooting

- **Can't sign in?** Check for extra spaces; confirm the link; ask an admin to reset your password.
- **Broadcast won't send?** Template must be **APPROVED**; pick an audience.
- **Can't reply — box blocked?** The **24-hour window**; use a template.
- **Chatbot won't start?** Is it **Published**? Did you add an **Automation rule** pointing at it?
- **AI says "a team member will follow up"?** AI isn't switched on yet.
- **Scheduled/Delay action never ran?** The background **worker** may be down — ask your admin.
- **Orders empty?** Connect a catalog in **Settings → Commerce**.

## 15. Glossary

| Term | Meaning |
|------|---------|
| **Broadcast / Campaign** | One message sent to many contacts at once |
| **Template** | A message design Meta must approve before broadcasting |
| **Approved / Pending** | A template's review status |
| **Contact** | One customer in your address book |
| **List** | A group of contacts you build by hand |
| **Segment** | A smart group that fills automatically from rules |
| **Inbox** | The shared space where customer chats live |
| **Canned reply** | A saved snippet for the inbox |
| **Chatbot** | An automatic step-by-step responder |
| **Trigger** | The condition that starts an automation |
| **24-hour window** | Free-type only within 24h of the customer's last message |
| **Opt-out / STOP** | Reply STOP → auto-removed from broadcasts |
| **Catalog** | Your products (in Meta) that enable Orders |
| **AI knowledge** | Documents you upload so AI answers from your real info |
| **Worker** | Behind-the-scenes helper that sends broadcasts + runs timed actions |
| **CSV** | A simple spreadsheet format for importing contacts |

---

*Opal Hotel Social Media Growth Hub · The True Meaning of Luxury*
