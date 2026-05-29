# Aitek Billing — Automated Billing & Invoice Management System

A production-ready billing platform for **Aitek Solutions**: manage clients and services, create and send professional PDF invoices from a shared Outlook mailbox, collect payments via Stripe, and automate monthly billing and overdue reminders.

Built with **Next.js 14 (App Router) · TypeScript · PostgreSQL + Prisma · Tailwind + shadcn/ui · NextAuth · Stripe · Microsoft Graph · node-cron**.

---

## Features

- 🔐 **Secure admin login** (NextAuth credentials, JWT sessions, bcrypt-hashed passwords)
- 📊 **Dashboard** — revenue this month, pending/overdue/paid stats, 6-month revenue chart, recent invoices
- 👥 **Clients** — full CRUD, profiles with invoice & payment history, recurring service assignments, soft-deactivation
- 🧾 **Invoices** — manual builder with line items, live tax/total calc, preview, draft → send workflow, status timeline, PDF download, reminders
- 🛠 **Services** — reusable catalog used as invoice line items
- 📄 **Professional PDF invoices** — auto-generated, itemized, with Stripe pay-link
- 📧 **Email** — sent from a shared Outlook mailbox via Microsoft Graph (invoice, payment confirmation, reminder templates) with full email logging
- 💳 **Stripe** — automatic payment links per invoice + webhook-driven payment reconciliation
- 🔔 **Notifications** — in-app notification center + email, with live unread badge
- ⏰ **Automation** — monthly auto-billing (1st @ 09:00) and daily overdue detection (@ 10:00) via node-cron, also exposed as secured cron API endpoints
- ⚙️ **Settings** — company info, tax rate, billing day, reminder window, and credential management
- 🎨 **Dark, responsive admin UI** — deep navy / electric blue, color-coded status badges, skeleton loaders, toasts, empty states

---

## 1. Prerequisites

- **Node.js 20+** and npm
- **PostgreSQL 14+** (local install, Docker, or a hosted provider like Neon/Supabase/RDS)
- A **Stripe account** (test mode is fine to start)
- An **Azure AD tenant** with permission to register an app and a **shared Outlook mailbox** (e.g. `billing@aitek-solutions.com`)

---

## 2. Installation

```bash
# from the project root
npm install
cp .env.example .env     # then edit .env (see below)
```

Fill in `.env` (all variables are documented inline in `.env.example`):

