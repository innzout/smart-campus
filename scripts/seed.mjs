/**
 * Seed generator for the school demo database.
 *
 * Models a Tamil Nadu matriculation school: classes and sections, daily
 * attendance, term exams (Quarterly / Half-Yearly / Annual), term fees with
 * bus fees, circulars, and parents as first-class users.
 *
 * Dates are generated relative to today, so the demo is always current.
 * Run with `node scripts/seed.mjs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
mkdirSync(OUT, { recursive: true });

/* Seeded PRNG so every regeneration is identical. */
let seed = 20261009;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const write = (name, data) =>
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data, null, 2) + '\n');

const pad = (n) => String(n).padStart(2, '0');
const TODAY = new Date();
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (days) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return iso(d);
};
const TODAY_ISO = iso(TODAY);

/* TN academic year runs June to April. */
const AY_START_YEAR = TODAY.getMonth() >= 5 ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
const ACADEMIC_YEAR = `${AY_START_YEAR}-${String(AY_START_YEAR + 1).slice(2)}`;
const month = TODAY.getMonth();
const CURRENT_TERM = month >= 5 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : 3;

/* school */

const school = [
  {
    id: 'sch-1',
    name: 'Sri Vidya Mandir Matriculation Higher Secondary School',
    shortName: 'Sri Vidya Mandir',
    tagline: 'அறிவே ஆற்றல்',
    taglineEn: 'Knowledge is power',
    board: 'Tamil Nadu State Board (Matriculation)',
    address: 'Saravanampatti, Coimbatore 641035, Tamil Nadu',
    phone: '+91 422 265 4400',
    email: 'office@srividyamandir.edu.in',
    academicYear: ACADEMIC_YEAR,
    currentTerm: CURRENT_TERM,
    // The date this data was generated. The app shifts every date forward by
    // whole weeks from here, so a deployed demo never goes stale.
    seededOn: TODAY_ISO,
  },
];

/* staff */

const teacherSpec = [
  ['Mrs. S. Revathi', 'Tamil', 'Senior Teacher'],
  ['Mr. K. Senthilkumar', 'Mathematics', 'Senior Teacher'],
  ['Mrs. P. Jayanthi', 'English', 'Senior Teacher'],
  ['Mr. R. Anbarasan', 'Science', 'Senior Teacher'],
  ['Mrs. G. Kalaiselvi', 'Social Science', 'Teacher'],
  ['Mr. M. Dhanasekaran', 'Computer Science', 'Teacher'],
  ['Mrs. V. Umamaheswari', 'Tamil', 'Teacher'],
  ['Mr. S. Prabhakaran', 'Mathematics', 'Teacher'],
  ['Mrs. N. Bhuvaneswari', 'English', 'Teacher'],
  ['Mr. T. Ilangovan', 'Science', 'Physical Education'],
];

const users = [];

users.push({
  id: 'usr-admin',
  name: 'Mr. V. Ramanathan',
  email: 'admin@school.edu',
  password: 'Admin@123',
  role: 'admin',
  employeeId: 'EMP-001',
  designation: 'Correspondent',
  phone: '+91 98430 10001',
  status: 'active',
  joinedOn: `${AY_START_YEAR - 12}-06-01`,
  avatarHue: 258,
});

users.push({
  id: 'usr-principal',
  name: 'Mrs. R. Chitra',
  email: 'principal@school.edu',
  password: 'Principal@123',
  role: 'principal',
  employeeId: 'EMP-002',
  designation: 'Principal',
  phone: '+91 98430 10002',
  status: 'active',
  joinedOn: `${AY_START_YEAR - 8}-06-01`,
  avatarHue: 320,
});

users.push({
  id: 'usr-accounts',
  name: 'Mr. A. Saravanan',
  email: 'accounts@school.edu',
  password: 'Accounts@123',
  role: 'accountant',
  employeeId: 'EMP-003',
  designation: 'Accounts Officer',
  phone: '+91 98430 10003',
  status: 'active',
  joinedOn: `${AY_START_YEAR - 5}-06-01`,
  avatarHue: 150,
});

teacherSpec.forEach(([name, , designation], i) => {
  users.push({
    id: `usr-t${i + 1}`,
    // The first teacher is the demo account.
    email: i === 0 ? 'teacher@school.edu' : `${name.split('. ').at(-1).toLowerCase()}@school.edu`,
    name,
    password: 'Teacher@123',
    role: 'teacher',
    employeeId: `EMP-${pad(10 + i)}`,
    designation,
    phone: `+91 98430 2${pad(i + 10)}0`,
    status: 'active',
    joinedOn: `${AY_START_YEAR - between(1, 9)}-06-01`,
    avatarHue: (i * 53 + 30) % 360,
    subjectIds: [],
  });
});

/* classes */

