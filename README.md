# SmartBill CRM

Clients, quotations, invoices, payments, and monthly sales reports for SN Safety Signages.
Built with Next.js 16, TypeScript, Tailwind CSS 4, and Supabase (Postgres, Auth, Storage).
Emails are sent through Google Apps Script. WhatsApp uses click-to-chat links, with no API.

See [Architecture.md](Architecture.md) for the design.

## Features

- **Admin login** with email and password, a **forgot-password** email link, and password change in Settings
- **Clients**: profile, documents, ledger/statement, follow-ups and message history
- **Quotation → Proforma → Tax invoice** conversion in one click; credit notes against invoices
- An invoice editor that keeps everything from the old app:
  - Customer and product auto-search; new names are saved automatically
  - Ship-to address
  - Tax mode: Auto, IGST, or CGST+SGST
  - **Courier/freight charges**, **Auto-save to Drive**, **New**, and **Save & Print**
- **Price by size**: length × breadth in any unit, priced per sq ft. The old Material Calc is now a page under *Area Calculator* and can send its result to an invoice.
- **PDF invoices** with amount in words, GST breakup by rate, bank details, a UPI QR code for the exact amount, and a signature
- **Email** with the PDF attached, sent from your Gmail through Apps Script
- **WhatsApp** has two options:
  - "Open client's chat" opens `wa.me/<client>` with the message ready and a secure PDF link
  - "Share PDF file" (on phones) attaches the real PDF
- A **public share page** (`/share/<token>`) where clients can download the PDF, pay by UPI, and accept quotations
- **Payments**: partial payments; proforma advances carry over to the invoice
- **Status tracking**: paid, part paid and overdue
- **Monthly sales report**: KPIs vs last month and last year, daily and 6-month charts, invoice register, client-wise and HSN-wise summaries, GST summary (B2B/B2C, intra/inter-state), collections, and the quotation funnel. You can print it or download it as Excel.
- **Receivables ageing** with one-tap WhatsApp payment reminders
- **Financial-year numbering** (`INV/26-27/0001`), fully configurable, with no duplicate numbers across devices
- **Installable on your phone** as an app (PWA)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). The **Mumbai (ap-south-1)** region is fastest from India.
2. Open **SQL Editor**, paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and click **Run**. Then do the same with [`0002_bootstrap_orphan.sql`](supabase/migrations/0002_bootstrap_orphan.sql), [`0003_trash.sql`](supabase/migrations/0003_trash.sql) and [`0004_performance.sql`](supabase/migrations/0004_performance.sql), in that order.
3. Go to **Authentication → Sign In / Providers → Email**:
   - Keep Email enabled.
   - Turn **"Allow new users to sign up" OFF**. Only accounts you create can log in.
4. Go to **Authentication → URL Configuration**:
   - Set **Site URL** to your app URL, e.g. `https://your-app.netlify.app`.
   - Add `https://your-app.netlify.app/auth/confirm` and `http://localhost:3000/auth/confirm` to **Redirect URLs**.
5. Go to **Authentication → Emails → Reset Password** and change the link in the template to:
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset password</a>
   ```
   This lets the reset link work on any device. The default template also works, but only in the browser where the reset was requested.
6. Create the admin: go to **Authentication → Users → Add user → Create new user**, enter your email and password, and tick **Auto confirm**.
7. Go to **Project Settings → API** and copy the Project URL, the `anon` key and the `service_role` key.

The first account that signs in becomes the **owner**. The business profile is pre-filled with SN Safety Signages' details, bank account and terms, and you can edit all of it under **Settings**.

### 2. Environment

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. **Server only, never share it.** Only used by the public share page. |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL, used in WhatsApp and email links |
| `GAS_WEBAPP_URL`, `GAS_SHARED_SECRET` | From step 3 below |

### 3. Email and Drive backup (Google Apps Script)

1. Go to [script.google.com](https://script.google.com) → **New project**, and paste [`gas/Code.gs`](gas/Code.gs).
2. Go to **Project Settings → Script properties**, add `SHARED_SECRET`, and set it to a long random string. Use the same value for `GAS_SHARED_SECRET`.
3. Select the `authorize` function, click **Run**, and allow Gmail and Drive access.
4. Go to **Deploy → New deployment → Web app**. Set *Execute as*: **Me** and *Who has access*: **Anyone**. Copy the URL into `GAS_WEBAPP_URL`.
5. In the app, open **Settings → Email & Drive → Test connection**.

PDFs are saved in Drive under `SmartBill/<FY>/<Invoices|Quotations|…>/<Month>/`.
Gmail allows 100 emails a day on a free account and 1,500 a day on Google Workspace.

> If you edit `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

### 4. Branding

In **Settings → Business**, upload your logo, signature and payment QR as PNG or JPG files. Add your **UPI ID** as well. Invoices then show a QR code with the exact amount due.

### 5. Deploy (Netlify)

1. Push the repository to GitHub, then on Netlify choose **Add new site → Import from Git**. Netlify detects Next.js automatically.
2. Add the environment variables from step 2. Set `NEXT_PUBLIC_APP_URL` to the Netlify URL.
3. Deploy, then update the Supabase **Site URL** and **Redirect URLs** to match.

Vercel works the same way.

### Continuing your old invoice numbers

To keep numbering like `INV-101`, `INV-102`, go to **Settings → Numbering** and:
- Set the format to `{PREFIX}-{SEQ}` and the digits to `1`.
- Untick "Restart every April".
- Set the next tax invoice number to follow your last one.

## Development

```bash
npm run dev        # dev server
npm test           # unit tests (totals engine, GST, words, ledger, monthly report, PDF render)
npm run typecheck
npm run lint
npm run build
```

Project layout:

```
app/(auth)/         login, forgot-password, reset-password
app/(app)/          the signed-in app (dashboard, clients, quotations, invoices, …)
app/share/[token]   public document page for clients
app/api/            PDF and Excel downloads
app/actions/        server actions (all re-check the session; RLS enforces access in the DB)
lib/tax/            totals engine (paise-exact GST maths)
lib/pdf/            react-pdf invoice template (+ Noto Sans fonts for the ₹ sign)
lib/reports/        monthly report builder (shared by the page and the Excel export)
supabase/           database schema, RLS policies, numbering and payment triggers
gas/Code.gs         Google Apps Script mailer
```
