# Lead Flow Admin — Technical Documentation

A Next.js application that receives Facebook Lead Ads via webhook, stores leads in Supabase, syncs them to Moosend, and displays them in a private admin dashboard.

**Live URL:** https://lead-flow-admin-omega.vercel.app  
**GitHub:** https://github.com/wshinn1/Social-Media-Flow  
**Stack:** Next.js 14 (App Router), Supabase, Moosend, deployed on Vercel

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Environment Variables](#environment-variables)
3. [Supabase Setup](#supabase-setup)
4. [Local Development](#local-development)
5. [Deploying to Vercel](#deploying-to-vercel)
6. [Facebook Webhook Setup — Full Technical Walkthrough](#facebook-webhook-setup)
7. [How the Webhook Works](#how-the-webhook-works)
8. [Refreshing the Page Access Token](#refreshing-the-page-access-token)
9. [Lead Field Mapping](#lead-field-mapping)
10. [Adding a New Instaform](#adding-a-new-instaform)
11. [Token Expiry Banner](#token-expiry-banner)
12. [Troubleshooting](#troubleshooting)

---

## System Architecture

```
Facebook Lead Ad submitted
        │
        ▼
Facebook Graph API
        │  fires webhook event (POST)
        ▼
POST /api/facebook/webhook   (Vercel serverless function)
        │
        ├─── Fetch lead details from Facebook Graph API
        │    using FB_PAGE_ACCESS_TOKEN
        │
        ├─── INSERT into Supabase `leads` table
        │    using SUPABASE_SERVICE_ROLE_KEY
        │
        └─── POST to Moosend API
             adds subscriber to mailing list
```

The admin dashboard at `/admin` reads directly from Supabase using the user's authenticated session (Supabase Auth).

---

## Environment Variables

| Variable | Description | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Supabase → Settings → API |
| `MOOSEND_API_KEY` | Moosend API key | Moosend → Account → API Key |
| `MOOSEND_MAILING_LIST_ID` | UUID of your Moosend list | Moosend → Mailing Lists → URL |
| `FB_VERIFY_TOKEN` | A secret string you choose for webhook verification | Set once, never changes |
| `FB_PAGE_ACCESS_TOKEN` | Facebook Page Access Token | See token refresh section below |
| `FB_APP_SECRET` | Facebook App Secret for the Wedding Lead Flow app | Facebook App Dashboard → Basic Settings |

---

## Supabase Setup

### Run Migration

In Supabase → **SQL Editor**, run `supabase-migration.sql`. This creates:

```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  first_name text,
  last_name text,
  email text not null,
  phone text,
  appointment_date text,
  budget text,
  fb_leadgen_id text unique,
  fb_page_id text
);
```

Row Level Security is enabled:
- **Authenticated users** can SELECT (admin dashboard reads)
- **Service role** can INSERT (webhook writes using `SUPABASE_SERVICE_ROLE_KEY`)

### Create Admin User

Supabase → **Authentication** → **Users** → **Invite User** → enter your email. Set a password via the invite link. This is your only login credential.

---

## Local Development

```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```

Visit `http://localhost:3000`. Facebook webhooks won't fire locally (no public URL) — use the Facebook Webhooks Test button for local testing via a tunnel like `ngrok`.

---

## Deploying to Vercel

```bash
git push origin main
```

Vercel auto-deploys on every push to `main`. Add all env vars in Vercel → Project → **Settings** → **Environment Variables**, then trigger a manual redeploy after adding new vars.

---

## Facebook Webhook Setup

This is the most complex part. Here is the exact process that was used to get this working, with all the lessons learned.

### Key Concepts

- **Facebook App Type matters**: Consumer apps block `pages_read_engagement`, `leads_retrieval`, and `pages_manage_metadata` without App Review. Use a **Business** type app instead.
- **Two things are required** to receive lead webhooks:
  1. Configure a webhook endpoint in the Facebook App Dashboard (Webhooks product → Page → leadgen)
  2. Subscribe the specific Facebook Page to your app via `POST /{page-id}/subscribed_apps`
- **A Page Access Token is required** for `subscribed_apps`. A User Token is not sufficient. A Page Access Token is derived from a User Token but scoped to the page.
- **App must be in Live mode** for the Lead Ads Testing Tool to deliver events to it.

### Step 1 — Create a Business-Type Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. On the "Use cases" screen, select **Others (5)** → choose **Other** (the legacy option at the bottom)
3. On the app type screen, choose **Business**
4. Name it (e.g. `Wedding Lead Flow`), set your email, connect your **Business Portfolio** (e.g. Wes Shinn Photography)
5. Click **Create App**

> **Why not Consumer?** Consumer apps require "Data Access Renewal" with business portfolio verification (takes 2+ days) before API access is granted. Business apps have more permissive defaults for page management APIs.

### Step 2 — Add Webhooks Product

1. In your new app dashboard, scroll to **Add products** → find **Webhooks** → **Set up**
2. Change the **Select product** dropdown from `User` to **`Page`**
3. Fill in:
   - **Callback URL**: `https://your-vercel-url.vercel.app/api/facebook/webhook`
   - **Verify Token**: the value of your `FB_VERIFY_TOKEN` env var
4. Click **Verify and save** — Facebook will call your webhook with a GET request; your server echoes back the `hub.challenge` value
5. After saving, scroll down to find `leadgen` in the field list and toggle it to **Subscribed**

### Step 3 — Switch App to Live Mode

1. At the top of the app dashboard, toggle from **Development** to **Live**
2. If prompted for a Privacy Policy URL, enter your app's deployed URL (e.g. `https://lead-flow-admin-omega.vercel.app`)
3. Save and toggle Live

> **Why Live mode?** The Facebook Lead Ads Testing Tool only delivers webhook events to apps in Live mode. In Development mode, test events are not dispatched.

### Step 4 — Get a Page Access Token

This requires going through the Graph API Explorer to generate a token with the right permissions.

1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. In the **Meta App** dropdown, select your **Wedding Lead Flow** app
3. In **Add a Permission**, add all four:
   - `pages_show_list`
   - `pages_read_engagement`
   - `leads_retrieval`
   - `pages_manage_metadata`
4. Click **Generate Access Token** — authorize the popup
5. In the query bar, run: `{PAGE_ID}?fields=access_token`
   - Replace `{PAGE_ID}` with your Facebook Page ID (e.g. `1636980056352348`)
6. The response will contain `"access_token": "EAAR..."` — this is your **Page Access Token**

### Step 5 — Subscribe the Page to Your App

Run this curl command (or use Graph API Explorer with a POST request):

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/subscribed_apps" \
  -d "subscribed_fields=leadgen" \
  -d "access_token={PAGE_ACCESS_TOKEN}"
```

Expected response: `{"success":true}`

> This call tells Facebook: "When a lead is submitted to this page, send a webhook event to the app that owns this token."

### Step 6 — Add Page Access Token to Vercel

1. Go to [vercel.com](https://vercel.com) → your project → **Settings** → **Environment Variables**
2. Add/update `FB_PAGE_ACCESS_TOKEN` with the token from Step 4
3. Trigger a **Redeploy**

### Step 7 — Test

1. Go to [developers.facebook.com/tools/lead-ads-testing](https://developers.facebook.com/tools/lead-ads-testing)
2. Select your Facebook Page
3. Confirm your app appears with a **green checkmark** in the subscribed apps list
4. Click **Delete lead** (if one exists) then **Create lead**
5. Click **Track status** — your app should show **Success**
6. Check your admin dashboard — the lead should appear

---

## How the Webhook Works

### Verification (GET)

When you save the webhook in the Facebook App Dashboard, Facebook sends:

```
GET /api/facebook/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=RANDOM_STRING
```

Your server checks that `hub.verify_token` matches `FB_VERIFY_TOKEN` and echoes back `hub.challenge`. This proves you control the endpoint.

### Lead Event (POST)

When a lead is submitted, Facebook sends:

```json
{
  "object": "page",
  "entry": [{
    "id": "PAGE_ID",
    "time": 1234567890,
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "LEAD_ID",
        "page_id": "PAGE_ID",
        "form_id": "FORM_ID",
        "created_time": 1234567890
      }
    }]
  }]
}
```

Your webhook handler (`src/app/api/facebook/webhook/route.ts`) then:

1. Extracts `leadgen_id` and `page_id` from the payload
2. Makes a GET request to `https://graph.facebook.com/v19.0/{leadgen_id}?access_token={FB_PAGE_ACCESS_TOKEN}` to retrieve the actual lead data (name, email, phone, etc.)
3. Inserts the lead into Supabase using the service role key
4. POSTs the subscriber to Moosend

---

## Refreshing the Page Access Token

The Page Access Token expires (typically within 60 days for tokens derived from short-lived User Tokens). When it expires, the webhook will still receive events but will fail to fetch lead details from Facebook.

The admin dashboard automatically checks token validity on login and shows a banner with instructions if expired.

### To refresh manually:

1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Select the **Wedding Lead Flow** app (App ID: `1255136706706699`)
3. Add permissions: `pages_show_list`, `pages_read_engagement`, `leads_retrieval`, `pages_manage_metadata`
4. Click **Generate Access Token** and authorize
5. Run `1636980056352348?fields=access_token` in the query bar
6. Copy the `access_token` value from the response
7. Go to Vercel → project → **Settings** → **Environment Variables** → update `FB_PAGE_ACCESS_TOKEN`
8. Trigger a **Redeploy**
9. Re-run the `subscribed_apps` curl command to keep the page subscription active:
   ```bash
   curl -X POST "https://graph.facebook.com/v25.0/1636980056352348/subscribed_apps" \
     -d "subscribed_fields=leadgen" \
     -d "access_token={NEW_PAGE_TOKEN}"
   ```

### Long-lived token (optional, advanced)

To extend the token to 60 days, exchange it before getting the page token:

```bash
curl "https://graph.facebook.com/oauth/access_token\
?grant_type=fb_exchange_token\
&client_id={APP_ID}\
&client_secret={APP_SECRET}\
&fb_exchange_token={SHORT_LIVED_USER_TOKEN}"
```

Then use the long-lived User Token to get the Page Token via the Graph API Explorer. The page token derived from a long-lived user token can be non-expiring for some token types.

---

## Lead Field Mapping

Facebook Lead Ad forms use internal field names. The webhook maps them to database columns as follows:

| Database Column | Facebook Field Name(s) |
|---|---|
| `first_name` | `first_name` |
| `last_name` | `last_name` |
| `email` | `email` |
| `phone` | `phone_number` |
| `appointment_date` | `appointment_scheduled_time`, `date` |
| `budget` | `budget`, `what_is_your_budget_` |

The mapping lives in `src/app/api/facebook/webhook/route.ts` in the `fetchFacebookLead` function:

```ts
return {
  first_name: fields["first_name"] ?? "",
  last_name: fields["last_name"] ?? "",
  email: fields["email"] ?? "",
  phone: fields["phone_number"] ?? "",
  appointment_date: fields["appointment_scheduled_time"] ?? fields["date"] ?? "",
  budget: fields["budget"] ?? fields["what_is_your_budget_"] ?? "",
};
```

---

## Adding a New Instaform

If you create a new Facebook Lead Ad form with different custom field names:

1. In Facebook Ads Manager, check the exact field name keys used in your form (they are snake_case versions of your question labels)
2. Open `src/app/api/facebook/webhook/route.ts`
3. Update the return object in `fetchFacebookLead` to add fallbacks for your new field names, e.g.:
   ```ts
   appointment_date: fields["appointment_scheduled_time"] ?? fields["wedding_date"] ?? fields["date"] ?? "",
   ```
4. Commit and push — Vercel auto-deploys

No changes to the webhook subscription or Facebook App are needed for new forms on the same page.

---

## Token Expiry Banner

The file `src/app/api/token-status/route.ts` is called on every admin dashboard load. It makes a request to the Facebook Graph API using the current `FB_PAGE_ACCESS_TOKEN`. If Facebook returns an error, the dashboard shows:

- **Red banner** — token expired or missing (leads NOT being received)
- **Yellow banner** — token expiring within 7 days
- **No banner** — token is valid

---

## Troubleshooting

### Webhook not receiving events
- Check that the app is in **Live mode** (not Development)
- Confirm `leadgen` is **Subscribed** in Webhooks → Page product
- Re-run the `subscribed_apps` curl command with a fresh Page Access Token

### Lead appears in Track Status as failed
- Check Vercel function logs for the POST to `/api/facebook/webhook`
- Usually means `FB_PAGE_ACCESS_TOKEN` is expired — refresh it (see above)

### `me/accounts` returns empty `{ "data": [] }`
- Your page is managed through a Business Manager, not your personal account
- Use `/{PAGE_ID}?fields=access_token` directly instead

### `API access deactivated` error
- The Facebook App has a pending "Data Access Renewal" compliance form
- Go to: developers.facebook.com/apps/{APP_ID}/app-review/required-actions
- Complete all sections (Allowed Usage, Data Handling, Reviewer Instructions, Business Connection)
- Business Connection requires business portfolio verification (can take 2 days)

### `pages_read_engagement` not available
- This permission is restricted for **Consumer** type apps
- Solution: create a new **Business** type app (see Facebook Webhook Setup above)

### Token exchange fails with "access token does not belong to application"
- The token you're using was generated for a different app
- In the Access Token Tool / Graph API Explorer, ensure the correct app is selected before generating

---

## Facebook App Reference

| App | App ID | Type | Status | Purpose |
|---|---|---|---|---|
| Wedding Lead Flow | `1255136706706699` | Business | Live | **Active webhook app** |
| Wes Shinn Wedding Photography | `273009613898456` | Consumer | Live | Legacy (not used for webhooks) |

**Page ID:** `1636980056352348` (Wes Shinn Photography)  
**Business Portfolio:** Wes Shinn Photography (`917760895397915`)