const classSpec = [
  [6, 'A', 'usr-t7', 'Room 12'],
  [7, 'A', 'usr-t9', 'Room 14'],
  [8, 'A', 'usr-t1', 'Room 21'],
  [8, 'B', 'usr-t5', 'Room 22'],
  [9, 'A', 'usr-t2', 'Room 31'],
  [10, 'A', 'usr-t4', 'Room 33'],
];

const classes = classSpec.map(([grade, section, classTeacherId, room]) => ({
  id: `cls-${grade}${section}`,
  grade,
  section,
  label: `${grade}-${section}`,
  classTeacherId,
  room,
  strength: 30,
}));

/* subjects */

const subjectSpec = [
  ['TAM', 'Tamil', 'தமிழ்', 0],
  ['ENG', 'English', 'ஆங்கிலம்', 2],
  ['MAT', 'Mathematics', 'கணிதம்', 1],
  ['SCI', 'Science', 'அறிவியல்', 3],
  ['SOC', 'Social Science', 'சமூக அறிவியல்', 4],
  ['CSC', 'Computer Science', 'கணினி அறிவியல்', 5],
];

const subjects = [];
for (const { grade } of classes.filter((c) => c.section === 'A')) {
  subjectSpec.forEach(([code, name, nameTa, teacherIdx]) => {
    subjects.push({
      id: `sub-${grade}-${code.toLowerCase()}`,
      code: `${code}${grade}`,
      name,
      nameTa,
      grade,
      teacherId: `usr-t${teacherIdx + 1}`,
      maxMarks: 100,
    });
  });
}
const subjectsForGrade = (grade) => subjects.filter((s) => s.grade === grade);

for (const s of subjects) {
  const t = users.find((u) => u.id === s.teacherId);
  if (t) t.subjectIds.push(s.id);
}

/* students and parents */

const boyNames = ['Aravind', 'Karthik', 'Dinesh', 'Hariharan', 'Kavin', 'Logesh', 'Manikandan', 'Naveen', 'Prakash', 'Ragul', 'Sanjay', 'Tamilselvan', 'Vignesh', 'Yuvaraj', 'Balaji', 'Gokul', 'Mohanraj', 'Surya', 'Vimal', 'Jeyaraman'];
const girlNames = ['Abinaya', 'Bhavani', 'Divya', 'Gayathri', 'Ilakkiya', 'Janani', 'Kavya', 'Lavanya', 'Meena', 'Nandhini', 'Oviya', 'Pavithra', 'Ramya', 'Sandhya', 'Thamarai', 'Vaishnavi', 'Yazhini', 'Keerthana', 'Swetha', 'Aishwarya'];
const surnameInitials = ['R', 'K', 'S', 'M', 'P', 'V', 'G', 'T', 'A', 'N'];
const fatherNames = ['Murugan', 'Rajendran', 'Selvam', 'Kumaresan', 'Palanisamy', 'Ganesan', 'Thangavel', 'Arumugam', 'Natarajan', 'Velmurugan'];
const motherNames = ['Lakshmi', 'Saroja', 'Vasanthi', 'Amudha', 'Kalaivani', 'Rajeswari', 'Shanthi', 'Malathi', 'Devi', 'Pushpa'];
const occupations = ['Farmer', 'Textile business', 'Auto driver', 'Teacher', 'Shop owner', 'Mechanic', 'Nurse', 'Tailor', 'Software engineer', 'Government employee'];
const bloodGroups = ['A+', 'B+', 'O+', 'AB+', 'A-', 'O-'];

const students = [];
const parents = [];
let admissionSeq = 1000;