| Variable | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random string — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` in dev) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Stripe API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same publishable key (client-exposed) |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen` or the dashboard |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_TENANT_ID` / `MICROSOFT_CLIENT_SECRET` | Azure app registration |
| `SHARED_MAILBOX_ADDRESS` | Outlook shared mailbox emails are sent from |
| `COMPANY_NAME` | Your company name |
| `NEXT_PUBLIC_APP_URL` | Public base URL |
| `CRON_SECRET` | Shared secret protecting `/api/cron/*` |
| `SEED_ADMIN_*` | Initial admin account (seed script) |

> Credentials for Stripe and Microsoft Graph can also be entered/overridden later in the in-app **Settings** page — DB values take precedence over env vars.

Then create the database schema:

```bash
npm run db:migrate     # creates tables (dev — prompts for a migration name)
# or, against an existing/prod DB:
npm run db:deploy      # applies committed migrations non-interactively
```

---

## 3. Configure the Outlook shared inbox (Microsoft Graph)

The app sends all billing email **from a shared mailbox** using the Graph API with the **client-credentials** (app-only) flow.

1. **Azure Portal → Microsoft Entra ID → App registrations → New registration.**
   - Name: `Aitek Billing Mailer`. Supported account types: *Accounts in this organizational directory only*. No redirect URI needed.
   - After creating, copy the **Application (client) ID** → `MICROSOFT_CLIENT_ID` and the **Directory (tenant) ID** → `MICROSOFT_TENANT_ID`.
2. **Certificates & secrets → New client secret.** Copy the secret **Value** (not the ID) → `MICROSOFT_CLIENT_SECRET`. (Secrets expire — note the expiry.)
3. **API permissions → Add a permission → Microsoft Graph → Application permissions →** add **`Mail.Send`** (and optionally `Mail.ReadWrite`). Then click **Grant admin consent**.
4. **Create / identify the shared mailbox** (Microsoft 365 admin center → Teams & groups → Shared mailboxes), e.g. `billing@aitek-solutions.com` → `SHARED_MAILBOX_ADDRESS`.
5. *(Recommended, least-privilege)* Restrict the app to only that mailbox with an **Application Access Policy** in Exchange Online PowerShell:
   ```powershell
   New-ApplicationAccessPolicy -AppId <MICROSOFT_CLIENT_ID> `
     -PolicyScopeGroupId <mail-enabled-security-group-containing-the-mailbox> `
     -AccessRight RestrictAccess -Description "Restrict Aitek Billing to billing mailbox"
   ```

Verify by sending a test invoice — the send is logged in **Invoice → Email Logs** (and the `EmailLog` table).

---

## 4. Configure Stripe (payments + webhook)

1. Get your **test** API keys (Stripe Dashboard → Developers → API keys) → `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. **Local webhook (development)** — install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Copy the printed `whsec_...` signing secret → `STRIPE_WEBHOOK_SECRET`.
3. **Production webhook** — Dashboard → Developers → Webhooks → **Add endpoint**:
   - URL: `https://<your-domain>/api/webhooks/stripe`
   - Events: **`checkout.session.completed`**, **`payment_intent.succeeded`**, **`payment_intent.payment_failed`**
   - Copy the endpoint's signing secret → `STRIPE_WEBHOOK_SECRET`.

When a client pays via the invoice's payment link, the webhook marks the invoice **PAID**, records `paidAt`, sends a confirmation email, and creates a notification.

---

## 5. Seed the initial admin account

```bash
npm run db:seed
```

This creates the admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, initializes the Settings row, and adds a few sample services + a demo client with recurring services (handy for testing the monthly-billing job).

> **Change the seeded admin password after first login.**

---

## 6. Run in development

```bash
npm run dev          # Next.js app at http://localhost:3000
```

In a **separate terminal**, to run the automated billing/reminder scheduler locally:

```bash
npm run cron         # node-cron worker (monthly billing + daily overdue check)
```

You can also trigger the jobs manually (the worker is optional in dev):

```bash
curl -X POST http://localhost:3000/api/cron/monthly-billing -H "Authorization: Bearer $CRON_SECRET"
curl -X POST http://localhost:3000/api/cron/check-overdue   -H "Authorization: Bearer $CRON_SECRET"
```

Useful scripts: `npm run db:studio` (Prisma Studio), `npm run typecheck`, `npm run lint`, `npm run build`.

---

## 7. Deploy to production

**App (Vercel — recommended for Next.js):**
1. Push the repo to GitHub and import it in Vercel.
2. Add all `.env` variables in the Vercel project settings (use a **pooled** `DATABASE_URL` for serverless).
3. Build command `npm run build` (runs `prisma generate`); run `npm run db:deploy` against the production DB once (e.g. as a release step or locally with the prod `DATABASE_URL`).
4. Set the Stripe production webhook to `https://<domain>/api/webhooks/stripe`.

**Scheduling in production — choose one:**
- **Vercel Cron** (serverless-friendly): add to `vercel.json`
  ```json
  {
    "crons": [
      { "path": "/api/cron/monthly-billing", "schedule": "0 9 1 * *" },
      { "path": "/api/cron/check-overdue",   "schedule": "0 10 * * *" }
    ]
  }
  ```
  Protect the endpoints by sending the `CRON_SECRET` (Vercel Cron can be paired with a secret header, or verify the `x-vercel-cron` header). The routes require `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
- **Always-on host** (a VPS, container, or worker dyno): run `npm run cron` as a long-lived process (e.g. under `pm2` or systemd).

> Alternative app hosting (Docker / Node server): `npm run build && npm run start`. Ensure `prisma migrate deploy` runs against the production database before first boot.

---

## Project structure

```
prisma/
  schema.prisma            # data model (Admin, Client, Service, ClientService,
                           # Invoice, InvoiceItem, Notification, EmailLog, Settings)
  seed.ts                  # admin + sample data seeder
scripts/
  cron.ts                  # node-cron worker (monthly billing, overdue check)
src/
  app/
    (dashboard)/           # dashboard, clients, invoices, services, notifications, settings
    login/                 # admin login
    api/                   # REST routes (clients, invoices, services, notifications,
                           # dashboard/stats, settings, webhooks/stripe, cron/*, auth)
  components/              # UI (shadcn/ui primitives, layout, charts, tables, forms)
  lib/                     # prisma, auth, api helpers, stripe, email (graph/templates/send),
                           # pdf, cron jobs, invoice calc, validators, settings, utils
  types/                   # API & next-auth type augmentation
```

## Data model notes

Two models extend the original spec to support its requirements:
- **`Settings`** — singleton row backing the Settings page (company info, tax rate, billing day, reminder window, Stripe/Graph credentials). Secrets fall back to env vars when not set in the DB.
- **`ClientService`** — assigns recurring services to a client; the monthly auto-billing job reads these to generate invoices.

## Automation summary

| Job | Schedule | Action |
|---|---|---|
| Monthly billing | 1st of month, 09:00 | Generate + send invoices for active clients' recurring services |
| Overdue check | Daily, 10:00 | Mark overdue invoices, send reminder emails, notify |
| Stripe webhook | event-driven | Mark invoices paid, send confirmation, notify |

## Security notes

- All `/api/*` routes (except `auth`, `webhooks/stripe`, and `cron/*`) require an authenticated admin session.
- `cron/*` routes require the `CRON_SECRET`; the Stripe webhook verifies the Stripe signature.
- Credential secret fields are write-only in the UI (masked on read; blank submissions preserve existing values).
- `npm audit` reports some advisories from transitive dev dependencies — review before production and run `npm audit` to inspect.
