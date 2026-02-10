# Customer dashboard – what to add next

You already have: **Sites** (ticket queue, filters, add ticket, push), **Admin – Customers** (sites), **Rooms & QR**, **Branding** (logo). Below are high-value additions for a customer (tenant) dashboard.

---

## 1. **Overview / Home (tenant-level)**

- **What:** A real dashboard at `/app` instead of immediately redirecting to the first site.
- **Why:** One place to see “my business at a glance” before drilling into a site.
- **Include:**
  - Total open tickets across all sites (or by site).
  - Quick list or cards of sites with open count and maybe “new today.”
  - Link to each site.
- **Effort:** Low–medium (one new page + small queries).

---

## 2. **Reports / Analytics**

- **What:** Simple reporting for admins: volume, response time, trends.
- **Why:** Customers want to show property managers “we resolved X requests this month” and spot busy sites.
- **Include:**
  - Tickets by site (count, last 7/30 days).
  - Tickets by status over time (new → in progress → resolved).
  - Optional: average time to resolve (if you store `resolved_at`).
- **Effort:** Medium (new page, date filters, maybe charts).

---

## 3. **Team / Users (tenant staff)**

- **What:** Let tenant admins see who’s in their org and optionally invite or manage roles.
- **Why:** “Who has access?” and “Add a new site manager” without going through you.
- **Include:**
  - List users in the tenant (from `profiles` + auth email).
  - Role (admin / manager / staff) and maybe “last active.”
  - Optional: invite by email (magic link or password reset); optional role change (admin only).
- **Effort:** Medium (RLS already scopes by tenant; add page + optional invite flow).

---

## 4. **Alerts / Notifications settings**

- **What:** Per-site (or per-tenant) control of how alerts are delivered.
- **Why:** Customer can turn SMS/email on or off, set numbers/addresses, quiet hours.
- **Include:**
  - List existing `alert_rules` for the tenant’s sites.
  - Add/edit/delete rules (channel: SMS vs email, recipient, maybe “only high priority”).
  - Optional: link to “Branding” or “Settings” so it feels like one “Settings” area.
- **Effort:** Medium (you have `send-alerts` and likely `alert_rules`; need UI and maybe RLS).

---

## 5. **Billing / plan (if you charge)**

- **What:** For SaaS billing: current plan, usage, next invoice, or “Contact sales.”
- **Why:** Reduces “what am I paying?” support and upsell opportunities.
- **Include:**
  - “Your plan” (name) and renewal date.
  - Optional: usage (e.g. sites, rooms, or tickets this month) if you meter.
  - Link to “Update payment” or “Contact us” (helphubqr.com or email).
- **Effort:** Depends on billing (Stripe vs manual; can start with static “Plan” + link).

---

## 6. **Site-level settings**

- **What:** Per-site config beyond rooms: timezone, logo, display name, alert defaults.
- **Why:** Multi-site customers can tailor each property.
- **Include:**
  - Timezone (you may have this), site name/address.
  - Optional: site logo (you have `sites.logo_url`), default alert preferences.
- **Effort:** Low–medium (forms on existing site admin or a “Site settings” tab).

---

## 7. **Export / CSV**

- **What:** Export tickets (or reports) as CSV for the tenant.
- **Why:** Property managers and accountants love spreadsheets; helps with audits.
- **Include:**
  - Date range + site filter → download CSV (ticket id, room, type, status, created, resolved, etc.).
- **Effort:** Low (server action or API route that streams CSV; RLS keeps it tenant-scoped).

---

## 8. **Help / support**

- **What:** In-app link to help docs, status page, or “Contact support.”
- **Why:** Fewer “where do I get help?” questions; feels polished.
- **Include:**
  - Sidebar or footer: “Help,” “Documentation,” “Contact support” (mailto or helphubqr.com).
- **Effort:** Low (links + optional simple “Help” page).

---

## Suggested order

| Priority | Item                    | Reason |
|----------|-------------------------|--------|
| 1        | Overview / Home         | Makes `/app` feel like a real dashboard. |
| 2        | Export / CSV            | High ask from customers; quick to add. |
| 3        | Team / Users            | Critical for multi-user customers. |
| 4        | Alerts settings         | You already have alerts; expose control. |
| 5        | Reports / Analytics     | Strong for renewals and upsell. |
| 6        | Site-level settings     | Nice polish; some data already there. |
| 7        | Billing / plan          | When you start charging. |
| 8        | Help / support          | Quick win. |

---

*Adjust order based on which customers ask for what first (e.g. CSV and Team often come up early).*
