# School demo — running sheet

A working prototype of **Sri Vidya Mandir Matriculation Hr. Sec. School**, Coimbatore —
run by **Sri Vidya Educational Trust**, which has a second branch at Mettupalayam.

Classes **1 to 12**, including Higher Secondary groups, plus a second branch at
Mettupalayam that is a primary school only. Runs entirely in the browser.
**No server, no internet, nothing to start but the app.**

## Before you leave for the school

In Windows PowerShell, run each line on its own — PowerShell 5.1 rejects `&&`
as a statement separator.

```powershell
cd smart-campus
npm run seed
npm run build
npm run preview
```

Then open `http://localhost:4173`.

`npm run seed` re-dates the demo to today and then runs 67 data checks — it will
tell you if anything is wrong before a school sees it. The app also shifts every
date forward by whole weeks at load time, so even the hosted version stays
current; reseeding before a presentation keeps it exact.

If a previous run left changes behind, open **Settings → Reset demo**. Do this
right before you present.

## Sign-ins

| Who | Sign in with | Password |
| --- | --- | --- |
| **Parent** | `parent@school.edu` **or student ID `SVM20261230`** | `Parent@123` |
| Class teacher (8-A) | `teacher@school.edu` | `Teacher@123` |
| Correspondent / Trust | `admin@school.edu` | `Admin@123` |
| Principal | `principal@school.edu` | `Principal@123` |
| Vice Principal | `vp@school.edu` | `Vp@123` |
| Accounts & Payroll | `accounts@school.edu` | `Accounts@123` |
| Librarian | `library@school.edu` | `Library@123` |
| Transport In-charge | `transport@school.edu` | `Transport@123` |
| Student | `student@school.edu` | `Student@123` |
| **Mettupalayam branch** | `hm.mettupalayam@school.edu` | `Branch@123` |

The child is **Vimal A., Class 8-A, roll 10**. His mother is the parent account.

> Show the **student ID login** deliberately — it is how schools actually hand out
> access, and it is the first question a correspondent asks.

> Sign in as **Accounts & Payroll** when someone asks about roles: that one person
> holds *two* roles, which is the honest answer to "our clerk does both jobs".

> The **branch dropdown** at the top of the page only appears for the trust's own
> account. Sign in as the Mettupalayam headmistress to show that a branch admin
> sees her own school and nothing else — which is the question a trust asks.

## The 7-minute parent run

**1 · Open on a phone first.** Parent login. The whole pitch in one screen:
attendance, fees outstanding, homework pending, Quarterly rank — and "Needs your
attention" listing exactly what the parent must act on.

**2 · Fees → Pay.** Pick the overdue item, pay by UPI, show the receipt with its
number and the child's admission number. *"No queue at the office."*

**3 · Attendance.** The day-by-day calendar strip. *"The parent sees the same
register the teacher marked."*

**4 · Report Card.** Quarterly marks, grade, class rank, Tamil subject names.

**5 · PTM & Meetings**, then **School Visits** — the gate pass with its pass number.

**6 · Switch to the class teacher.** Attendance → tap two children absent → Save.
*"Parents of those two are notified before lunch."* Then Homework → set one.

**7 · Switch to the correspondent.** The dashboard: students on roll, fees
collected, overdue. 8-B flagged red for attendance.

**8 · Fees → Student ledger → Collect.** A parent pays cash at the office: pick
the head, take the money, receipt issued, parent notified. *"Your clerk never
writes a manual receipt again."*

## The administration run — what a correspondent actually buys

Sign in as **Correspondent** (`admin@school.edu`). These are the screens that
answer "can it run my school", not just "can parents see marks".

**A · Academic Setup.** Click **1-A**, then **8-A**, then **11-A**.
*"Class 1 studies four subjects. Class 8 studies seven. 11-A studies Tamil,
English and the four subjects its Higher Secondary group dictates."* Then change
a subject teacher from the dropdown — note it only offers staff of the right
cadre (SGT for 1–5, B.T. for 6–10, P.G. for 11–12), and that the timetable
updates with it. Then **New class** → Class 11, Section C, Group 2 — the group's
subjects are created with the class. **Edit class** changes the room, the
sanctioned strength or the class teacher — and refuses a strength below the
number already on roll. **Add subject to catalogue** is for a subject we did not
anticipate: Hindi, French, Yoga. *"You do not wait for us to add it."*

**A2 · Timetable → Edit periods.** Pick a class from the dropdown — every
registered section is there, grouped by stage — then **Edit periods**. The grid is
the week: choose what is taught in each period and the teacher follows from the
assignment you just made. Badges along the top show periods a week against what
each subject is owed, and putting a teacher where they are already booked turns
the cell red and names the clashing class. *"This is the part a correspondent
wants to do once in June and then leave alone."*

**B · Cover & Adjustments.** *"This is your 8:45 every morning."* Two teachers are
on approved leave, so their periods are listed. Each one offers the teachers who
are genuinely free that period, split into those who can teach the subject and
those who can only supervise. Assign one — the covering teacher is notified.

