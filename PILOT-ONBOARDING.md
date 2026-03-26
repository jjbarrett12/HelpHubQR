# HelpHubQR – Pilot Onboarding Checklist

Use this checklist to onboard a pilot property in under 2 hours.

---

## 1. Create property + branding (≈15 min)

1. In Supabase (or via app when available): create a row in **properties** with name, timezone, and branding (logo_url, primary_color, support_phone).
2. Link the supervisor account to the property in **supervisor_profiles** (user_id → property_id).
3. In the app: go to **Property – MVP config** and confirm/edit property name, timezone, logo URL, primary color, and support phone.

---

## 2. Import rooms/locations (≈15 min)

1. Add **locations** for the property (type: `room` or `public_area`, identifier: e.g. room number or "Lobby").
2. Options:
   - Add one-by-one (room 101, 102, …).
   - Bulk insert via SQL or CSV import if you have a script.
3. Ensure each location has a **qr_codes** row (id = qrId, e.g. base62 token). Generate if missing; use a secure random string per location.

---

## 3. Request types + SLAs (≈10 min)

1. In **Property – MVP config**, review **Request types**.
2. Keep to **6–10** request types (e.g. Towels, Room refresh, Maintenance, Other).
3. Set **default SLA** (minutes) per type and mark **Active** as needed.
4. Edit label and SLA per row and click **Save**.

---

## 4. Generate QR codes and print (≈20 min)

1. In **Property – MVP config**, open **QR code export**.
2. **Download CSV** for records (identifier, type, qr_id, url).
3. **Print / PDF**: opens a print-friendly page with one QR per location. Print or save as PDF for laminating.
4. Guest URLs are: `{APP_URL}/q/{qrId}` (entry decides guest vs staff).
5. Place printed QR codes in each room (and optional BOH for staff shift token).

---

## 5. Place BOH shift token for shared devices (≈5 min)

1. Create a **shift_tokens** row for the property (role: hk, eng, or sup; token = random string; valid_from/valid_to).
2. Generate a **separate QR** that points to the same app with a known qrId (e.g. lobby or a “Staff” location), or use the same `/q/{qrId}` and have staff tap “I’m staff” and enter the shift token.
3. Post the shift token QR in the back-of-house so staff can scan and enter the key on shared devices.

---

## 6. Train supervisors (≈15 min)

1. Show **Supervisor** console: **Open / Overdue / Escalated** filters and task list.
2. Open a **task detail** page: event timeline and proof of work (photo/note).
3. Explain that staff use the **staff flow** (scan room QR → “I’m staff” → key → Start/Complete/Escalate) with no login.
4. Optional: show **Metrics** (GET `/api/metrics`) for counts and SLA compliance.

---

## 7. Train staff (≈10 min huddle)

1. **Scan room QR** → choose “I’m staff” → enter the **shift key** (from BOH QR or manager).
2. One screen: list of tasks for that location. **Start** when beginning, **Complete** when done (optional note + photo), **Escalate** if needed.
3. Works **offline**: actions queue and sync when back online.

---

## 8. Run pilot (4 weeks)

- Daily champion check-in with the property.
- Review: adoption %, SLA %, time-to-response, reopen rate.

---

## Success targets

- **70%+** of eligible tasks captured.
- **60%+** staff adoption (measured by events).
- Observable reduction in radio/call volume (e.g. from front desk logs).

---

## Quick reference – URLs

| Role      | Entry |
|----------|--------|
| Guest    | Scan room QR → `APP_URL/q/{qrId}` → “I’m a guest” → submit request. |
| Staff    | Scan room QR → “I’m staff” → enter shift key → task list. |
| Supervisor | Log in → **Supervisor** → filters + task detail. |
