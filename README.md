# Outflow

A simple, calm app that shows where your money goes each month. You import your credit card statements, Outflow sorts each purchase into a category, and you see this month's spending at a glance.

Plain HTML, CSS and JavaScript. No build step. It runs on GitHub Pages and keeps your data in your own Supabase project.

## What it does

- **This month:** what you've spent so far, roughly where you'll end up by month end, and how that compares with the same point last month. The comparison turns amber only when you're spending noticeably faster (more than 15% ahead).
- **Where it went:** spending by category and your top shops. Tap a category to see its lines.
- **Last 6 months:** a simple bar chart. Tap a bar to jump to that month.
- **Activity:** every line grouped by day, with search (across all months) and a category filter. Tap a line to edit or delete it. Tap its category to change it in one tap.
- **Learns your shops:** when you change a category with "Always for this shop" on, Outflow updates that shop's other lines and uses the new category for future imports.
- **Your own categories:** add, rename or delete them under More.
- **Add by hand:** the **+** button. Use it for anything paid from chequing.
- **Paid for others:** paid a $100 restaurant bill when only $30 was yours? Set your share to $30, and only that counts. Type it, or tap **Split 2/3/4 ways**; $0 means it was all for someone else. You can do this on any line, or right in the import preview ("Paid for others?" under each purchase). The e-transfers your friends send back aren't tracked, since setting your share already takes care of it.
- **Instalment plans:** a reminder list with the monthly amount and months left. It doesn't add to spending (see below).
- **Months:** use the arrows to move back and forward.
- Works on iPhone (add it to your home screen), on desktop, and in light and dark mode. It follows your system setting.

### Import rules

