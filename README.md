# Smart Campus — college demo

A working prototype of a college ERP for Indian arts and science colleges,
modelled on a Tamil Nadu autonomous college affiliated to Bharathiar University.
Built by [Innzout](https://innzout.com).

> **This is the `college` branch.** The school version — classes 1 to 12, Higher
> Secondary groups, two branches — lives on `main`. The two share a lineage and a
> component library; a UI fix cherry-picks between them.

**It runs entirely in the browser.** No backend, no database server, no internet —
so a demo can never be derailed by something that failed to start.

```bash
npm install
npm run seed      # re-dates the demo to today, then checks it
npm run dev       # http://localhost:5173
```

On Windows PowerShell, run each command on its own line — `&&` is not a valid
separator in PowerShell 5.1.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run seed` | Regenerate the demo data relative to today, then check it |
| `npm run check-data` | 48 sanity checks over the generated JSON |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the production build |

See **[DEMO.md](DEMO.md)** for the presentation running order and sign-ins.

## What makes this a college and not a school

The model had to change, not just the vocabulary. Four things drive everything
else:

**Attendance is per course-hour, not per day.** A student can be at 100% in four
papers and 70% in the fifth, and the hall ticket is issued paper by paper. Below
75% they are barred from that paper's examination; between 65% and 75% they may
apply for condonation; below 65% nothing can be done. Rolling it into one
percentage would hide the only number that decides anything.

**Assessment produces a GPA and a CGPA, not a percentage.** Papers carry credits,
are marked 25 internal plus 75 external (40/60 for a practical), and earn grade
points on a ten-point scale. A GPA counts the credits attempted; a failed paper
scores zero until it is cleared.

**An arrear is a standing fact, not a bad mark.** It is carried from the semester
it was earned until it is cleared, it decides whether a student graduates with
their batch, and it is what most recruiters screen on first.

**Students choose electives.** Two students in the same cohort do not necessarily
sit the same papers, so enrolment is per offering rather than per cohort.

## What it covers

Nineteen roles across twenty-six pages.

### The student and the parent

Attendance paper by paper with the condonation route, the transcript with GPA,
CGPA, credits and arrears, assignments carrying internal marks, semester fees with
scholarship concessions, placements with the eligibility reason spelled out,
hostel room and warden, the mentoring record, timetable, circulars, PTM booking,
gate pass, bus route and library.

Parents sign in with the **register number**, which is the credential a college
has already given them.

### Running the college

**Academic setup** — departments, programmes, cohorts and the syllabus. A paper
belongs to a programme and a semester; an offering is that paper handed to a named
member of staff. Postgraduate teaching is restricted to staff with a doctorate or
NET, which is a university condition rather than a preference.

**Timetable** — an hour-wise editor with clash detection, built against one shared
busy map so no lecturer is ever in two rooms at once.

**Examination cell** — cohort standing by CGPA and arrears, condonation decisions,
and publishing a semester's results.

**Placements** — recruiters, drives, and eligibility as a condition of registering.
Announcing a drive tells you how many students qualify *before* you announce it,
and only those students are notified.

**Hostel** — blocks, rooms priced by how many share them, allotment against real
bed counts, and the charge raised when a place is granted.

**Mentoring** — every student has a mentor who sees them whole: attendance across
all papers, arrears, and what was said at the last meeting. A note raising a
concern notifies the parent.

Plus staff recruitment with documents and approval, cover and adjustments,
laboratories with practical batches, payroll, roles and permissions, fee
collection at the counter, transport with vehicle compliance, and the library.

## Data

`scripts/seed.mjs` generates ~43,600 rows into `src/data/*.json`: one college, five
departments, five programmes, fourteen cohorts from semester 1 to 5, 468 students
with linked parent accounts, 34 teaching and office staff, 158 papers of real
syllabus, twelve working days of per-hour attendance, internal assessment,
completed-semester results with arrears, fees with scholarships, six recruiters
and their drives, two hostel blocks, four buses and a library.

`scripts/check-data.mjs` then runs 48 checks. These exist because the failures
that matter in a demo are not type errors — they are a screen that renders
correctly and says something false. Among them: no application may breach its
recruiter's own CGPA and arrear bar, no lecturer is booked into two cohorts at
once, a cohort's papers must be the ones its syllabus prescribes for its semester,
a resident does not also take the bus, and the demo student must be short in
exactly one paper *within the band where condonation is possible*.

Dates are generated relative to the day the seed runs, and the app then **shifts
every date forward by whole weeks at load time**. Whole weeks, so each record keeps
its weekday and an hour of attendance never lands on a Sunday. A deployed demo
stays current for months without redeploying.

Everything changed during a demo is written to **IndexedDB** and persists. The
college serialises to about 6 MB, past the 5 MB `localStorage` quota once counted
as UTF-16. **Settings → Reset demo** restores the starting state.

## Stack

React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · React Router 7 ·
Recharts 3 · Motion 13 · React Hook Form + Zod · Lucide · Sonner

Charts use a palette validated for colour-blind separation, carry a table view,
and never signal status by colour alone.

## Limits, stated plainly

- **Payroll arithmetic is indicative.** The deduction shapes are right — PF at 12%
  of basic against the ₹15,000 ceiling, ESI below ₹21,000, professional tax by slab
  — but a college's own sanctioned UGC scales and challan formats are what a filed
  return needs.
- **Staff documents are recorded, not stored.** The system tracks that a
  certificate was received and verified; it does not hold the scan.
- **Single device, one user at a time.** Multi-device and concurrent staff need the
  API. Payments are a simulated gateway; Razorpay is the real integration.
- Hall tickets, mark sheets, receipts and payslips are not generated as PDFs.
- The timetable is editable with clash detection, but there is no automatic
  generator.
- One institution is seeded. The switcher and the scoping are built, but isolation
  is enforced by the app rather than by the database; the real product uses
  row-level security in Postgres.