**C · Staff Recruitment.** Open a pending application. Documents are listed with
what is still missing, and **Approve is disabled until the file is complete**.
Approve one — *"that is the moment the staff account exists. Before that, they
cannot sign in at all."*

**D · Laboratories.** Pick **Chemistry** → **Batches**. *"The lab seats 24. Class
11-A has 24 on roll, 12-A has 24 — so where a class is bigger, it splits, and the
practical timetable runs one batch at a time."* **Move pupils** adjusts the split one child at a time, because siblings want the
same day and the round-robin does not know that. Then **Apparatus** and
**Breakages** — recording a breakage reduces stock and charges the parent.

**E · Transport → Requests.** A parent has asked for a seat. The seats taken are
shown against the bus's capacity, so you allot or decline on a real number.
Allotting raises the bus fee. On **Routes**, **Allot a student** does the same
from the counter — which is how most children actually get a seat — and **Edit
route** reorders the stops and their pickup times. Then **Vehicles** — **Bus
TN 38 AX 1207's fitness certificate has expired**. *"You should know that before
the RTO does."*

**F · Roles & Permissions.** *"Accounts Officer and Payroll Officer are the same
person in your school. Here she holds both roles, and her permissions are the
union."* Open a role and untick a permission — the menu entry it unlocks
disappears for everyone holding it.

**G · Payroll.** Pick the current month → **Run payroll**. Then pay **one person**
from their own row — that is the common case, not the exception: somebody joins
mid-month or a transfer bounces. **Pay all** does the rest in one go, and **Undo**
puts a payslip back to draft to be corrected. Open a payslip for the breakdown,
and scroll to **Salary structures** — a new joiner has none until someone sets
one, and is skipped by every run until they do. Say the honest line printed on
the screen: the deduction shapes are right, your sanctioned scales are what a
real run needs.

**H · Branches, and the branch switcher.** The trust, its two schools, and **Open
a branch** — which creates the school and its Correspondent together.

Then use the **dropdown beside the page title** to switch to *Mettupalayam*. The
whole app follows: 5 classes instead of 15, 130 children instead of 436, its own
staff, its own bus, its own circulars and its own fee figures. *"Your Coimbatore
numbers and your Mettupalayam numbers never mix."* Switch back, then sign in as
`hm.mettupalayam@school.edu` to show she has no dropdown at all — she sees her
own school and cannot reach the other.

Read the notice on the Branches screen aloud; see the limits below.

## What to say when asked

**"Does it work without internet?"** This prototype does. The real product syncs
to a server so several teachers can mark registers at once.

**"Can parents get SMS?"** The notification layer is built; SMS and WhatsApp are a
connector away. Not every parent installs an app — that is designed for.

**"Tamil?"** Subject names and circular titles are already bilingual. Full Tamil
UI is a translation pass, not a rebuild.

**"Our report card format is different."** Expected. The grading scale is data,
not code.

**"Our groups are different."** All five Higher Secondary groups are defined; this
school offers Group 1 and Group 4. Adding Group 2, 3 or 5 is opening a class.

**"We have three branches."** Show the switcher and the Mettupalayam login, then
be straight about the limit below: the branches are real and separate in the data,
but this build is not enforcing that separation the way the server will.

**"Can a teacher see the whole school's timetable?"** Yes — the class dropdown on
the Timetable lists every registered section, grouped by stage, with their own
classes first. A parent sees only their child's.

## Honest limits — say these before they are found

These are the four places where the demo is not the product. Saying them first is
what makes the rest credible.

- **Branch separation is enforced in the app, not in a database.** Switching
  branches genuinely re-scopes every screen, and a branch administrator cannot
  reach the other school. But it is the app doing the filtering, so it is only as
  good as the app. The real product does it with row-level security in Postgres,
  where a mistake in a query cannot leak another school's children.
- **Staff documents are recorded, not stored.** The system tracks that a B.Ed
  certificate was received and verified; it does not hold the scan. File storage
  is server work.
- **Payroll arithmetic is indicative.** PF at 12% of basic against the ₹15,000
  ceiling, ESI below ₹21,000, professional tax by slab — right shapes, but your
  sanctioned scales, registration numbers and challan formats are what a real run
  needs.
- **Single device, one user at a time.** Multi-device and concurrent staff need
  the server. Payments are a simulated gateway; Razorpay is the real integration.
  Report card, receipt and payslip PDF downloads are stubbed. The timetable is
  editable with clash detection, but there is no automatic generator — you place
  the periods yourself rather than pressing a button and getting a sound week.

## If something goes wrong

Reload the page — the data persists (in IndexedDB, so the full twelve-grade school
fits). If it looks wrong, **Settings → Reset demo**. If the laptop has no `npm`,
the built `dist/` folder is static files; `npx serve dist` will run it, or use the
hosted Vercel link.
