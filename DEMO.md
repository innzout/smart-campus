# College demo — running sheet

A working prototype of **Sri Vidya Arts and Science College (Autonomous)**,
Coimbatore — affiliated to Bharathiar University, NAAC A+.

Five programmes, fourteen cohorts, 468 students across semesters 1 to 5.
Runs entirely in the browser. **No server, no internet, nothing to start but the app.**

> This is the `college` branch. The school version lives on `main`.

## Before you leave for the college

In Windows PowerShell, run each line on its own — PowerShell 5.1 rejects `&&`
as a statement separator.

```powershell
cd smart-campus
npm run seed
npm run build
npm run preview
```

Then open `http://localhost:4173`.

`npm run seed` re-dates the demo to today and then runs 48 data checks — it will
tell you if anything is wrong before a Principal sees it. The app also shifts
every date forward by whole weeks at load time, so even the hosted version stays
current.

If a previous run left changes behind, open **Settings → Reset demo**.

## Sign-ins

| Who | Sign in with | Password |
| --- | --- | --- |
| **Parent** | `parent@college.edu` **or register number `24UCS007`** | `Parent@123` |
| **Student** | `student@college.edu` | `Student@123` |
| Faculty (Computer Science) | `faculty@college.edu` | `Faculty@123` |
| Principal | `principal@college.edu` | `Principal@123` |
| Controller of Examinations | `coe@college.edu` | `Coe@123` |
| Placement Officer | `placement@college.edu` | `Placement@123` |
| Hostel Warden | `warden.men@college.edu` | `Warden@123` |
| Accounts & Payroll | `accounts@college.edu` | `Accounts@123` |
| Chairman / Trust | `admin@college.edu` | `Admin@123` |

The student is **Aishwarya K., III B.Sc. Computer Science, register 24UCS007**.
CGPA 8.71, no arrears, **short of attendance in one paper at 70%**, and holding a
**Zoho offer at ₹7.5 LPA**.

> Show the **register number login** deliberately — it is what a college hands a
> parent, and it is the first thing they will ask about.

## The 7-minute parent run

**1 · Open on a phone first.** Parent login. "Needs attention" names the three
things that matter: short of attendance in one paper, fees outstanding, an
assignment due. Nothing else competes for the eye.

**2 · Attendance.** *This is the screen that makes a college different from a
school.* Attendance is **per paper, per hour** — she is at 100% in four papers
and **70% in Web Technology**. Say the rule plainly: below 75% no hall ticket is
issued for that paper. Between 65% and 75% condonation may be applied for.
**Apply for condonation** from here.

**3 · Results.** CGPA 8.71, rank in cohort, credits earned, **zero arrears**.
Open the transcript: grade, grade points and credits per paper, semester by
semester. *"An arrear is the thing that decides whether a student graduates with
their batch — and whether a recruiter will look at them."*

**4 · Placements.** The Zoho offer, ₹7.5 LPA. Then scroll to the open drives:
each one says whether she may register **and why not** where she cannot. *"The
CGPA and arrear bar is a condition of registering, not a surprise at the
interview."*

**5 · Fees.** Semester tuition, examination fee, scholarship concession where it
applies. Pay one by UPI and show the receipt.

**6 · Hostel and Mentoring.** Room, warden, charges. Then the mentoring record —
every student has a mentor who follows them across all papers and writes after
each meeting. *"No school has this. It is how a college keeps hold of a student."*

## The administration run — what a Principal actually buys

**A · Academic Setup.** Departments → programmes → cohorts. Click a cohort and
see the papers its syllabus prescribes for the semester it has reached, each with
its faculty. Change one — the dropdown only offers staff **qualified to teach it**
(a postgraduate paper needs a doctorate or NET), and the timetable updates with
it. **New cohort** creates its papers and a blank week together.

**B · Timetable → Edit hours.** The week as a grid. Choose what is taught in each
hour; the lecturer follows from Academic Setup. Badges show hours a week against
what the syllabus allots, and a double-booking turns the cell red and names the
clashing cohort.

**C · Attendance (as Controller of Examinations).** The whole college: who is
short, who is **below the 65% floor where nothing can be done**, and the
condonation queue. Grant one — it raises the ₹500 fee and notifies the student.
*"This is what you do before every hall ticket is printed."*

**D · Results (as Controller).** Cohort standing by CGPA with arrears beside it —
the two figures a recruiter screens on. Publish a semester's results and every
student and parent hears at once.

**E · Placements (as Placement Officer).** **Announce a drive**: set the CGPA
bar and the arrear limit, and the dialog tells you **how many students actually
qualify before you announce it**. Only those students are notified. Then open a
drive and move candidates through aptitude → technical → HR → selected.

**F · Hostel (as Warden).** Beds taken against capacity, room by room, and the
request queue. Allot one — rent and ten months of mess charges are billed.

**G · Mentoring (as Faculty).** Mentees sorted worst-attendance first, with
arrears beside. Open one: attendance paper by paper, and the note history. A note
raising a concern notifies the parent.

**H · Payroll, Recruitment, Roles, Laboratories** work as on the school build,
with college designations — Professor, Associate and Assistant Professor, and
NET or a doctorate where the post requires it.

## What to say when asked

**"Does it work without internet?"** This prototype does. The real product syncs
to a server so several lecturers can mark registers at once.

**"Our syllabus is different."** Expected. Papers are data — programme, semester,
credits, internal and external split. **Add a paper** on Academic Setup.

**"We are affiliated, not autonomous."** The grading scale and the internal split
are data, not code. An affiliated college takes the university's scale instead.

**"Can parents see this?"** Yes — the parent login is the same app scoped to one
ward, and the register number is the credential they already have.

## Honest limits — say these before they are found

- **Payroll arithmetic is indicative.** PF at 12% of basic against the ₹15,000
  ceiling, ESI below ₹21,000, professional tax by slab — right shapes, but your
  sanctioned UGC scales and challan formats are what a real run needs.
- **Staff documents are recorded, not stored.** The system tracks that a Ph.D.
  certificate was received and verified; it does not hold the scan.
- **Single device, one user at a time.** Multi-device and concurrent staff need
  the server. Payments are a simulated gateway; Razorpay is the real integration.
- **Hall tickets, mark sheets and payslips are not generated as PDFs.**
- **The timetable is editable with clash detection, but there is no automatic
  generator** — you place the hours yourself.
- **One institution is seeded.** The switcher and the scoping are built, so a
  second college can be opened, but branch isolation is enforced by the app
  rather than by the database. The real product uses row-level security.

## If something goes wrong

Reload — the data persists in IndexedDB. If it looks wrong, **Settings → Reset
demo**. If the laptop has no `npm`, `dist/` is static files; `npx serve dist`
will run it.