classes.forEach((cls) => {
  for (let r = 1; r <= cls.strength; r++) {
    const isBoy = (r + cls.grade) % 2 === 0;
    const first = isBoy
      ? boyNames[(r * 3 + cls.grade) % boyNames.length]
      : girlNames[(r * 5 + cls.grade) % girlNames.length];
    const initial = surnameInitials[(r + cls.grade) % surnameInitials.length];
    const sid = `stu-${cls.grade}${cls.section}-${pad(r)}`;
    const pid = `par-${cls.grade}${cls.section}-${pad(r)}`;
    admissionSeq += 1;

    const father = `${initial}. ${fatherNames[(r + cls.grade) % fatherNames.length]}`;
    const mother = `${initial}. ${motherNames[(r * 2 + cls.grade) % motherNames.length]}`;
    // The demo parent is the mother of 8-A roll 10.
    const isDemoStudent = cls.id === 'cls-8A' && r === 10;

    students.push({
      id: sid,
      name: `${first} ${initial}.`,
      email: isDemoStudent ? 'student@school.edu' : `${first.toLowerCase()}.${admissionSeq}@student.school.edu`,
      password: 'Student@123',
      role: 'student',
      admissionNo: `SVM${AY_START_YEAR}${admissionSeq}`,
      rollNo: r,
      classId: cls.id,
      dateOfBirth: `${AY_START_YEAR - cls.grade - 5}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
      bloodGroup: pick(bloodGroups),
      guardianIds: [pid],
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      status: 'active',
      joinedOn: `${AY_START_YEAR - between(0, 4)}-06-05`,
      avatarHue: (r * 37 + cls.grade * 11) % 360,
    });

    parents.push({
      id: pid,
      name: isDemoStudent ? mother : r % 2 === 0 ? father : mother,
      email: isDemoStudent ? 'parent@school.edu' : `parent.${admissionSeq}@gmail.com`,
      password: 'Parent@123',
      role: 'parent',
      childIds: [sid],
      occupation: occupations[(r + cls.grade) % occupations.length],
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      status: 'active',
      joinedOn: `${AY_START_YEAR}-06-05`,
      avatarHue: (r * 29 + 180) % 360,
    });
  }
});

users.push(...students, ...parents);
const DEMO_STUDENT = students.find((s) => s.email === 'student@school.edu');

/* timetable */

const periods = [
  ['09:00', '09:40', 'period'],
  ['09:40', '10:20', 'period'],
  ['10:20', '10:35', 'break'],
  ['10:35', '11:15', 'period'],
  ['11:15', '11:55', 'period'],
  ['11:55', '12:35', 'lunch'],
  ['12:35', '13:15', 'period'],
  ['13:15', '13:55', 'period'],
  ['13:55', '14:35', 'period'],
];

const timetable = [];
let slotSeq = 0;
classes.forEach((cls) => {
  const subs = subjectsForGrade(cls.grade);
  for (let day = 1; day <= 6; day++) {
    periods.forEach(([start, end, kind], pi) => {
      if (day === 6 && pi > 4) return; // half-day Saturday
      const isLesson = kind === 'period';
      timetable.push({
        id: `slot-${++slotSeq}`,
        classId: cls.id,
        day,
        period: pi + 1,
        start,
        end,
        subjectId: isLesson ? subs[(day + pi) % subs.length].id : null,
        title: kind === 'break' ? 'Short Break' : kind === 'lunch' ? 'Lunch Break' : undefined,
        kind,
      });
    });
  }
});

/* school days and daily attendance */

const schoolDays = [];
for (let back = 0; schoolDays.length < 45; back++) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - back);
  if (d.getDay() === 0) continue; // Sunday
  schoolDays.push(iso(d));
}
schoolDays.reverse();

// Each class has its own attendance culture — 8-B is the weak one, 10-A the
// strongest. Without this every class lands on the same percentage.
const CLASS_ABSENCE = { 'cls-6A': 5, 'cls-7A': 7, 'cls-8A': 6, 'cls-8B': 13, 'cls-9A': 9, 'cls-10A': 3 };

const attendance = [];
students.forEach((st, si) => {
  const absenceRate = CLASS_ABSENCE[st.classId] ?? 6;
  // A few children in every class are persistently irregular.
  const irregular = si % 11 === 0 ? 10 : si % 7 === 0 ? 4 : 0;
  schoolDays.forEach((date, di) => {
    const roll = (si * 7 + di * 13 + di * si) % 100;
    let status = 'present';
    if (st.id === DEMO_STUDENT?.id) {
      status =
        di === schoolDays.length - 4 ? 'absent'
        : di === schoolDays.length - 11 ? 'leave'
        : di === schoolDays.length - 2 ? 'late'
        : 'present';
    } else if (roll < absenceRate + irregular) status = 'absent';
    else if (roll < absenceRate + irregular + 3) status = 'late';
    else if (roll === 99) status = 'leave';

    attendance.push({
      id: `att-${st.id}-${date}`,
      studentId: st.id,
      date,
      status,
      reason: status === 'leave' ? pick(['Family function', 'Medical', 'Out of station']) : undefined,
      markedBy: classes.find((c) => c.id === st.classId)?.classTeacherId,
    });
  });
});

/* homework */

const homeworkSpec = [
  ['Tamil', 'திருக்குறள் 10 பாடல்கள் மனப்பாடம்', 'Memorise Thirukkural couplets 101 to 110 and write their meaning in your notebook.'],
  ['Mathematics', 'Exercise 4.2 — Linear Equations', 'Complete sums 1 to 12 from Exercise 4.2. Show every step of the working.'],
  ['Science', 'Diagram: Parts of a Flower', 'Draw and label the parts of a flower on an unruled sheet. Bring it to the lab session.'],
  ['English', 'Letter to the Headmaster', 'Write a formal letter requesting leave for two days. Minimum 120 words.'],
  ['Social Science', 'Map work — Rivers of Tamil Nadu', 'Mark the Cauvery, Vaigai, Thamirabarani and Palar on the outline map provided.'],
  ['Computer Science', 'HTML practice', 'Create a simple web page about your favourite festival using headings, lists and an image.'],
];

const homework = [];
const homeworkStatus = [];
let hwSeq = 0;

classes.forEach((cls) => {
  const subs = subjectsForGrade(cls.grade);
  homeworkSpec.forEach(([subjectName, title, description], i) => {
    const subject = subs.find((s) => s.name === subjectName);
    if (!subject) return;
    const dueOffset = i - 2;
    const hw = {
      id: `hw-${++hwSeq}`,
      classId: cls.id,
      subjectId: subject.id,
      title,
      description,
      assignedOn: shift(dueOffset - 3),
      dueOn: shift(dueOffset),
      assignedById: subject.teacherId,
    };
    homework.push(hw);

    students
      .filter((s) => s.classId === cls.id)
      .forEach((s, si) => {
        const overdue = hw.dueOn < TODAY_ISO;
        const done = overdue ? (si + i) % 8 !== 0 : (si + i) % 3 === 0;
        homeworkStatus.push({
          id: `hws-${hw.id}-${s.id}`,
          homeworkId: hw.id,
          studentId: s.id,
          done,
          submittedOn: done ? hw.dueOn : null,
          remark: done && overdue ? pick(['Good', 'Well done', 'Neat work', '']) : '',
        });
      });
  });
});

/* exams and marks */

const examSpec = [
  ['Unit Test 1', 'UT1', 1, -120],
  ['Quarterly Examination', 'Quarterly', 1, -40],
  ['Half-Yearly Examination', 'Half-Yearly', 2, 55],
  ['Annual Examination', 'Annual', 3, 180],
];

const exams = [];
classes
  .filter((c) => c.section === 'A')
  .forEach((cls) => {
    examSpec.forEach(([name, shortName, term, offset]) => {
      exams.push({
        id: `exm-${cls.grade}-${shortName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name,
        shortName,
        term,
        grade: cls.grade,
        startsOn: shift(offset),
        endsOn: shift(offset + 6),
        published: offset < 0,
      });
    });
  });

