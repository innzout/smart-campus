# School demo — running sheet

A working prototype of **Sri Vidya Mandir Matriculation Hr. Sec. School**, Coimbatore.
Runs entirely in the browser. **No server, no internet, nothing to start but the app.**

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

`npm run seed` re-dates the demo to today. The app also shifts every date forward
by whole weeks at load time, so even the hosted version stays current — but
reseeding before a presentation keeps it exact.

If a previous run left changes behind, open **Settings → Reset demo** to put
everything back to its starting state. Do this right before you present.

## Sign-ins

| Who | Sign in with | Password |
| --- | --- | --- |
| **Parent** | `parent@school.edu` **or student ID `SVM20261070`** | `Parent@123` |
| Class teacher (8-A) | `teacher@school.edu` | `Teacher@123` |
| Correspondent | `admin@school.edu` | `Admin@123` |
| Student | `student@school.edu` | `Student@123` |

The child is **Vimal A., Class 8-A, roll 10**. His mother is the parent account.

> Show the **student ID login** deliberately — it is how schools actually hand out
> access, and it is the first question a correspondent asks.

## The 7-minute run

**1 · Open on a phone first.** Parent login. This is the whole pitch in one screen:
attendance, fees outstanding, homework pending, Quarterly rank — and "Needs your
attention" listing exactly what the parent must act on.

**2 · Fees → Pay.** Pick the overdue item, pay by UPI, show the receipt with its
number and the child's admission number. *"No queue at the office, and the receipt
is on the phone."*

**3 · Attendance.** The day-by-day calendar strip. *"The parent sees the same
register the teacher marked."*

**4 · Report Card.** Quarterly marks, grade, class rank, subject bars, Tamil subject
names. *"This is what you hand over at the PTM."*

**5 · PTM & Meetings.** Book a slot for Saturday. Then **School Visits** — the gate
pass with its pass number. *"Parents book, the office approves, the gate checks them in."*

**6 · Switch to the class teacher.** Attendance → tap two children absent → Save.
*"Parents of those two are notified before lunch."* Then Homework → set one.

**7 · Switch to the correspondent.** The dashboard: students on roll, fees collected,
overdue, and how many to follow up. 8-B flagged red for attendance. Outstanding by
class shows where to chase. *"This is your Monday morning."*

**8 · Fees → Student ledger → Collect.** A parent pays cash at the office: pick the
head, take the money, receipt issued, parent notified in the app. *"Your clerk
never writes a manual receipt again."* This is the one admin feature a
correspondent will test themselves.

## What to say when asked

**"Does it work without internet?"** This prototype does. The real product syncs to
a server so several teachers can mark registers at once.

**"Can parents get SMS?"** The notification layer is built; SMS and WhatsApp are a
connector away. Not every parent installs an app — that is designed for.

**"Tamil?"** Subject names and circular titles are already bilingual. Full Tamil UI
is a translation pass, not a rebuild.

**"Our report card format is different."** Expected. The grading scale is data, not
code — the board format is the part we fit to your school.

## Honest limits — say these before they are found

- Single school, single device. Multi-school and multi-device need the server.
- Payments are a simulated gateway. Razorpay is the integration for a real one.
- Report card and receipt PDF downloads are stubbed.
- The timetable is fixed; a timetable *builder* with clash detection is not built.

## If something goes wrong

Reload the page — the data persists. If it looks wrong, **Settings → Reset demo**.
If the laptop has no `npm`, the built `dist/` folder is static files; `npx serve dist`
will run it, or use the hosted Vercel link.
