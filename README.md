# Lead Flow — Facebook Lead Ad → Supabase → Moosend

Replaces Zapier in your Facebook Lead Ad pipeline. When someone submits your Facebook Instant Form, this app:

1. Receives the lead via Facebook Webhook
2. Saves the lead to your Supabase database
3. Automatically adds them to your Moosend mailing list

You get a private super admin dashboard to view, search, and sort all leads.

---

## Setup

### 1. Clone & Install

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `MOOSEND_API_KEY` | Moosend → Account → API Key |
| `MOOSEND_MAILING_LIST_ID` | Moosend → Mailing Lists → click your list → ID in URL |
| `FB_VERIFY_TOKEN` | Any random string you choose (e.g. `my-secret-token-123`) |
| `FB_PAGE_ACCESS_TOKEN` | Facebook Developers → Your App → Page Access Token |

### 3. Set Up Supabase Database

Run the contents of `supabase-migration.sql` in your **Supabase SQL Editor** (supabase.com → your project → SQL Editor).

### 4. Create Your Admin Account

In Supabase → **Authentication** → **Users** → **Invite User**, add your email. You'll receive a link to set your password. This is your super admin login.

### 5. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000` to log in to the admin dashboard.

### 6. Deploy to Vercel

```bash
npx vercel --prod
```

Add all your `.env.local` variables in Vercel → Project → Settings → Environment Variables.

---

## Facebook Webhook Setup

Once deployed, set up the webhook in Facebook Developers:

1. Go to [developers.facebook.com](https://developers.facebook.com) → Your App → **Webhooks**
2. Subscribe to the **Page** object, `leadgen` field
3. Set **Callback URL** to: `https://your-vercel-url.vercel.app/api/facebook/webhook`
4. Set **Verify Token** to the value you chose for `FB_VERIFY_TOKEN`
5. Go to **Products → Lead Ads** → connect your Facebook Page

---

## Lead Fields Captured

| Field | Facebook Form Field Name |
|---|---|
| First Name | `first_name` |
| Last Name | `last_name` |
| Email | `email` |
| Phone | `phone_number` |
| Appointment Date | `appointment_scheduled_time` or `date` |
| Budget | `budget` or `what_is_your_budget_` |

> Note: The exact field name for "budget" depends on what you named your custom question in the Facebook Lead Ad form. Check your form and update `src/app/api/facebook/webhook/route.ts` line ~95 if needed.