const marks = [];
students.forEach((st, si) => {
  const grade = classes.find((c) => c.id === st.classId).grade;
  const subs = subjectsForGrade(grade);
  exams
    .filter((e) => e.grade === grade && e.published)
    .forEach((exam) => {
      subs.forEach((sub, bi) => {
        const base = 45 + ((si * 7 + bi * 17 + exam.shortName.length * 5) % 50);
        const bump = exam.shortName === 'Quarterly' ? 4 : 0;
        marks.push({
          id: `mk-${st.id}-${exam.id}-${sub.id}`,
          studentId: st.id,
          examId: exam.id,
          subjectId: sub.id,
          marks: Math.min(100, base + bump),
          maxMarks: 100,
        });
      });
    });
});

/* transport */

const routes = [
  ['Route 1 — Gandhipuram', 'TN 38 AX 1204', 'R. Murugesan', '+91 99445 21001', ['Gandhipuram Bus Stand', 'Cross Cut Road', 'Sivananda Colony', 'Thudiyalur Road'], 9000],
  ['Route 2 — Peelamedu', 'TN 38 AX 1205', 'K. Chinnasamy', '+91 99445 21002', ['Peelamedu Signal', 'Hope College', 'Nehru Stadium', 'Avinashi Road'], 9000],
  ['Route 3 — Saravanampatti', 'TN 38 AX 1206', 'S. Velmurugan', '+91 99445 21003', ['Saravanampatti Junction', 'Kalapatti Road', 'KCT Gate', 'Vilankurichi'], 7500],
  ['Route 4 — R.S. Puram', 'TN 38 AX 1207', 'M. Palanivel', '+91 99445 21004', ['R.S. Puram West', 'DB Road', 'Race Course', 'Puliakulam'], 10500],
].map(([name, busNo, driverName, driverPhone, stopNames, fee], i) => ({
  id: `rt-${i + 1}`,
  name,
  busNo,
  driverName,
  driverPhone,
  fee,
  stops: stopNames.map((s, si) => ({
    name: s,
    time: `0${7 + Math.floor((si * 12) / 60)}:${pad((si * 12) % 60)}`,
  })),
}));

const studentTransport = [];
students.forEach((st, i) => {
  // The demo child always rides, so the parent demo has a bus to show. Route 3
  // is the one the timing-change circular is about.
  const isDemo = st.email === 'student@school.edu';
  if (i % 3 === 0 && !isDemo) return;
  const route = isDemo ? routes[2] : routes[i % routes.length];
  studentTransport.push({
    id: `stt-${st.id}`,
    studentId: st.id,
    routeId: route.id,
    stop: isDemo ? route.stops[1].name : route.stops[i % route.stops.length].name,
  });
});
const usesBus = new Set(studentTransport.map((t) => t.studentId));

