# Smart Campus — school demo

A working prototype of a school ERP for Indian schools, modelled on a Tamil Nadu
matriculation school. Built by [Innzout](https://innzout.com).

**It runs entirely in the browser.** No backend, no database server, no internet —
so a demo can never be derailed by something that failed to start.

```bash
npm install
npm run seed      # re-dates the demo to today
npm run dev       # http://localhost:5173
```

On Windows PowerShell, run each command on its own line — `&&` is not a valid
separator in Windows PowerShell 5.1.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run seed` | Regenerate the demo data relative to today |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Types only |

See **[DEMO.md](DEMO.md)** for the presentation running order and sign-ins.

## What it covers

Four roles, seventeen pages.

**Parent** — the primary user, and the reason the product sells. Daily attendance
with a calendar strip, term and bus fees with online payment and receipts, the
Quarterly report card with class rank, homework diary, circulars with
acknowledgement, PTM slot booking, school-visit gate pass, bus route and pickup time.

**Class teacher** — mark the daily register (parents of absentees are notified on
save), set homework, enter and publish marks, follow up on attendance and dues.

**Correspondent / Principal** — attendance by class, fee collection and the
defaulter follow-up list, outstanding by class, admissions, staff directory.

**Student** — timetable, homework, report card, library.

Parents sign in with the **student ID** printed on the school diary, which is how
schools actually distribute access.

## Data

`scripts/seed.mjs` generates ~14,300 rows into `src/data/*.json`: one school, six
classes, 180 students with linked parent accounts, 45 school days of daily
attendance, term exams, grade-scaled fees, circulars, PTM slots, gate visits,
bus routes and a library.

Dates are generated relative to the day the seed runs, and the app then **shifts
every date forward by whole weeks at load time**. Whole weeks, so each record
keeps its weekday and attendance never lands on a Sunday. A deployed demo
therefore stays current for months without redeploying.

Everything you change during a demo is written to `localStorage` and persists.
**Settings → Reset demo** restores the starting state.

## Deploying

The repository is configured for Vercel (`vercel.json`): it reseeds on every
build, outputs `dist/`, and rewrites all paths to `index.html` so deep links such
as `/fees` survive a refresh.

## Stack

React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · React Router 7 ·
Recharts 3 · Motion 13 · React Hook Form + Zod · Lucide · Sonner

Charts use a palette validated for colour-blind separation and contrast against
both the light and dark surfaces; every chart carries a table view, and status is
always icon plus label, never colour alone.

## Limits, stated plainly

- Single school, single device. Multi-school and multi-device need the API.
- Payments are a simulated gateway; Razorpay is the real integration.
- Report-card and receipt PDF downloads are stubbed.
- The timetable is fixed — there is no timetable builder with clash detection.
