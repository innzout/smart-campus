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
| `npm run seed` | Regenerate the demo data relative to today, then check it |
| `npm run check-data` | 67 sanity checks over the generated JSON |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Types only |

See **[DEMO.md](DEMO.md)** for the presentation running order and sign-ins.

## What it covers

Seventeen roles across twenty-four pages, classes **1 to 12** including Higher
Secondary subject groups.

### The parent product

The primary user, and the reason the product sells. Daily attendance with a
calendar strip, term and bus fees with online payment and receipts, the Quarterly
report card with class rank, homework diary, circulars with acknowledgement, PTM
slot booking, school-visit gate pass, bus route and pickup time, and a transport
request the office acts on.

Parents sign in with the **student ID** printed on the school diary, which is how
schools actually distribute access.

### Running the school

**Academic setup** — the subject set is not uniform, and the model says so.
Classes 1–5 study four subjects, 6–8 study seven, 9–10 drop Computer Science, and
11–12 study two languages plus whichever four their group dictates. Subjects are
a catalogue scoped by grade; what a class studies is an explicit assignment with
a teacher against it. All five Higher Secondary groups are defined.

**Roles and permissions** — a person holds **several roles** and their permissions
are the union. This is not a convenience: in a school of five hundred the Accounts
Officer is also the Payroll Officer and a Vice Principal still teaches.
Designation (SGT for classes 1–5, B.T. Assistant for 6–10, P.G. Assistant for
11–12) is separate from role, and the assignment screens enforce the cadre. What
a role may do is editable data, not code.

**Staff recruitment** — application, documents with what is still outstanding,
then the Principal's decision. Approval is the act that creates the account.

**Cover and adjustments** — a teacher is absent, so each of their periods is
listed with the teachers genuinely free in that period, split into those who can
teach the subject and those who can only supervise. Both are read off the
timetable.

**Laboratories** — Physics, Chemistry, Botany, Zoology and Computer, each with an
in-charge and an assistant. Bench capacity drives everything: a class larger than
the lab splits into practical batches that attend on different days. Apparatus
register and breakage recovery included.

**Library** — accession, issue, renewal with a cap, fines, and lost or damaged
settlement charged against the book's price. Borrowing limits rise with the class.

**Transport** — routes, stops, buses with driver and attendant, allotment against
real seat counts, parent self-request, and vehicle compliance: fitness
certificate, insurance and permit expiry surfaced rather than filed.

**Payroll** — salary structures, monthly payslips, PF, ESI, professional tax and
loss of pay. See the limits below on what this is and is not.

**Branches** — the trust, its schools, and opening a new one with its
Correspondent. A dropdown beside the page title switches between them and
re-scopes every screen: classes, staff, fees, buses, circulars and figures. It
appears only for the trust's own account; everyone else is pinned to their own
school when they sign in, and pinned again on reload, so a shared office machine
cannot strand a teacher in another branch. The seeded second branch is a primary
school only, which is the point — the branches differ, so switching demonstrates
something.

Plus the original teaching and office flows: mark the register (parents of
absentees are notified on save), set homework, enter and publish marks, fee
collection at the counter with numbered receipts, the defaulter follow-up list,
admissions and the staff directory.

## Data

`scripts/seed.mjs` generates ~35,500 rows into `src/data/*.json`: a trust with two
populated branches — Coimbatore with fifteen classes from 1 to 12 and 436
students, Mettupalayam with five primary classes and 130 — each with linked
parent accounts, their own staff, 35 school days of daily attendance,
term exams with practical marks, grade-scaled fees, five laboratories with
batches and apparatus, staff applications with documents, leave and today's cover
assignments, four buses with compliance dates, payroll for three months, a
library, circulars, PTM slots and gate visits.

`scripts/check-data.mjs` then runs 67 checks over the result, including that
no branch's data leaks into another's — no child in another branch's class, no
class teacher from the wrong school, no bus or library crossing between them. These exist because
the failures that matter in a demo are not type errors — they are a screen that
renders correctly and says nothing, or says something false. A bus allotted beyond
its seats, a class with no subjects, a cover teacher already teaching that period:
all compile, all look fine, all wrong in front of a school.

Dates are generated relative to the day the seed runs, and the app then **shifts
every date forward by whole weeks at load time**. Whole weeks, so each record
keeps its weekday and attendance never lands on a Sunday. A deployed demo
therefore stays current for months without redeploying.

Everything you change during a demo is written to **IndexedDB** and persists.
Both branches together serialise to about 4.8 MB, past the 5 MB `localStorage`
quota once counted as UTF-16 — writes there failed silently, so anything done
during a presentation was lost on reload. **Settings → Reset demo** restores the
starting state.

A mutation hands the recipe a new root object holding new arrays of the same
rows, rather than a deep clone. Deep-cloning 35,000 rows measured 94 ms per
change, which is a visible stall when saving a register; this is a fraction of a
millisecond. The trade-off is documented at the top of `src/lib/store.ts`.

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

These are the places where the demo is not the product. Saying them first is what
makes the rest credible.

- **Branch isolation is not enforced.** Branches and their administrators are real
  records, but this build holds one school's data, so a branch admin would see the
  whole group. Keeping branches genuinely separate is done in the database with
  row-level security, and needs the server.
- **Staff documents are recorded, not stored.** The system tracks that a B.Ed
  certificate was received and verified; it does not hold the scan. Nine scans per
  applicant will not fit in a browser.
- **Payroll arithmetic is indicative.** The deduction shapes are right — PF at 12%
  of basic against the ₹15,000 ceiling, ESI below ₹21,000, professional tax by slab
  — but a school's own sanctioned scales, registration numbers and challan formats
  are what a real run needs.
- **Single device, one user at a time.** Multi-device and concurrent staff need the
  API.
- Branch separation is enforced by the app's own scoping, not by the database.
  The real product uses row-level security, where a mistake in a query cannot
  leak another school's children.
- Payments are a simulated gateway; Razorpay is the real integration.
- Report-card, receipt and payslip PDF downloads are stubbed.
- The timetable *is* editable, with clash detection, but there is no automatic
  generator: you place periods yourself rather than pressing a button and
  getting a sound week.