/* fees */

/** Tuition rises with the class, as it does in a real school. */
const tuitionForGrade = (grade) => 4500 + (grade - 6) * 750;
const booksForGrade = (grade) => 3500 + (grade - 6) * 350;

const fees = [];
const payments = [];
let receiptSeq = 100;

/** Some classes carry more fee pressure than others. */
const CLASS_PRESSURE = { 'cls-6A': 0, 'cls-7A': 1, 'cls-8A': 0, 'cls-8B': 2, 'cls-9A': 1, 'cls-10A': 0 };

students.forEach((st, si) => {
  const grade = classes.find((c) => c.id === st.classId).grade;
  const tuition = tuitionForGrade(grade);
  const heads = [
    ['Tuition Fee — Term 1', 1, tuition, -75],
    ['Tuition Fee — Term 2', 2, tuition, 12],
    ['Tuition Fee — Term 3', 3, tuition, 110],
    ['Books & Uniform', 0, booksForGrade(grade), -85],
    ['Examination Fee', 2, 600, 20],
  ];
  if (usesBus.has(st.id)) {
    const link = studentTransport.find((t) => t.studentId === st.id);
    const route = routes.find((r) => r.id === link.routeId);
    heads.push(['Bus Fee — Term 1', 1, Math.round(route.fee / 3), -75]);
    heads.push(['Bus Fee — Term 2', 2, Math.round(route.fee / 3), 12]);
  }

  heads.forEach(([head, term, total, dueOffset], hi) => {
    const dueOn = shift(dueOffset);
    const past = dueOffset < 0;
    // 0 = always pays on time, 3 = struggles. Stable per family.
    const pressure = CLASS_PRESSURE[st.classId] ?? 0;
    const score = ((si * 13) % 10) + pressure;
    const reliability = score < 5 ? 0 : score < 8 ? 1 : score < 10 ? 2 : 3;
    const state = past
      ? reliability === 0 ? 'paid'
        : reliability === 1 ? ((si + hi) % 5 === 0 ? 'partial' : 'paid')
        : reliability === 2 ? ((si + hi) % 2 === 0 ? 'partial' : 'paid')
        : ((si + hi) % 3 === 0 ? 'due' : 'partial')
      : reliability === 0 ? ((si + hi) % 2 === 0 ? 'paid' : 'due')
        : reliability === 1 ? ((si + hi) % 4 === 0 ? 'paid' : 'due')
        : 'due';
    const partialShare = reliability >= 2 ? 0.3 : 0.6;
    const paid = state === 'paid' ? total : state === 'partial' ? Math.round((total * partialShare) / 100) * 100 : 0;
    const id = `fee-${st.id}-${hi}`;
    fees.push({ id, studentId: st.id, head, term, total, paid, dueOn });

    if (paid > 0) {
      receiptSeq += 1;
      payments.push({
        id: `pay-${st.id}-${hi}`,
        studentId: st.id,
        feeId: id,
        amount: paid,
        method: pick(['upi', 'cash', 'netbanking', 'card']),
        paidOn: shift(dueOffset - between(1, 10)),
        reference: `TXN${AY_START_YEAR}${between(100000, 999999)}`,
        receiptNo: `RCP/${AY_START_YEAR}/${receiptSeq}`,
      });
    }
  });
});

/* circulars */

const circulars = [
  ['Parent–Teacher Meeting — Saturday', 'பெற்றோர்–ஆசிரியர் சந்திப்பு', 'PTM', 'The Parent–Teacher Meeting for classes 6 to 10 will be held this Saturday from 9:30 AM to 12:30 PM in the respective classrooms. Quarterly report cards will be handed over in person. Parents are requested to attend without fail.', true, 2],
  ['Quarterly Examination results published', 'காலாண்டுத் தேர்வு முடிவுகள்', 'Exam', 'Quarterly Examination results are now available in the app under Report Card. Subject teachers will discuss individual performance during the PTM. Re-evaluation requests close within seven days.', true, 4],
  ['Deepavali holidays', 'தீபாவளி விடுமுறை', 'Holiday', 'The school will remain closed for Deepavali. Classes resume as usual the following working day. School buses will not operate during the holidays.', false, 6],
  ['Term 2 fee due date', 'கட்டணம் செலுத்தும் நாள்', 'Fee', 'Term 2 tuition and bus fees are due shortly. Payment can be made online through the app or at the school office between 9:00 AM and 3:00 PM on working days. Kindly collect your receipt.', true, 8],
  ['Annual Day — date announced', 'ஆண்டு விழா', 'Event', 'Our Annual Day will be celebrated in the school auditorium. Students selected for cultural programmes will have practice after school hours. Parents will receive a separate invitation.', false, 12],
  ['Bus Route 3 timing change', 'பேருந்து நேர மாற்றம்', 'Transport', 'From Monday, Route 3 (Saravanampatti) will reach the Kalapatti Road stop ten minutes earlier. Parents are requested to send children to the stop accordingly.', false, 15],
].map(([title, titleTa, category, body, pinned, daysAgo], i) => ({
  id: `cir-${i + 1}`,
  title,
  titleTa,
  body,
  category,
  postedOn: shift(-daysAgo),
  author: i % 2 === 0 ? 'Principal’s Office' : 'School Office',
  pinned,
  audience: 'all',
  acknowledgedBy: parents.filter((_, pi) => (pi + i) % 4 === 0).map((p) => p.id),
}));

