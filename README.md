# The Purple Skin Friendly Salon and Spa — website & booking system

Next.js 16 + Supabase + Razorpay + WhatsApp Cloud API, deployed on Vercel.

- **Website** (`/`): scroll-driven 3D walk into the spa (React Three Fiber, real photos), menu, salon, facilities, reviews, map. English + Hindi.
- **Booking** (`/book`): choose services → day & time → details → pay full / advance / at spa. Google sign-in.
- **Customer** (`/account`): bookings update live (therapist assignment appears instantly), cancel within the allowed window, pay balance.
- **Staff app** (`/staff`): installable PWA for therapists — today / upcoming / calendar, own monthly numbers and leave, start (locked until the booked time), complete, collect cash/UPI, push alerts. Customer phone and email are never sent to staff.
- **Admin** (`/admin`): today board, bookings as day/week/month calendar (therapist columns in day view) or a searchable, filterable list with CSV; booking panel with assign, start early, undo start, reschedule, payments, refunds and history; customers with visit history, spend, notes, tags and blocking; employees with services, commission and leave; services & rates; payments; monthly reports; settings.

## One-time setup

### 1. Database (Supabase)
Supabase Dashboard → **SQL Editor** → run, in order:
1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_seed.sql` (menu prices + admin email `purplespasalon23@gmail.com`)
3. `supabase/migrations/0003_grants.sql` (API access for the website; Row Level Security still applies)
4. `supabase/migrations/0004_staff_privacy_crm.sql` (hides customer phone from staff, start-time lock, customer records, leave, reschedule)

Salon prices and the Waxing / D-Tan durations in the seed are placeholders — edit them in **Admin → Services**.

### 2. Google sign-in
1. Google Cloud Console → APIs & Services → **Credentials** → Create OAuth client ID → *Web application*.
   - Authorised JavaScript origins: your site URL (e.g. `https://purplespa.in`) and `http://localhost:3000`
   - Authorised redirect URI: `https://pougvthcpmtamfxlvxnh.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Sign In / Providers → Google** → enable, paste Client ID and Secret.
3. Supabase → **Authentication → URL Configuration**: Site URL = your site URL; add redirect URLs
   `https://<your-domain>/auth/callback` and `http://localhost:3000/auth/callback`.

### 3. Vercel
Import the repo, then add every variable from `.env.example` in **Settings → Environment Variables**.
`vercel.json` schedules `/api/cron/daily` at 8:00 AM IST (releases unpaid holds, sends same-day reminders).
After running the SQL for the first time, redeploy once so the public menu is read from the database.

### 4. Razorpay
Dashboard → **Webhooks** → add `https://<your-domain>/api/payments/webhook`, events `payment.captured` and `payment.failed`, and put the secret in `RAZORPAY_WEBHOOK_SECRET`. Switch to live keys after KYC.

### 5. WhatsApp (Meta Cloud API)
Create these **Utility** templates in WhatsApp Manager (language must match `WHATSAPP_TEMPLATE_LANG`). Until WhatsApp is configured, messages are skipped and logged in `notification_log`.

| Template | Body (example wording) |
|---|---|
| `booking_confirmed` | Hi {{1}}, your booking {{2}} is confirmed: {{3}} on {{4}}. Payment: {{5}}. — The Purple Spa, M.P. Nagar |
| `therapist_assigned` | Hi {{1}}, {{2}} will be your therapist on {{3}} (booking {{4}}). See you soon. |
| `booking_cancelled` | Hi {{1}}, booking {{2}} for {{3}} has been cancelled. Call us to rebook. |
| `booking_reminder` | Hi {{1}}, reminder: {{2}} today at {{3}}. SF 14, Mansarovar Complex, M.P. Nagar. |
| `booking_completed` | Thank you for visiting, {{1}}. We hope to see you again. |
| `payment_received` | Hi {{1}}, we received {{2}} for booking {{3}}. |
| `staff_new_booking` (optional) | Hi {{1}}, new booking: {{2}} — {{3}} on {{4}}. |

## How employees get access
Admin → Employees → add their **Gmail**, gender, commission % and the services they can do. They open the site on their phone, sign in with Google, and land in the staff app. "Add to home screen" installs it; "Turn on booking alerts" enables push.

## Local development
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Images: originals live in `images/`; `node scripts/prepare-images.mjs` regenerates the optimised WebP files in `public/images/`.
`node scripts/seed-to-json.mjs` regenerates the fallback menu (shown before the database is set up) from the seed SQL.