- **Credit card statements only:** Amex, RBC Visa and Neo, as CSV or PDF. PDFs are read in your browser with pdf.js and never uploaded anywhere.
- **Card payments** (`PAYMENT RECEIVED - THANK YOU`, `PAYMENT - THANK YOU / PAIEMENT - MERCI`, `Payment Received - Thank you`) are left out.
- **Pending lines** (Neo) are left out until they post, because their date or amount can still change.
- **Refunds** lower spending in the shop's category.
- **Nothing is added twice.** Each line gets a fingerprint (card, date, amount, start of the shop name), so re-importing a file or importing overlapping statements is safe. That includes a CSV and a PDF of the same card. Deleted lines stay remembered, so they don't come back on re-import.
- **Chexy rent:** only the 1.75% fee counts, under Fees. A $814 charge counts as $14; the $800 rent is left out.
- **Instalment plans:** a purchase counts once, in full, in the month you made it. Amex `INSTALLMENT PLAN FOR $…` credits are left out, so nothing is counted twice. `MONTHLY INSTALLMENT FEE` (Amex) and `INSTALLMENT INTEREST` (RBC) count as Fees.
- **Preview before saving:** number of new lines, total spending, and everything left out (payments, plan credits, lines already imported). You can untick any line.
- **PDF check:** when the statement shows a previous and new balance, Outflow checks that the lines add up and tells you if they don't.
- **Bought for someone else (Neo):** when a Neo purchase was paid off soon after (within 3 weeks) by a card payment of exactly the same amount, or two or three purchases add up to one payment, the preview suggests marking them as *for someone else*. One tap marks them all, so they count as $0 for you. Every purchase line in the preview also has its own "For someone else" button, on any card.
- **Dispute credits** (e.g. Neo's `Transaction Dispute Adjustment`) start unticked, because they reverse a charge that may be older than your imports.
- Months go by **purchase date**.

## Setup (about 10 minutes)

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (GitHub login is easiest).
2. Click **New project**. Name it `outflow`, pick a strong database password (save it somewhere; you won't need it day to day), choose the region **Canada (Central)**, and click **Create new project**.
3. Wait a minute or two until the project is ready.

### 2. Run the setup SQL

1. In the left sidebar, open **SQL Editor** and click **New query**.
2. Open `setup.sql` from this repo, copy all of it, paste it in, and click **Run**.
3. You should see "Success. No rows returned". The SQL is safe to run again later; it only creates what's missing.

This creates four tables (transactions, categories, shop rules, instalment plans) with **row-level security**, so each signed-in user can only ever see their own rows.

### 3. Connect the app

1. In Supabase, open **Project Settings → API** (on newer dashboards: **Project Settings → API Keys** and **Data API**).
2. Copy the **Project URL** and the **publishable key** (called the `anon` `public` key on older projects).
3. Open `config.js` and paste them in:
   ```js
   window.OUTFLOW_CONFIG = {
     SUPABASE_URL: 'https://abcdefgh.supabase.co',
     SUPABASE_ANON_KEY: 'sb_publishable_...'
   };
   ```
   This key is meant to be public. Your data is protected by row-level security and your password. **Never** put the `service_role` / secret key here.

### 4. Allow your site's address for login

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://fardinsami75.github.io/Out-Flow/`.

### 5. Put it on GitHub Pages

1. Push these files to the `FardinSami75/Out-Flow` repo (the `main` branch, at the top level).
2. On GitHub, open the repo's **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**.
3. After a minute, the app is live at `https://fardinsami75.github.io/Out-Flow/`.

### 6. Create your account, then lock sign-ups

1. Open the app, tap **First time here? Create an account**, and sign up with your email and a password.
2. If Supabase sends a confirmation email, tap the link, then sign in.
3. Because Outflow is just for you, turn off new sign-ups: in Supabase, go to **Authentication → Sign In / Providers** (older dashboards: **Authentication → Providers → Email**), switch **Allow new users to sign up** off, and save. You can still sign in.

### 7. Add it to your iPhone home screen

Open the site in Safari, tap **Share → Add to Home Screen**, and tap **Add**. It opens full screen like an app.

## Using it

1. Download a statement from your card's website. CSV is most reliable; PDF works too.
   - **Amex:** Statements & Activity → Download → CSV
   - **RBC:** Accounts → your Visa → Download transactions → CSV
   - **Neo:** in the Neo app or website, open your card → Statements / Transactions → Export CSV
2. In Outflow, tap the **upload** icon (top right), pick the card, and choose the file.
3. Check the preview and tap **Add**.
4. Fix any category in one tap; Outflow learns as you go. Your first import will have a few lines in **Other** (often shops from a trip). Fix them once with "Always for this shop" on and they'll be right from then on.

To look around without connecting anything, open the site with `?demo` at the end, e.g. `…/Out-Flow/?demo`. It uses sample data that is never saved.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The app: screens, styles and Supabase calls |
| `outflow-core.js` | Import and categorising logic: CSV and PDF reading, payment and refund rules, Chexy, dedupe, categories, month maths. No browser or network needed. |
| `config.js` | Your Supabase URL and publishable key |
| `setup.sql` | Database tables and row-level security. Safe to run more than once. |
| `tests/core.test.js` | Tests for the import logic |
| `manifest.webmanifest`, `icon-*.png` | Home-screen icon and name |

## Testing the import logic

You'll need [Node.js](https://nodejs.org). Then run:

```bash
node tests/core.test.js                                # built-in tests
node tests/core.test.js ~/Downloads/activity.csv       # plus your own statement: prints month totals
```

Statement files contain your personal spending. **Don't commit them to this repo**, because it's public. `.gitignore` blocks `*.csv` and `*.pdf` to help with that.

## Leaving room for later

- **Apple Pay shortcut:** each line has a `source` column (`amex`, `rbc`, `manual`, …). A future iOS Shortcut can insert rows with `source = 'applepay'` through the Supabase REST API, then the card import's fingerprint matching can be extended to merge them with statement lines.
- **Budget:** month totals already come from one function (`monthSummary` in `outflow-core.js`), so a monthly budget and warnings can be added on top without changing the import.