/* events */

const events = [
  ['Parent–Teacher Meeting', 'PTM', 'Class-wise meetings with subject teachers. Quarterly report cards are handed over in person.', 3, '09:30', 'Respective classrooms', 'School Office'],
  ['Deepavali Celebration', 'Cultural', 'Cultural programmes by students, followed by sweets distribution. Students may wear traditional dress.', 5, '10:00', 'School Assembly Ground', 'Cultural Committee'],
  ['Inter-House Sports Meet', 'Sports', 'Track and field events for classes 6 to 10. Parents are welcome to attend and cheer.', 18, '08:00', 'School Playground', 'Physical Education Dept'],
  ['Science Exhibition', 'Academic', 'Students present working models and charts. Judged by teachers from neighbouring schools.', 26, '09:30', 'School Auditorium', 'Science Department'],
  ['Annual Day', 'Cultural', 'The school’s flagship celebration — dance, drama, prize distribution and the Chief Guest’s address.', 40, '17:00', 'School Auditorium', 'Cultural Committee'],
].map(([title, category, description, daysAhead, time, venue, organiser], i) => ({
  id: `evt-${i + 1}`,
  title,
  description,
  category,
  date: shift(daysAhead),
  time,
  venue,
  organiser,
  forClasses: 'all',
}));

/* help desk */

const demoParent = parents.find((p) => p.email === 'parent@school.edu');

const requests = [
  ['Leave for two days — family function', 'Leave', 'in-progress', 'Requesting leave on Thursday and Friday for a family wedding in Madurai. Kindly permit.', demoParent?.id, DEMO_STUDENT?.id, 3],
  ['Bonafide certificate required', 'Certificate', 'resolved', 'Bonafide certificate needed for a bank scholarship application. Kindly issue at the earliest.', demoParent?.id, DEMO_STUDENT?.id, 12],
  ['Request to change bus stop', 'Transport', 'open', 'We have shifted house to Vilankurichi. Requesting a change of boarding point on Route 3.', parents[4]?.id, students[4]?.id, 2],
  ['Fan not working in Room 21', 'Facility', 'in-progress', 'The ceiling fan near the last bench has not been working for a week. Children are finding it difficult in the afternoon.', 'usr-t1', undefined, 5],
].map(([title, category, status, description, raisedBy, aboutStudentId, daysAgo], i) => ({
  id: `req-${i + 1}`,
  ref: `REQ/${AY_START_YEAR}/${pad(101 + i)}`,
  raisedBy,
  aboutStudentId,
  title,
  category,
  description,
  status,
  createdOn: shift(-daysAgo),
  updates:
    status === 'resolved'
      ? [
          { on: shift(-daysAgo + 1), note: 'Received at the school office.' },
          { on: shift(-daysAgo + 2), note: 'Certificate issued. Please collect from the office.' },
        ]
      : status === 'in-progress'
        ? [{ on: shift(-daysAgo + 1), note: 'Acknowledged by the school office.' }]
        : [],
}));

/* library */

const books = [
  ['Ponniyin Selvan (Part 1)', 'Kalki Krishnamurthy', 'Tamil Literature', 5, 'A-01', [8, 9, 10]],
  ['Thirukkural with Explanation', 'Thiruvalluvar', 'Tamil Literature', 8, 'A-02', [6, 7, 8, 9, 10]],
  ['Wings of Fire', 'A.P.J. Abdul Kalam', 'Biography', 6, 'B-03', [8, 9, 10]],
  ['The Jungle Book', 'Rudyard Kipling', 'Fiction', 4, 'C-01', [6, 7]],
  ['Malgudi Days', 'R.K. Narayan', 'Fiction', 5, 'C-02', [7, 8, 9]],
  ['Tell Me Why — Science', 'Arvind Gupta', 'Science', 7, 'D-01', [6, 7, 8]],
  ['Atlas of India', 'Oxford', 'Reference', 3, 'D-04', [6, 7, 8, 9, 10]],
  ['Mathematics Olympiad Workbook', 'RMO Trust', 'Mathematics', 4, 'E-02', [9, 10]],
].map(([title, author, category, copies, shelf, forGrades], i) => ({
  id: `bok-${i + 1}`,
  title,
  author,
  category,
  copies,
  shelf,
  forGrades,
}));

const loans = [];
students.forEach((st, i) => {
  if (i % 5 !== 0) return;
  const book = books[i % books.length];
  const borrowedDaysAgo = between(3, 20);
  const borrowedOn = shift(-borrowedDaysAgo);
  const dueOn = shift(-borrowedDaysAgo + 14);
  const returned = i % 15 === 0;
  const overdueDays =
    !returned && dueOn < TODAY_ISO
      ? Math.round((Date.parse(TODAY_ISO) - Date.parse(dueOn)) / 86400000)
      : 0;
  loans.push({
    id: `lon-${st.id}`,
    bookId: book.id,
    studentId: st.id,
    borrowedOn,
    dueOn,
    returnedOn: returned ? shift(-1) : null,
    fine: overdueDays > 0 ? overdueDays * 2 : 0,
  });
});

/* notifications */

const notifications = [];
let nSeq = 0;
const notify = (userId, title, body, kind, daysAgo, link, read = false) =>
  notifications.push({
    id: `ntf-${++nSeq}`,
    userId,
    title,
    body,
    kind,
    createdOn: shift(-daysAgo),
    read,
    link,
  });

if (demoParent && DEMO_STUDENT) {
  const firstName = DEMO_STUDENT.name.split(' ')[0];
  notify(demoParent.id, `${firstName} was marked absent`, 'Your child was not present at morning attendance. If this is unexpected, please contact the class teacher.', 'attendance', 4, '/attendance');
  notify(demoParent.id, 'Term 2 fees are due', 'Tuition and bus fees for Term 2 are due shortly. You can pay online from the Fees page.', 'fee', 1, '/fees');
  notify(demoParent.id, 'Quarterly report card published', 'The Quarterly Examination report card is now available to view and download.', 'result', 4, '/results', true);
  notify(demoParent.id, 'Parent–Teacher Meeting this Saturday', 'Class 8-A meets at 9:30 AM in Room 21. Report cards will be handed over in person.', 'event', 2, '/circulars');
  notify(demoParent.id, 'Bus Route 3 timing changed', 'The Kalapatti Road stop will now be reached ten minutes earlier from Monday.', 'transport', 15, '/transport', true);
  notify(demoParent.id, 'New homework in Mathematics', 'Exercise 4.2 — Linear Equations, due in two days.', 'homework', 0, '/homework');
}
notify('all', 'Deepavali holidays announced', 'The school will remain closed for Deepavali. Buses will not operate.', 'system', 6, '/circulars', true);


/* parent-teacher meetings */

// The PTM in three days — the one the circular announces.
const ptmDate = shift(3);
const slotTimes = [
  ['09:30', '09:45'], ['09:45', '10:00'], ['10:00', '10:15'], ['10:15', '10:30'],
  ['10:45', '11:00'], ['11:00', '11:15'], ['11:15', '11:30'], ['11:30', '11:45'],
  ['12:00', '12:15'], ['12:15', '12:30'],
];

const meetingSlots = [];
classes.forEach((cls) => {
  slotTimes.forEach(([start, end], i) => {
    meetingSlots.push({
      id: `ms-${cls.id}-${i + 1}`,
      date: ptmDate,
      start,
      end,
      teacherId: cls.classTeacherId,
      classId: cls.id,
      capacity: 3,
    });
  });
});

const meetingBookings = [];
students.forEach((st, i) => {
  // Roughly a third of parents have already booked.
  if (i % 3 !== 0) return;
  const slots = meetingSlots.filter((m) => m.classId === st.classId);
  const slot = slots[i % slots.length];
  meetingBookings.push({
    id: `mb-${st.id}`,
    slotId: slot.id,
    parentId: st.guardianIds[0],
    studentId: st.id,
    bookedOn: shift(-between(1, 6)),
    status: 'booked',
    note: pick(['Would like to discuss Mathematics.', 'About attendance.', '', 'Please advise on study habits.']),
    teacherNote: '',
  });
});

/* gate visits */

const visitPurposes = ['Parent-Teacher Meeting', 'Meet a teacher', 'Fee payment', 'Collect child', 'Document collection'];
const visits = [];
let passSeq = 500;

students.forEach((st, i) => {
  if (i % 7 !== 0) return;
  passSeq += 1;
  const daysAgo = between(-6, 20);
  const past = daysAgo > 0;
  const guardian = users.find((u) => u.id === st.guardianIds[0]);
  const teacher = users.find((u) => u.id === classes.find((c) => c.id === st.classId).classTeacherId);
  visits.push({
    id: `vis-${st.id}`,
    passNo: `VP/${AY_START_YEAR}/${passSeq}`,
    parentId: st.guardianIds[0],
    studentId: st.id,
    visitorName: guardian ? guardian.name : 'Parent',
    purpose: visitPurposes[i % visitPurposes.length],
    date: shift(-daysAgo),
    time: pick(['09:30', '10:00', '11:00', '14:00', '15:00']),
    meetingWith: teacher ? teacher.name : '',
    status: past ? 'completed' : i % 14 === 0 ? 'requested' : 'approved',
    inTime: past ? '09:34' : undefined,
    outTime: past ? '10:05' : undefined,
    note: '',
  });
});

// The demo parent has a visit coming up and one already made.
if (demoParent && DEMO_STUDENT) {
  passSeq += 1;
  visits.unshift({
    id: 'vis-demo-upcoming',
    passNo: `VP/${AY_START_YEAR}/${passSeq}`,
    parentId: demoParent.id,
    studentId: DEMO_STUDENT.id,
    visitorName: demoParent.name,
    purpose: 'Parent-Teacher Meeting',
    date: ptmDate,
    time: '10:00',
    meetingWith: 'Mrs. S. Revathi',
    status: 'approved',
    note: 'Quarterly report card discussion.',
  });
  passSeq += 1;
  visits.push({
    id: 'vis-demo-past',
    passNo: `VP/${AY_START_YEAR}/${passSeq}`,
    parentId: demoParent.id,
    studentId: DEMO_STUDENT.id,
    visitorName: demoParent.name,
    purpose: 'Fee payment',
    date: shift(-22),
    time: '11:00',
    meetingWith: 'Mr. A. Saravanan',
    status: 'completed',
    inTime: '11:02',
    outTime: '11:20',
    note: '',
  });
}

// The demo parent books a PTM slot so the booking flow has history.
if (demoParent && DEMO_STUDENT && !meetingBookings.some((b) => b.studentId === DEMO_STUDENT.id)) {
  const slot = meetingSlots.find((m) => m.classId === DEMO_STUDENT.classId && m.start === '10:00');
  if (slot) {
    meetingBookings.push({
      id: `mb-${DEMO_STUDENT.id}`,
      slotId: slot.id,
      parentId: demoParent.id,
      studentId: DEMO_STUDENT.id,
      bookedOn: shift(-2),
      status: 'booked',
      note: 'Would like to discuss the Quarterly results.',
      teacherNote: '',
    });
  }
}

/* school map */

const places = [
  ['Main Block', 'academic', 32, 28, 32, 22, '08:30 – 16:30', 'Classrooms for 6 to 10, staff room and the Principal’s office.'],
  ['Science Laboratory', 'academic', 70, 18, 22, 16, '09:00 – 16:00', 'Physics, Chemistry and Biology lab with 40 work stations.'],
  ['Computer Lab', 'academic', 70, 42, 22, 14, '09:00 – 16:00', '30 systems with broadband, used from Class 6 upward.'],
  ['Library', 'academic', 6, 20, 20, 16, '09:00 – 16:00', 'Over 6,000 Tamil and English titles, with a quiet reading area.'],
  ['School Office', 'admin', 6, 44, 20, 14, '09:00 – 15:30', 'Admissions, fee counter and certificate requests.'],
  ['Assembly Ground', 'sports', 30, 58, 34, 18, '08:15 onwards', 'Morning assembly, Annual Day and the sports meet.'],
  ['Canteen', 'amenity', 6, 64, 18, 14, '10:00 – 15:00', 'Mid-day meal counter and a snacks stall.'],
  ['Bus Bay', 'amenity', 70, 62, 24, 14, '07:30 & 15:30', 'Four school buses; children board here under staff supervision.'],
].map(([name, kind, x, y, w, h, open, detail], i) => ({
  id: `plc-${i + 1}`,
  name,
  kind,
  x,
  y,
  w,
  h,
  open,
  detail,
}));

/* emit */

const db = {
  school, classes, subjects, users, attendance, timetable,
  homework, homeworkStatus, exams, marks, fees, payments,
  circulars, events, requests, routes, studentTransport,
  books, loans, notifications, places,
  meetingSlots, meetingBookings, visits,
};

for (const [name, rows] of Object.entries(db)) write(name, rows);

console.log(`Seeded ${ACADEMIC_YEAR}, term ${CURRENT_TERM}, ${schoolDays.length} school days\n`);
let total = 0;
for (const [k, v] of Object.entries(db)) {
  total += v.length;
  console.log(`  ${k.padEnd(18)} ${String(v.length).padStart(6)}`);
}
console.log(`  ${'TOTAL'.padEnd(18)} ${String(total).padStart(6)} rows`);
console.log(`\nDemo child: ${DEMO_STUDENT?.name} (8-A, roll ${DEMO_STUDENT?.rollNo})`);
