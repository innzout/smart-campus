/**
 * Seed generator for the school demo database.
 *
 * Models a Tamil Nadu matriculation higher secondary school run by a trust:
 * classes 1 to 12 across four stages, Higher Secondary subject groups,
 * laboratories with practical batches, staff recruitment with documents,
 * daily attendance, term exams, fees, transport with vehicle compliance,
 * and a simulated payroll.
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
let seed = 20261011;
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

/* ── the trust and its branches ──────────────────────────────────────── */

const group = [
  {
    id: 'grp-1',
    name: 'Sri Vidya Educational Trust',
    trustName: 'Sri Vidya Educational and Charitable Trust',
    registrationNo: `TN/CBE/TRUST/${AY_START_YEAR - 24}/318`,
    chairman: 'Mr. V. Ramanathan',
    address: 'Saravanampatti, Coimbatore 641035, Tamil Nadu',
    phone: '+91 422 265 4400',
    email: 'trust@srividya.edu.in',
  },
];

const schools = [
  {
    id: 'sch-1',
    groupId: 'grp-1',
    name: 'Sri Vidya Mandir Matriculation Higher Secondary School',
    shortName: 'Sri Vidya Mandir',
    code: '33124508',
    board: 'Tamil Nadu State Board (Matriculation)',
    tagline: 'அறிவே ஆற்றல்',
    taglineEn: 'Knowledge is power',
    address: 'Saravanampatti Main Road',
    city: 'Coimbatore',
    phone: '+91 422 265 4400',
    email: 'office@srividyamandir.edu.in',
    academicYear: ACADEMIC_YEAR,
    currentTerm: CURRENT_TERM,
    isMain: true,
    // The date this data was generated. The app shifts every date forward by
    // whole weeks from here, so a deployed demo never goes stale.
    seededOn: TODAY_ISO,
  },
  {
    id: 'sch-2',
    groupId: 'grp-1',
    name: 'Sri Vidya Mandir Matriculation School, Mettupalayam',
    shortName: 'Sri Vidya Mandir — Mettupalayam',
    code: '33124921',
    board: 'Tamil Nadu State Board (Matriculation)',
    tagline: 'அறிவே ஆற்றல்',
    taglineEn: 'Knowledge is power',
    address: 'Annur Road',
    city: 'Mettupalayam',
    phone: '+91 4254 222 118',
    email: 'mettupalayam@srividyamandir.edu.in',
    academicYear: ACADEMIC_YEAR,
    currentTerm: CURRENT_TERM,
    isMain: false,
    seededOn: TODAY_ISO,
  },
];

const SCHOOL_ID = 'sch-1';

/* ── Higher Secondary groups ─────────────────────────────────────────── */

const hscGroups = [
  ['G1', 'Group 1 — Maths & Biology', 'Keeps both engineering and medicine open.', ['sub-mat3', 'sub-phy', 'sub-che', 'sub-bio']],
  ['G2', 'Group 2 — Maths & Computer Science', 'Engineering and computing.', ['sub-mat3', 'sub-phy', 'sub-che', 'sub-cshs']],
  ['G3', 'Group 3 — Pure Biology', 'Botany and Zoology taken as separate subjects.', ['sub-phy', 'sub-che', 'sub-bot', 'sub-zoo']],
  ['G4', 'Group 4 — Commerce', 'Accountancy, Commerce, Economics and Business Maths.', ['sub-acc', 'sub-com', 'sub-eco', 'sub-bma']],
  ['G5', 'Group 5 — Arts', 'History, Economics, Commerce and Political Science.', ['sub-his', 'sub-eco', 'sub-com', 'sub-pol']],
].map(([code, name, description, subjectIds]) => ({
  id: `hsc-${code.toLowerCase()}`,
  code,
  name,
  description,
  subjectIds,
}));

/* ── subject templates ───────────────────────────────────────────────── */

const PRIMARY = [1, 2, 3, 4, 5];
const MIDDLE = [6, 7, 8];
const SECONDARY = [9, 10];
const HSC = [11, 12];

const subjectSpec = [
  ['tam1', 'TAM-P', 'Tamil', 'தமிழ்', 'language', PRIMARY, null],
  ['eng1', 'ENG-P', 'English', 'ஆங்கிலம்', 'language', PRIMARY, null],
  ['mat1', 'MAT-P', 'Mathematics', 'கணிதம்', 'core', PRIMARY, null],
  ['evs', 'EVS', 'Environmental Science', 'சுற்றுச்சூழல் அறிவியல்', 'core', PRIMARY, null],

  ['tam2', 'TAM-M', 'Tamil', 'தமிழ்', 'language', [...MIDDLE, ...SECONDARY], null],
  ['eng2', 'ENG-M', 'English', 'ஆங்கிலம்', 'language', [...MIDDLE, ...SECONDARY], null],
  ['mat2', 'MAT-M', 'Mathematics', 'கணிதம்', 'core', [...MIDDLE, ...SECONDARY], null],
  ['sci', 'SCI', 'Science', 'அறிவியல்', 'core', [...MIDDLE, ...SECONDARY], null],
  ['soc', 'SOC', 'Social Science', 'சமூக அறிவியல்', 'core', [...MIDDLE, ...SECONDARY], null],
  ['csc', 'CSC', 'Computer Science', 'கணினி அறிவியல்', 'core', MIDDLE, 'computer'],

  ['tam3', 'TAM-H', 'Tamil', 'தமிழ்', 'language', HSC, null],
  ['eng3', 'ENG-H', 'English', 'ஆங்கிலம்', 'language', HSC, null],
  ['mat3', 'MAT-H', 'Mathematics', 'கணிதம்', 'core', HSC, null],
  ['phy', 'PHY', 'Physics', 'இயற்பியல்', 'core', HSC, 'physics'],
  ['che', 'CHE', 'Chemistry', 'வேதியியல்', 'core', HSC, 'chemistry'],
  ['bio', 'BIO', 'Biology', 'உயிரியல்', 'core', HSC, 'zoology'],
  ['bot', 'BOT', 'Botany', 'தாவரவியல்', 'elective', HSC, 'botany'],
  ['zoo', 'ZOO', 'Zoology', 'விலங்கியல்', 'elective', HSC, 'zoology'],
  ['cshs', 'CS-H', 'Computer Science', 'கணினி அறிவியல்', 'core', HSC, 'computer'],
  ['acc', 'ACC', 'Accountancy', 'கணக்கியல்', 'core', HSC, null],
  ['com', 'COM', 'Commerce', 'வணிகவியல்', 'core', HSC, null],
  ['eco', 'ECO', 'Economics', 'பொருளியல்', 'core', HSC, null],
  ['bma', 'BMA', 'Business Mathematics', 'வணிகக் கணிதம்', 'core', HSC, null],
  ['his', 'HIS', 'History', 'வரலாறு', 'elective', HSC, null],
  ['pol', 'POL', 'Political Science', 'அரசியல் அறிவியல்', 'elective', HSC, null],
  ['pe', 'PE', 'Physical Education', 'உடற்கல்வி', 'co-curricular', [...PRIMARY, ...MIDDLE, ...SECONDARY], null],
];

const subjects = subjectSpec.map(([id, code, name, nameTa, kind, grades, labKind]) => ({
  id: `sub-${id}`,
  code,
  name,
  nameTa,
  kind,
  grades,
  // Higher Secondary science is marked out of 70 theory plus 30 practical.
  maxMarks: labKind && grades[0] >= 11 ? 70 : kind === 'co-curricular' ? 50 : 100,
  hasPractical: !!labKind,
  practicalMarks: labKind && grades[0] >= 11 ? 30 : labKind ? 25 : 0,
  labKind: labKind ?? undefined,
}));

const subjectById = (id) => subjects.find((s) => s.id === id);

/* ── staff ───────────────────────────────────────────────────────────── */

const users = [];
const ROLE = {
  correspondent: ['correspondent'],
  principal: ['principal'],
  hm: ['headmaster'],
  vp: ['vice-principal'],
};

/**
 * Leadership and office. Note that Accounts and Payroll are one person — in a
 * school this size they always are, which is why roles are held as a list.
 */
const officeSpec = [
  ['usr-admin', 'Mr. V. Ramanathan', 'admin@school.edu', 'Admin@123', ['group-admin', 'correspondent'], 'correspondent', 'M.Com., MBA', 258, 14],
  ['usr-principal', 'Mrs. R. Chitra', 'principal@school.edu', 'Principal@123', ['principal'], 'principal', 'M.Sc., M.Ed., Ph.D.', 320, 9],
  ['usr-hm', 'Mrs. K. Vasanthamani', 'hm@school.edu', 'Hm@123', ['headmaster'], 'headmaster', 'M.A., B.Ed.', 12, 11],
  ['usr-vp', 'Mr. D. Sundaramoorthy', 'vp@school.edu', 'Vp@123', ['vice-principal'], 'vice-principal', 'M.Sc., B.Ed.', 200, 7],
  ['usr-office', 'Mrs. L. Punithavathi', 'office@school.edu', 'Office@123', ['office-superintendent'], 'office-superintendent', 'B.Com.', 40, 6],
  ['usr-accounts', 'Mr. A. Saravanan', 'accounts@school.edu', 'Accounts@123', ['accounts-officer', 'payroll-officer'], 'accounts-officer', 'B.Com., CA Inter', 150, 5],
  ['usr-librarian', 'Mrs. S. Hemalatha', 'library@school.edu', 'Library@123', ['librarian'], 'librarian', 'M.L.I.Sc.', 95, 4],
  ['usr-transport', 'Mr. P. Rajamani', 'transport@school.edu', 'Transport@123', ['transport-incharge'], 'attender', 'Diploma (Mech.)', 25, 8],
  ['usr-lab1', 'Mr. C. Ezhilarasan', 'lab1@school.edu', 'Lab@123', ['lab-assistant'], 'lab-assistant', 'B.Sc. (Physics)', 280, 3],
  ['usr-lab2', 'Mrs. J. Kanimozhi', 'lab2@school.edu', 'Lab@123', ['lab-assistant'], 'lab-assistant', 'B.Sc. (Chemistry)', 340, 2],
];

officeSpec.forEach(([id, name, email, password, roles, designation, qualification, hue, years], i) => {
  users.push({
    id,
    schoolId: SCHOOL_ID,
    name,
    email,
    password,
    roles,
    phone: `+91 98430 1${pad(i)}0${i}`,
    status: 'active',
    joinedOn: `${AY_START_YEAR - years}-06-01`,
    avatarHue: hue,
    employeeId: `EMP-${pad(i + 1)}`,
    designation,
    qualification,
    tetCleared: false,
    dateOfJoining: `${AY_START_YEAR - years}-06-01`,
  });
});

/**
 * Teaching staff. The designation decides which grades a teacher may handle:
 * SGT for 1 to 5, B.T. Assistant for 6 to 10, P.G. Assistant for 11 and 12.
 */
const teacherSpec = [
  // id, name, designation, subject template ids they can teach
  ['t1', 'Mrs. S. Revathi', 'bt-assistant', ['sub-tam2']],
  ['t2', 'Mr. K. Senthilkumar', 'bt-assistant', ['sub-mat2']],
  ['t3', 'Mrs. P. Jayanthi', 'bt-assistant', ['sub-eng2']],
  ['t4', 'Mr. R. Anbarasan', 'bt-assistant', ['sub-sci']],
  ['t5', 'Mrs. G. Kalaiselvi', 'bt-assistant', ['sub-soc']],
  ['t6', 'Mr. M. Dhanasekaran', 'bt-assistant', ['sub-csc']],
  ['t7', 'Mrs. V. Umamaheswari', 'bt-assistant', ['sub-tam2']],
  ['t8', 'Mr. S. Prabhakaran', 'bt-assistant', ['sub-mat2']],
  ['t9', 'Mrs. N. Bhuvaneswari', 'bt-assistant', ['sub-eng2']],
  ['t10', 'Mrs. A. Sasirekha', 'bt-assistant', ['sub-sci']],
  ['t11', 'Mr. B. Karunanidhi', 'bt-assistant', ['sub-soc']],

  ['s1', 'Mrs. M. Alamelu', 'sgt', ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs']],
  ['s2', 'Mrs. R. Poongodi', 'sgt', ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs']],
  ['s3', 'Mrs. T. Saraswathi', 'sgt', ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs']],
  ['s4', 'Mrs. K. Nirmaladevi', 'sgt', ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs']],
  ['s5', 'Mrs. G. Yamuna', 'sgt', ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs']],
  ['s6', 'Mrs. P. Vijayalakshmi', 'sgt', ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs']],

  ['p1', 'Mr. N. Chandrasekaran', 'pg-assistant', ['sub-mat3']],
  ['p2', 'Dr. S. Balasubramanian', 'pg-assistant', ['sub-phy']],
  ['p3', 'Mrs. R. Hemavathi', 'pg-assistant', ['sub-che']],
  ['p4', 'Mrs. V. Shanthakumari', 'pg-assistant', ['sub-bio', 'sub-zoo']],
  ['p5', 'Mrs. D. Meenakshi', 'pg-assistant', ['sub-bot']],
  ['p6', 'Mr. K. Arunkumar', 'pg-assistant', ['sub-cshs']],
  ['p7', 'Mr. S. Muthukrishnan', 'pg-assistant', ['sub-acc', 'sub-com']],
  ['p8', 'Mrs. B. Lalithambikai', 'pg-assistant', ['sub-eco', 'sub-bma']],
  ['p9', 'Mrs. E. Thenmozhi', 'pg-assistant', ['sub-tam3']],
  ['p10', 'Mrs. C. Shobana', 'pg-assistant', ['sub-eng3']],
  ['p11', 'Mr. G. Ravichandran', 'pg-assistant', ['sub-his', 'sub-pol']],

  ['pe1', 'Mr. T. Ilangovan', 'pet', ['sub-pe']],
];

const QUALIFICATION = {
  sgt: 'D.T.Ed., B.A.',
  'bt-assistant': 'B.Sc., B.Ed.',
  'pg-assistant': 'M.Sc., M.Ed.',
  pet: 'B.P.Ed.',
};

teacherSpec.forEach(([key, name, designation, subjectIds], i) => {
  const surname = name.split('. ').at(-1).toLowerCase();
  users.push({
    id: `usr-${key}`,
    schoolId: SCHOOL_ID,
    name,
    // The first B.T. Assistant is the demo teacher account.
    email: key === 't1' ? 'teacher@school.edu' : `${surname}@school.edu`,
    password: 'Teacher@123',
    roles: ['subject-teacher'],
    phone: `+91 98430 2${pad(i + 10)}0`,
    status: 'active',
    joinedOn: `${AY_START_YEAR - between(1, 9)}-06-01`,
    avatarHue: (i * 53 + 30) % 360,
    employeeId: `EMP-${pad(20 + i)}`,
    designation,
    qualification: QUALIFICATION[designation] ?? 'M.A., B.Ed.',
    // TET applies to the teaching grades, not to P.G. Assistants.
    tetCleared: designation === 'sgt' || designation === 'bt-assistant',
    dateOfJoining: `${AY_START_YEAR - between(1, 9)}-06-01`,
    subjectIds,
  });
});

const teachers = users.filter((u) => u.roles.includes('subject-teacher'));
/** Teachers qualified for a grade, by designation. */
const teachersFor = (grade, subjectId) =>
  teachers.filter(
    (t) =>
      t.subjectIds.includes(subjectId) &&
      ((grade <= 5 && t.designation === 'sgt') ||
        (grade >= 6 && grade <= 10 && t.designation === 'bt-assistant') ||
        (grade >= 11 && t.designation === 'pg-assistant') ||
        t.designation === 'pet'),
  );

/* ── classes ─────────────────────────────────────────────────────────── */

const stageFor = (grade) =>
  grade <= 5 ? 'primary' : grade <= 8 ? 'middle' : grade <= 10 ? 'secondary' : 'higher-secondary';

/** grade, section, class teacher, room, HSc group */
const classSpec = [
  [1, 'A', 'usr-s1', 'Room 101', null],
  [2, 'A', 'usr-s2', 'Room 102', null],
  [3, 'A', 'usr-s3', 'Room 103', null],
  [4, 'A', 'usr-s4', 'Room 104', null],
  [5, 'A', 'usr-s5', 'Room 105', null],
  [6, 'A', 'usr-t7', 'Room 12', null],
  [7, 'A', 'usr-t9', 'Room 14', null],
  [8, 'A', 'usr-t1', 'Room 21', null],
  [8, 'B', 'usr-t5', 'Room 22', null],
  [9, 'A', 'usr-t2', 'Room 31', null],
  [10, 'A', 'usr-t4', 'Room 33', null],
  [11, 'A', 'usr-p2', 'Room 41', 'hsc-g1'],
  [11, 'B', 'usr-p7', 'Room 42', 'hsc-g4'],
  [12, 'A', 'usr-p3', 'Room 43', 'hsc-g1'],
  [12, 'B', 'usr-p8', 'Room 44', 'hsc-g4'],
];

const classes = classSpec.map(([grade, section, classTeacherId, room, hscGroupId]) => ({
  id: `cls-${grade}${section}`,
  schoolId: SCHOOL_ID,
  grade,
  section,
  label: `${grade}-${section}`,
  stage: stageFor(grade),
  hscGroupId: hscGroupId ?? undefined,
  classTeacherId,
  room,
  // Primary classes run larger; Higher Secondary groups are smaller.
  strength: grade <= 5 ? 32 : grade <= 10 ? 30 : 24,
}));

// Class teachers also hold the class-teacher role.
for (const cls of classes) {
  const t = users.find((u) => u.id === cls.classTeacherId);
  if (t && !t.roles.includes('class-teacher')) t.roles.push('class-teacher');
}

/* ── subjects offered to each class, with their teacher ──────────────── */

/** The subject template ids a class actually studies. */
function subjectIdsForClass(cls) {
  if (cls.stage === 'higher-secondary') {
    const grp = hscGroups.find((g) => g.id === cls.hscGroupId);
    return ['sub-tam3', 'sub-eng3', ...(grp?.subjectIds ?? [])];
  }
  if (cls.stage === 'primary') return ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs', 'sub-pe'];
  if (cls.stage === 'middle')
    return ['sub-tam2', 'sub-eng2', 'sub-mat2', 'sub-sci', 'sub-soc', 'sub-csc', 'sub-pe'];
  return ['sub-tam2', 'sub-eng2', 'sub-mat2', 'sub-sci', 'sub-soc', 'sub-pe'];
}

const classSubjects = [];
let csSeq = 0;
classes.forEach((cls, ci) => {
  subjectIdsForClass(cls).forEach((subjectId, si) => {
    const pool = teachersFor(cls.grade, subjectId);
    const sub = subjectById(subjectId);
    const teacher =
      // A Secondary Grade Teacher handles every subject of their own class.
      cls.stage === 'primary' && sub.kind !== 'co-curricular'
        ? users.find((u) => u.id === cls.classTeacherId)
        : (pool[(ci + si) % Math.max(pool.length, 1)] ?? pool[0]);
    classSubjects.push({
      id: `csub-${++csSeq}`,
      classId: cls.id,
      subjectId,
      teacherId: teacher?.id ?? cls.classTeacherId,
      periodsPerWeek: sub.kind === 'co-curricular' ? 2 : sub.kind === 'language' ? 6 : 5,
    });
  });
});

const classSubjectsOf = (classId) => classSubjects.filter((cs) => cs.classId === classId);

/* ── students and parents ────────────────────────────────────────────── */

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
      schoolId: SCHOOL_ID,
      name: `${first} ${initial}.`,
      email: isDemoStudent
        ? 'student@school.edu'
        : `${first.toLowerCase()}.${admissionSeq}@student.school.edu`,
      password: 'Student@123',
      roles: ['student'],
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
      schoolId: SCHOOL_ID,
      name: isDemoStudent ? mother : r % 2 === 0 ? father : mother,
      email: isDemoStudent ? 'parent@school.edu' : `parent.${admissionSeq}@gmail.com`,
      password: 'Parent@123',
      roles: ['parent'],
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
const demoParent = parents.find((p) => p.email === 'parent@school.edu');
const studentsOf = (classId) => students.filter((s) => s.classId === classId);

/* ── laboratories ────────────────────────────────────────────────────── */

const labSpec = [
  ['physics', 'Physics Laboratory', 'Lab 1', 24, 'usr-p2', 'usr-lab1'],
  ['chemistry', 'Chemistry Laboratory', 'Lab 2', 24, 'usr-p3', 'usr-lab2'],
  ['botany', 'Botany Laboratory', 'Lab 3', 20, 'usr-p5', 'usr-lab2'],
  ['zoology', 'Zoology Laboratory', 'Lab 4', 20, 'usr-p4', 'usr-lab2'],
  ['computer', 'Computer Laboratory', 'Lab 5', 30, 'usr-p6', 'usr-lab1'],
];

const labs = labSpec.map(([kind, name, room, capacity, inChargeId, assistantId], i) => ({
  id: `lab-${kind}`,
  schoolId: SCHOOL_ID,
  name,
  kind,
  room,
  capacity,
  inChargeId,
  assistantId,
}));

// Lab in-charges hold the matching role.
for (const lab of labs) {
  const inCharge = users.find((u) => u.id === lab.inChargeId);
  if (inCharge && !inCharge.roles.includes('lab-incharge')) inCharge.roles.push('lab-incharge');
}

/**
 * A class larger than the lab splits into batches that attend on different
 * days. This is the real constraint — 30 pupils cannot share 24 benches.
 */
const labBatches = [];
classes
  .filter((c) => subjectIdsForClass(c).some((id) => subjectById(id).hasPractical))
  .forEach((cls) => {
    const roll = studentsOf(cls.id);
    const smallest = Math.min(
      ...subjectIdsForClass(cls)
        .map((id) => subjectById(id))
        .filter((s) => s.hasPractical)
        .map((s) => labs.find((l) => l.kind === s.labKind)?.capacity ?? 30),
    );
    const count = Math.ceil(roll.length / smallest);
    for (let b = 0; b < count; b++) {
      labBatches.push({
        id: `batch-${cls.id}-${b + 1}`,
        classId: cls.id,
        name: `Batch ${String.fromCharCode(65 + b)}`,
        studentIds: roll.filter((_, i) => i % count === b).map((s) => s.id),
      });
    }
  });

const apparatusSpec = {
  physics: [['Vernier calliper', 30, 'nos'], ['Screw gauge', 30, 'nos'], ['Travelling microscope', 8, 'nos'], ['Spectrometer', 6, 'nos'], ['Resistance box', 20, 'nos'], ['Galvanometer', 15, 'nos']],
  chemistry: [['Burette 50 ml', 40, 'nos'], ['Pipette 20 ml', 40, 'nos'], ['Conical flask 250 ml', 60, 'nos'], ['Sodium hydroxide', 2, 'kg'], ['Oxalic acid', 1, 'kg'], ['Litmus paper', 25, 'books']],
  botany: [['Compound microscope', 12, 'nos'], ['Permanent slides', 80, 'nos'], ['Herbarium sheets', 200, 'nos'], ['Dissection kit', 20, 'nos']],
  zoology: [['Compound microscope', 12, 'nos'], ['Preserved specimens', 35, 'nos'], ['Dissection tray', 20, 'nos'], ['Hand lens', 30, 'nos']],
  computer: [['Desktop computer', 30, 'nos'], ['UPS 1 kVA', 4, 'nos'], ['Laser printer', 2, 'nos'], ['Network switch', 3, 'nos']],
};

const labItems = [];
let itemSeq = 0;
labs.forEach((lab) => {
  apparatusSpec[lab.kind].forEach(([name, quantity, unit], i) => {
    labItems.push({
      id: `labit-${++itemSeq}`,
      labId: lab.id,
      name,
      quantity,
      unit,
      condition: i === 2 && lab.kind !== 'computer' ? 'needs-repair' : 'good',
    });
  });
});

const labBreakages = [];
let brkSeq = 0;
// A handful of breakages this term, as every lab register has.
[
  ['lab-chemistry', 2, 120],
  ['lab-physics', 1, 350],
  ['lab-chemistry', 3, 180],
  ['lab-botany', 1, 450],
].forEach(([labId, quantity, amount], i) => {
  const item = labItems.find((it) => it.labId === labId);
  const hsc = students.filter((s) => s.classId.startsWith('cls-11') || s.classId.startsWith('cls-12'));
  const student = hsc[(i * 13) % hsc.length];
  labBreakages.push({
    id: `brk-${++brkSeq}`,
    labId,
    itemId: item.id,
    studentId: student.id,
    date: shift(-between(4, 30)),
    quantity,
    note: pick(['Slipped while titrating.', 'Dropped during the practical.', 'Cracked on heating.']),
    amount,
    recovered: i % 2 === 0,
  });
});

/* ── timetable ───────────────────────────────────────────────────────── */

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

/**
 * Who is already standing in front of a class, and which lab is in use, keyed
 * by day and period.
 *
 * The timetable used to be generated one class at a time, which produced 234
 * double-bookings across the school — the same P.E. teacher in three classes at
 * once. Nothing surfaced it until the period scheduler started checking, and it
 * also made the cover board's idea of a "free" teacher wrong. So the week is
 * now built with a single busy map that every class is placed against.
 */
const busyTeacher = new Map();
const busyLab = new Map();
const at = (day, period) => `${day}-${period}`;

const teacherFree = (day, period, teacherId) =>
  !teacherId || !(busyTeacher.get(at(day, period)) ?? new Set()).has(teacherId);
const labFree = (day, period, labId) =>
  !labId || !(busyLab.get(at(day, period)) ?? new Set()).has(labId);

function occupy(day, period, teacherId, labId) {
  const key = at(day, period);
  if (teacherId) {
    if (!busyTeacher.has(key)) busyTeacher.set(key, new Set());
    busyTeacher.get(key).add(teacherId);
  }
  if (labId) {
    if (!busyLab.has(key)) busyLab.set(key, new Set());
    busyLab.get(key).add(labId);
  }
}

/**
 * Build a clash-free week for a set of classes.
 *
 * Each class owes a number of periods per subject. For every slot in the week
 * the class is offered whichever of its own subjects is furthest behind its
 * quota and whose teacher is actually free — so quotas fill up without anyone
 * being booked twice. Where nothing fits, the period is left free, which is
 * honest: a real timetable has gaps too.
 */
function buildWeek(forClasses) {
  // How many periods each class still owes each subject.
  const owed = new Map();
  for (const cls of forClasses) {
    const quota = new Map();
    for (const cs of classSubjects.filter((x) => x.classId === cls.id)) {
      quota.set(cs.subjectId, cs.periodsPerWeek);
    }
    owed.set(cls.id, quota);
  }

  for (let day = 1; day <= 6; day++) {
    periods.forEach(([startAt, endAt, kind], pi) => {
      const period = pi + 1;

      // Rotate which class gets first pick, so the same class is not always the
      // one left with a free period when a teacher is taken.
      const order = forClasses.map((_, i) => forClasses[(i + day + pi) % forClasses.length]);

      for (const cls of order) {
        if (day === 6 && pi > 4) continue; // half-day Saturday
        if (cls.grade <= 5 && pi > 6) continue; // primary goes home earlier

        if (kind !== 'period') {
          timetable.push({
            id: `slot-${++slotSeq}`,
            classId: cls.id,
            day,
            period,
            start: startAt,
            end: endAt,
            subjectId: null,
            teacherId: null,
            title: kind === 'break' ? 'Short Break' : 'Lunch Break',
            kind,
          });
          continue;
        }

        const quota = owed.get(cls.id);
        const offered = classSubjects.filter((x) => x.classId === cls.id);

        // Practicals belong in the last periods of Tuesday and Thursday, where
        // a double period is available and the lab can take one batch.
        const practicalWindow = (day === 2 || day === 4) && pi >= 7;

        const candidates = offered
          .map((cs) => {
            const sub = subjectById(cs.subjectId);
            const lab = sub.hasPractical ? labs.find((l) => l.kind === sub.labKind) : undefined;
            return { cs, sub, lab, left: quota.get(cs.subjectId) ?? 0 };
          })
          .filter(({ sub, lab, cs }) => {
            if (sub.hasPractical !== practicalWindow) return false;
            if (!teacherFree(day, period, cs.teacherId)) return false;
            if (!labFree(day, period, lab?.id)) return false;
            return true;
          })
          // Furthest behind its quota first; a subject already satisfied is a
          // last resort rather than forbidden, so gaps stay rare.
          .sort((a, b) => b.left - a.left);

        const pick = candidates.find((c) => c.left > 0) ?? candidates[0];

        if (!pick) {
          timetable.push({
            id: `slot-${++slotSeq}`,
            classId: cls.id,
            day,
            period,
            start: startAt,
            end: endAt,
            subjectId: null,
            teacherId: null,
            title: 'Free period',
            kind: 'period',
          });
          continue;
        }

        const batch = labBatches.filter((b) => b.classId === cls.id)[day === 2 ? 0 : 1];
        const isLab = pick.sub.hasPractical;

        timetable.push({
          id: `slot-${++slotSeq}`,
          classId: cls.id,
          day,
          period,
          start: startAt,
          end: endAt,
          subjectId: pick.cs.subjectId,
          teacherId: pick.cs.teacherId,
          title: isLab ? `${pick.sub.name} Practical` : undefined,
          kind: isLab ? 'lab' : 'period',
          labId: isLab ? pick.lab?.id : undefined,
          batchId: isLab ? (batch?.id ?? labBatches.find((b) => b.classId === cls.id)?.id) : undefined,
        });

        occupy(day, period, pick.cs.teacherId, isLab ? pick.lab?.id : undefined);
        quota.set(pick.cs.subjectId, Math.max(0, (quota.get(pick.cs.subjectId) ?? 0) - 1));
      }
    });
  }
}

buildWeek(classes);

/* ── school days and daily attendance ────────────────────────────────── */

const schoolDays = [];
for (let back = 0; schoolDays.length < 35; back++) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - back);
  if (d.getDay() === 0) continue; // Sunday
  schoolDays.push(iso(d));
}
schoolDays.reverse();

/**
 * Each class has its own attendance culture — 8-B is the weak one, 12-A the
 * strongest. Without this every class lands on the same percentage and the
 * dashboard charts are a row of identical bars.
 */
const CLASS_ABSENCE = {
  'cls-1A': 8, 'cls-2A': 7, 'cls-3A': 6, 'cls-4A': 6, 'cls-5A': 5,
  'cls-6A': 5, 'cls-7A': 7, 'cls-8A': 6, 'cls-8B': 13, 'cls-9A': 9,
  'cls-10A': 3, 'cls-11A': 4, 'cls-11B': 8, 'cls-12A': 2, 'cls-12B': 6,
};

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
      reason:
        status === 'leave' ? pick(['Family function', 'Medical', 'Out of station']) : undefined,
      markedBy: classes.find((c) => c.id === st.classId)?.classTeacherId,
    });
  });
});

/* ── homework ────────────────────────────────────────────────────────── */

const homeworkSpec = [
  ['sub-tam2', 'திருக்குறள் 10 பாடல்கள் மனப்பாடம்', 'Memorise Thirukkural couplets 101 to 110 and write their meaning in your notebook.'],
  ['sub-mat2', 'Exercise 4.2 — Linear Equations', 'Complete sums 1 to 12 from Exercise 4.2. Show every step of the working.'],
  ['sub-sci', 'Diagram: Parts of a Flower', 'Draw and label the parts of a flower on an unruled sheet. Bring it to the lab session.'],
  ['sub-eng2', 'Letter to the Headmaster', 'Write a formal letter requesting leave for two days. Minimum 120 words.'],
  ['sub-soc', 'Map work — Rivers of Tamil Nadu', 'Mark the Cauvery, Vaigai, Thamirabarani and Palar on the outline map provided.'],
  ['sub-csc', 'HTML practice', 'Create a simple web page about your favourite festival using headings, lists and an image.'],
  ['sub-tam1', 'எழுத்துப் பயிற்சி', 'Write the Tamil vowels five times each in your four-line notebook.'],
  ['sub-mat1', 'Tables 12 to 15', 'Learn and write multiplication tables 12 to 15.'],
  ['sub-evs', 'My Neighbourhood', 'Draw your street and label four places you can see from your house.'],
  ['sub-eng1', 'Rhyming words', 'Write five pairs of rhyming words and one sentence using each pair.'],
  ['sub-phy', 'Numericals — Laws of Motion', 'Solve problems 1 to 8 from the exercise. State the law used in each.'],
  ['sub-che', 'Record: Volumetric Analysis', 'Complete the observation table and calculation for the titration done in the lab.'],
  ['sub-mat3', 'Matrices — Exercise 1.3', 'Solve all sums. Verify your answers for questions 4 and 7.'],
  ['sub-acc', 'Journal entries — 15 transactions', 'Pass journal entries for the transactions on page 48 and balance the ledger.'],
  ['sub-eco', 'Essay: Demand and Supply', 'Explain the law of demand with a schedule and a diagram. 200 words.'],
];

const homework = [];
const homeworkStatus = [];
let hwSeq = 0;

classes.forEach((cls) => {
  const offered = classSubjectsOf(cls.id);
  let i = -1;
  homeworkSpec.forEach(([subjectId, title, description]) => {
    const cs = offered.find((o) => o.subjectId === subjectId);
    if (!cs) return;
    i += 1;
    const dueOffset = i - 2;
    const hw = {
      id: `hw-${++hwSeq}`,
      classId: cls.id,
      subjectId,
      title,
      description,
      assignedOn: shift(dueOffset - 3),
      dueOn: shift(dueOffset),
      assignedById: cs.teacherId,
    };
    homework.push(hw);

    studentsOf(cls.id).forEach((s, si) => {
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

/* ── exams and marks ─────────────────────────────────────────────────── */

const examSpec = [
  ['Unit Test 1', 'UT1', 1, -120],
  ['Quarterly Examination', 'Quarterly', 1, -40],
  ['Half-Yearly Examination', 'Half-Yearly', 2, 55],
  ['Annual Examination', 'Annual', 3, 180],
];

const grades = [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b);
const exams = [];
grades.forEach((grade) => {
  examSpec.forEach(([name, shortName, term, offset]) => {
    exams.push({
      id: `exm-${grade}-${shortName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name,
      shortName,
      term,
      grade,
      startsOn: shift(offset),
      endsOn: shift(offset + 6),
      published: offset < 0,
    });
  });
});

const marks = [];
students.forEach((st, si) => {
  const cls = classes.find((c) => c.id === st.classId);
  const offered = classSubjectsOf(cls.id).filter(
    (cs) => subjectById(cs.subjectId).kind !== 'co-curricular',
  );
  exams
    .filter((e) => e.grade === cls.grade && e.published)
    .forEach((exam) => {
      offered.forEach((cs, bi) => {
        const sub = subjectById(cs.subjectId);
        const span = sub.maxMarks;
        const base = Math.round(span * (0.45 + ((si * 7 + bi * 17 + exam.shortName.length * 5) % 50) / 100));
        const bump = exam.shortName === 'Quarterly' ? Math.round(span * 0.04) : 0;
        marks.push({
          id: `mk-${st.id}-${exam.id}-${cs.subjectId}`,
          studentId: st.id,
          examId: exam.id,
          subjectId: cs.subjectId,
          marks: Math.min(span, base + bump),
          maxMarks: span,
          // Practicals are marked generously, as they genuinely are.
          practicalMarks: sub.hasPractical
            ? Math.min(sub.practicalMarks, Math.round(sub.practicalMarks * 0.75) + (si % 7))
            : null,
        });
      });
    });
});

/* ── transport ───────────────────────────────────────────────────────── */

const vehicleSpec = [
  ['TN 38 AX 1204', 'Ashok Leyland Lynx 42', 42, 'R. Murugesan', '+91 99445 21001', 'TN38 20110004521', 'Mrs. A. Selvi', '+91 99445 31001', 95, 140, 410],
  ['TN 38 AX 1205', 'Ashok Leyland Lynx 42', 42, 'K. Chinnasamy', '+91 99445 21002', 'TN38 20090011874', 'Mrs. R. Kavitha', '+91 99445 31002', 22, 60, 300],
  ['TN 38 AX 1206', 'Eicher Skyline 36', 36, 'S. Velmurugan', '+91 99445 21003', 'TN38 20140007733', 'Mrs. M. Bhuvana', '+91 99445 31003', 210, 18, 520],
  ['TN 38 AX 1207', 'Tata Starbus 40', 40, 'M. Palanivel', '+91 99445 21004', 'TN38 20120003290', 'Mrs. P. Nirmala', '+91 99445 31004', -12, 95, 260],
];

const vehicles = vehicleSpec.map(
  (
    [busNo, model, capacity, driverName, driverPhone, driverLicenceNo, attendantName, attendantPhone, fc, ins, permit],
    i,
  ) => ({
    id: `veh-${i + 1}`,
    schoolId: SCHOOL_ID,
    busNo,
    model,
    capacity,
    driverName,
    driverPhone,
    driverLicenceNo,
    attendantName,
    attendantPhone,
    // Bus 1207's fitness certificate has already lapsed — the office needs to
    // see that, and a compliance screen with nothing wrong proves nothing.
    fcExpiry: shift(fc),
    insuranceExpiry: shift(ins),
    permitExpiry: shift(permit),
  }),
);

const routeSpec = [
  ['Route 1 — Gandhipuram', 'veh-1', ['Gandhipuram Bus Stand', 'Cross Cut Road', 'Sivananda Colony', 'Thudiyalur Road'], 9000],
  ['Route 2 — Peelamedu', 'veh-2', ['Peelamedu Signal', 'Hope College', 'Nehru Stadium', 'Avinashi Road'], 9000],
  ['Route 3 — Saravanampatti', 'veh-3', ['Saravanampatti Junction', 'Kalapatti Road', 'KCT Gate', 'Vilankurichi'], 7500],
  ['Route 4 — R.S. Puram', 'veh-4', ['R.S. Puram West', 'DB Road', 'Race Course', 'Puliakulam'], 10500],
];

const routes = routeSpec.map(([name, vehicleId, stopNames, fee], i) => ({
  id: `rt-${i + 1}`,
  schoolId: SCHOOL_ID,
  name,
  vehicleId,
  fee,
  stops: stopNames.map((s, si) => ({
    name: s,
    time: `0${7 + Math.floor((si * 12) / 60)}:${pad((si * 12) % 60)}`,
  })),
}));

const studentTransport = [];

/**
 * Seats are finite. The four buses seat 160 between them, so only that many
 * children can be allotted — the rest walk, cycle or come by private van, as
 * they do. Overfilling the routes would make every route read "bus full" on the
 * allotment screen, and the capacity figure would mean nothing.
 */
const seatsLeft = new Map(
  routes.map((r) => [r.id, vehicles.find((v) => v.id === r.vehicleId).capacity]),
);

const seat = (st, route, status, requestedOn) => {
  studentTransport.push({
    id: `stt-${st.id}`,
    studentId: st.id,
    routeId: route.id,
    stop: route.stops[(st.rollNo ?? 0) % route.stops.length].name,
    status,
    requestedOn,
  });
  if (status === 'allotted') seatsLeft.set(route.id, seatsLeft.get(route.id) - 1);
};

// The demo child always rides, so the parent demo has a bus to show. Route 3 is
// the one the timing-change circular is about.
if (DEMO_STUDENT) {
  studentTransport.push({
    id: `stt-${DEMO_STUDENT.id}`,
    studentId: DEMO_STUDENT.id,
    routeId: routes[2].id,
    stop: routes[2].stops[1].name,
    status: 'allotted',
    requestedOn: shift(-between(20, 120)),
  });
  seatsLeft.set(routes[2].id, seatsLeft.get(routes[2].id) - 1);
}

students.forEach((st, i) => {
  if (st.id === DEMO_STUDENT?.id) return;
  if (i % 3 === 0) return; // not every family uses the bus
  const requestedOn = shift(-between(20, 120));

  // A handful sit in the queue so the office has something to act on. These do
  // not hold a seat — that is what makes the queue a queue.
  if (i % 23 === 0) return seat(st, routes[i % routes.length], 'requested', requestedOn);
  if (i % 37 === 0) return seat(st, routes[i % routes.length], 'approved', requestedOn);

  // Otherwise take the first route with a seat free, starting from the one that
  // falls to this child's turn so the buses fill evenly rather than front to back.
  for (let k = 0; k < routes.length; k++) {
    const route = routes[(i + k) % routes.length];
    if (seatsLeft.get(route.id) > 0) return seat(st, route, 'allotted', requestedOn);
  }
  // Every bus is full, so this child does not use school transport.
});

const usesBus = new Set(
  studentTransport.filter((t) => t.status === 'allotted').map((t) => t.studentId),
);

/* ── fees ────────────────────────────────────────────────────────────── */

/** Tuition rises with the class, as it does in a real school. */
const tuitionForGrade = (grade) =>
  grade <= 5 ? 3200 + grade * 200 : grade <= 10 ? 4500 + (grade - 6) * 750 : 9500 + (grade - 11) * 1500;
const booksForGrade = (grade) => (grade <= 5 ? 1800 + grade * 150 : 3500 + (grade - 6) * 350);

const fees = [];
const payments = [];
let receiptSeq = 100;

/** Some classes carry more fee pressure than others. */
const CLASS_PRESSURE = { 'cls-8B': 2, 'cls-7A': 1, 'cls-9A': 1, 'cls-11B': 2, 'cls-2A': 1 };

students.forEach((st, si) => {
  const grade = classes.find((c) => c.id === st.classId).grade;
  const tuition = tuitionForGrade(grade);
  const heads = [
    ['Tuition Fee — Term 1', 1, tuition, -75],
    ['Tuition Fee — Term 2', 2, tuition, 12],
    ['Tuition Fee — Term 3', 3, tuition, 110],
    ['Books & Uniform', 0, booksForGrade(grade), -85],
    ['Examination Fee', 2, grade >= 11 ? 1200 : 600, 20],
  ];
  // Higher Secondary science groups pay a lab fee, as they always do.
  if (grade >= 11) {
    const cls = classes.find((c) => c.id === st.classId);
    const hasPractical = subjectIdsForClass(cls).some((id) => subjectById(id).hasPractical);
    if (hasPractical) heads.push(['Laboratory Fee', 1, 2500, -75]);
  }
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
    const paid =
      state === 'paid' ? total : state === 'partial' ? Math.round((total * partialShare) / 100) * 100 : 0;
    // A few families hold a staff or sibling concession.
    const concession = si % 37 === 0 && term === 1 ? 1000 : 0;
    const id = `fee-${st.id}-${hi}`;
    fees.push({ id, studentId: st.id, head, term, total: total - concession, paid, dueOn, concession });

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

/* ── payroll (simulated) ─────────────────────────────────────────────── */

/** Pay scales by designation — indicative, not any school's actual scale. */
const SCALE = {
  correspondent: 0,
  principal: 62000,
  headmaster: 48000,
  'vice-principal': 45000,
  'pg-assistant': 38000,
  'bt-assistant': 30000,
  sgt: 24000,
  pet: 26000,
  librarian: 22000,
  'lab-assistant': 18000,
  'office-superintendent': 26000,
  'accounts-officer': 32000,
  attender: 15000,
};

const staff = users.filter((u) => u.employeeId);
const salaries = [];
const payslips = [];
let slipSeq = 0;

staff.forEach((s, i) => {
  const basic = SCALE[s.designation] ?? 20000;
  if (basic === 0) return; // the Correspondent draws no salary
  const da = Math.round(basic * 0.18);
  const hra = Math.round(basic * 0.1);
  const conveyance = 1600;
  const otherAllowance = i % 3 === 0 ? 1000 : 0;
  // Employee PF is 12% of basic, capped at the statutory ₹15,000 wage ceiling.
  const pf = Math.round(Math.min(basic, 15000) * 0.12);
  const esi = basic + da <= 21000 ? Math.round((basic + da) * 0.0075) : 0;
  const professionalTax = basic >= 21000 ? 208 : 135;

  salaries.push({
    id: `sal-${s.id}`,
    staffId: s.id,
    basic,
    da,
    hra,
    conveyance,
    otherAllowance,
    pf,
    esi,
    professionalTax,
  });

  const gross = basic + da + hra + conveyance + otherAllowance;
  const deductions = pf + esi + professionalTax;
  // Three months of payslips: two paid, the current month still in draft.
  for (let back = 2; back >= 0; back--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - back, 1);
    const lopDays = back === 1 && i % 9 === 0 ? 1 : 0;
    const lop = Math.round((gross / 30) * lopDays);
    payslips.push({
      id: `slip-${++slipSeq}`,
      staffId: s.id,
      month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      gross: gross - lop,
      deductions,
      net: gross - lop - deductions,
      lopDays,
      status: back === 0 ? 'draft' : 'paid',
      paidOn: back === 0 ? undefined : iso(new Date(d.getFullYear(), d.getMonth() + 1, 1)),
    });
  }
});

/* ── staff recruitment ───────────────────────────────────────────────── */

const ALL_DOCS = ['degree', 'bed', 'tet', 'aadhaar', 'pan', 'bank', 'experience'];

const applicationSpec = [
  ['Mrs. K. Sumathi', 'sumathi.k@gmail.com', 'bt-assistant', 'B.Sc. (Maths), B.Ed.', true, 6, ['sub-mat2'], 'submitted', 2, ''],
  ['Mr. R. Vetrivel', 'vetrivel.r@gmail.com', 'pg-assistant', 'M.Sc. (Physics), M.Ed.', false, 9, ['sub-phy'], 'under-review', 5, 'Qualification verified. Awaiting demonstration class.'],
  ['Mrs. A. Priyadharshini', 'priya.a@gmail.com', 'sgt', 'D.T.Ed., B.A. (Tamil)', true, 3, ['sub-tam1', 'sub-evs'], 'submitted', 1, ''],
  ['Mr. S. Bhuvanesh', 'bhuvanesh.s@gmail.com', 'pet', 'B.P.Ed., M.P.Ed.', false, 4, ['sub-pe'], 'approved', 18, 'Demonstration session satisfactory. Approved for appointment.'],
  ['Mrs. N. Gowthami', 'gowthami.n@gmail.com', 'bt-assistant', 'B.A. (English), B.Ed.', false, 2, ['sub-eng2'], 'rejected', 24, 'TET not cleared. May reapply after clearing Paper II.'],
  ['Mr. V. Ashokkumar', 'ashok.v@gmail.com', 'lab-assistant', 'B.Sc. (Chemistry)', false, 5, [], 'under-review', 8, 'Bank passbook copy still awaited.'],
];

const applications = applicationSpec.map(
  ([name, email, designation, qualification, tetCleared, experienceYears, subjectIds, status, daysAgo, reviewNote], i) => {
    // An incomplete file is the normal case, and it is what the reviewer acts on.
    const missing = status === 'submitted' ? 2 : status === 'under-review' ? 1 : 0;
    const needed = ALL_DOCS.filter((k) => {
      if (k === 'tet' && !tetCleared) return false;
      if (k === 'bed' && (designation === 'lab-assistant' || designation === 'pet')) return false;
      if (k === 'experience' && experienceYears === 0) return false;
      return true;
    });
    return {
      id: `app-${i + 1}`,
      ref: `APP/${AY_START_YEAR}/${pad(31 + i)}`,
      schoolId: SCHOOL_ID,
      name,
      email,
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      designation,
      qualification,
      tetCleared,
      experienceYears,
      subjectIds,
      documents: needed.slice(0, needed.length - missing).map((kind) => ({
        kind,
        fileName: `${kind}-${name.split(' ').at(-1).toLowerCase()}.pdf`,
        uploadedOn: shift(-daysAgo - between(0, 3)),
        verified: status === 'approved' || status === 'rejected',
      })),
      status,
      submittedOn: shift(-daysAgo),
      reviewedById: status === 'submitted' ? undefined : 'usr-principal',
      reviewedOn: status === 'submitted' ? undefined : shift(-daysAgo + 2),
      reviewNote,
    };
  },
);

/* ── leave and substitution ──────────────────────────────────────────── */

const leaves = [
  ['usr-t4', 'medical', 0, 1, 'Viral fever. Medical certificate attached.', 'approved'],
  ['usr-p5', 'casual', 0, 0, 'Family function at Pollachi.', 'approved'],
  ['usr-t9', 'on-duty', 2, 2, 'Accompanying students to the district science fair.', 'approved'],
  ['usr-s3', 'casual', 1, 1, 'Personal.', 'requested'],
  ['usr-t8', 'earned', -8, -6, 'Pre-planned leave.', 'approved'],
].map(([staffId, kind, fromOffset, toOffset, reason, status], i) => ({
  id: `lv-${i + 1}`,
  staffId,
  kind,
  from: shift(fromOffset),
  to: shift(toOffset),
  reason,
  status,
  approvedById: status === 'approved' ? 'usr-principal' : undefined,
}));

/**
 * Today's adjustments. Two teachers are on approved leave, so every period they
 * were due to take has been handed to a teacher who is free that period.
 */
const substitutions = [];
let subSeq = 0;
const todayDow = TODAY.getDay() === 0 ? 1 : TODAY.getDay();
const absentToday = leaves
  .filter((l) => l.status === 'approved' && l.from <= TODAY_ISO && l.to >= TODAY_ISO)
  .map((l) => l.staffId);

absentToday.forEach((absentId) => {
  const slots = timetable.filter(
    (s) => s.day === todayDow && s.teacherId === absentId && s.kind !== 'break' && s.kind !== 'lunch',
  );
  slots.forEach((slot) => {
    const busy = new Set(
      timetable.filter((s) => s.day === slot.day && s.period === slot.period).map((s) => s.teacherId),
    );
    const sub = subjectById(slot.subjectId);
    const cls = classes.find((c) => c.id === slot.classId);
    // Prefer a teacher who can actually take the subject, then anyone free.
    const free = teachers.filter((t) => !busy.has(t.id) && t.id !== absentId);
    const best = free.find((t) => t.subjectIds.includes(slot.subjectId) && teachersFor(cls.grade, slot.subjectId).includes(t)) ?? free[0];
    if (!best) return;
    substitutions.push({
      id: `sbt-${++subSeq}`,
      date: TODAY_ISO,
      slotId: slot.id,
      classId: slot.classId,
      absentTeacherId: absentId,
      coverTeacherId: best.id,
      assignedById: 'usr-vp',
      note: best.subjectIds.includes(slot.subjectId)
        ? ''
        : `Supervision only — ${sub?.name ?? 'subject'} teacher unavailable.`,
    });
  });
});

/* ── circulars ───────────────────────────────────────────────────────── */

const circulars = [
  ['Parent–Teacher Meeting — Saturday', 'பெற்றோர்–ஆசிரியர் சந்திப்பு', 'PTM', 'The Parent–Teacher Meeting for all classes will be held this Saturday from 9:30 AM to 12:30 PM in the respective classrooms. Quarterly report cards will be handed over in person. Parents are requested to attend without fail.', true, 2],
  ['Quarterly Examination results published', 'காலாண்டுத் தேர்வு முடிவுகள்', 'Exam', 'Quarterly Examination results are now available in the app under Report Card. Subject teachers will discuss individual performance during the PTM. Re-evaluation requests close within seven days.', true, 4],
  ['Class 11 — group change window closes', 'குழு மாற்றம்', 'General', 'Students of Class 11 who wish to change their subject group must submit a written request countersigned by a parent before the end of this month. Changes cannot be made after the Quarterly results are entered.', true, 5],
  ['Deepavali holidays', 'தீபாவளி விடுமுறை', 'Holiday', 'The school will remain closed for Deepavali. Classes resume as usual the following working day. School buses will not operate during the holidays.', false, 6],
  ['Term 2 fee due date', 'கட்டணம் செலுத்தும் நாள்', 'Fee', 'Term 2 tuition and bus fees are due shortly. Payment can be made online through the app or at the school office between 9:00 AM and 3:00 PM on working days. Kindly collect your receipt.', true, 8],
  ['Practical batches — Classes 11 and 12', 'பயிற்சி வகுப்புகள்', 'General', 'Revised practical batch lists for Physics, Chemistry, Botany and Zoology are displayed on the laboratory notice board. Students must attend with their record notebook and apron on their allotted day only.', false, 9],
  ['Annual Day — date announced', 'ஆண்டு விழா', 'Event', 'Our Annual Day will be celebrated in the school auditorium. Students selected for cultural programmes will have practice after school hours. Parents will receive a separate invitation.', false, 12],
  ['Bus Route 3 timing change', 'பேருந்து நேர மாற்றம்', 'Transport', 'From Monday, Route 3 (Saravanampatti) will reach the Kalapatti Road stop ten minutes earlier. Parents are requested to send children to the stop accordingly.', false, 15],
].map(([title, titleTa, category, body, pinned, daysAgo], i) => ({
  id: `cir-${i + 1}`,
  schoolId: SCHOOL_ID,
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

/* ── events ──────────────────────────────────────────────────────────── */

const events = [
  ['Parent–Teacher Meeting', 'PTM', 'Class-wise meetings with subject teachers. Quarterly report cards are handed over in person.', 3, '09:30', 'Respective classrooms', 'School Office'],
  ['Deepavali Celebration', 'Cultural', 'Cultural programmes by students, followed by sweets distribution. Students may wear traditional dress.', 5, '10:00', 'School Assembly Ground', 'Cultural Committee'],
  ['Inter-House Sports Meet', 'Sports', 'Track and field events for all classes. Parents are welcome to attend and cheer.', 18, '08:00', 'School Playground', 'Physical Education Dept'],
  ['Science Exhibition', 'Academic', 'Students present working models and charts. Judged by teachers from neighbouring schools.', 26, '09:30', 'School Auditorium', 'Science Department'],
  ['Annual Day', 'Cultural', 'The school’s flagship celebration — dance, drama, prize distribution and the Chief Guest’s address.', 40, '17:00', 'School Auditorium', 'Cultural Committee'],
].map(([title, category, description, daysAhead, time, venue, organiser], i) => ({
  id: `evt-${i + 1}`,
  schoolId: SCHOOL_ID,
  title,
  description,
  category,
  date: shift(daysAhead),
  time,
  venue,
  organiser,
  forClasses: 'all',
}));

/* ── help desk ───────────────────────────────────────────────────────── */

const requests = [
  ['Leave for two days — family function', 'Leave', 'in-progress', 'Requesting leave on Thursday and Friday for a family wedding in Madurai. Kindly permit.', demoParent?.id, DEMO_STUDENT?.id, 3],
  ['Bonafide certificate required', 'Certificate', 'resolved', 'Bonafide certificate needed for a bank scholarship application. Kindly issue at the earliest.', demoParent?.id, DEMO_STUDENT?.id, 12],
  ['Request to change bus stop', 'Transport', 'open', 'We have shifted house to Vilankurichi. Requesting a change of boarding point on Route 3.', parents[4]?.id, students[4]?.id, 2],
  ['Fan not working in Room 21', 'Facility', 'in-progress', 'The ceiling fan near the last bench has not been working for a week. Children are finding it difficult in the afternoon.', 'usr-t1', undefined, 5],
  ['Burette replacement for Chemistry lab', 'Facility', 'open', 'Six burettes are cracked and cannot be used for volumetric analysis. Requesting replacement before the practical examination.', 'usr-p3', undefined, 4],
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

/* ── library ─────────────────────────────────────────────────────────── */

const bookSpec = [
  ['Ponniyin Selvan (Part 1)', 'Kalki Krishnamurthy', 'Vanathi Pathippagam', '978-81-234-0011-2', 'Tamil Literature', 5, 'A-01', [8, 9, 10, 11, 12], 420],
  ['Thirukkural with Explanation', 'Thiruvalluvar', 'Sura Books', '978-81-234-0022-9', 'Tamil Literature', 8, 'A-02', [6, 7, 8, 9, 10, 11, 12], 180],
  ['Wings of Fire', 'A.P.J. Abdul Kalam', 'Universities Press', '978-81-732-5114-6', 'Biography', 6, 'B-03', [8, 9, 10, 11, 12], 295],
  ['The Jungle Book', 'Rudyard Kipling', 'Macmillan', '978-02-301-2345-1', 'Fiction', 4, 'C-01', [3, 4, 5, 6, 7], 150],
  ['Panchatantra Stories', 'Vishnu Sharma', 'Children’s Book Trust', '978-81-704-5201-3', 'Children', 10, 'C-05', [1, 2, 3, 4, 5], 95],
  ['Malgudi Days', 'R.K. Narayan', 'Indian Thought', '978-81-852-9001-7', 'Fiction', 5, 'C-02', [7, 8, 9, 10], 250],
  ['Tell Me Why — Science', 'Arvind Gupta', 'NBT India', '978-81-237-4430-8', 'Science', 7, 'D-01', [6, 7, 8], 160],
  ['Atlas of India', 'Oxford', 'Oxford University Press', '978-01-995-6789-0', 'Reference', 3, 'D-04', [6, 7, 8, 9, 10, 11, 12], 550],
  ['Mathematics Olympiad Workbook', 'RMO Trust', 'Prism Books', '978-81-721-8830-4', 'Mathematics', 4, 'E-02', [9, 10, 11, 12], 380],
  ['NEET Biology — Objective', 'Dr. S. Ravikumar', 'Sura Books', '978-81-234-9912-5', 'Competitive', 6, 'E-05', [11, 12], 695],
  ['Tamil Nadu Economy — A Reader', 'M. Vijayabaskar', 'Orient Blackswan', '978-81-250-6612-1', 'Social Science', 3, 'F-01', [11, 12], 480],
  ['Let Us C', 'Yashavant Kanetkar', 'BPB Publications', '978-81-831-7944-6', 'Computer Science', 5, 'E-08', [11, 12], 425],
].map(([title, author, publisher, isbn, category, copies, rack, forGrades, price], i) => ({
  id: `bok-${i + 1}`,
  schoolId: SCHOOL_ID,
  accessionNo: `ACC/${pad(i + 1)}${between(100, 999)}`,
  title,
  author,
  publisher,
  isbn,
  category,
  copies,
  rack,
  forGrades,
  price,
  addedOn: shift(-between(90, 900)),
}));
const books = bookSpec;

const loans = [];
students.forEach((st, i) => {
  if (i % 6 !== 0) return;
  const grade = classes.find((c) => c.id === st.classId).grade;
  const eligible = books.filter((b) => b.forGrades.includes(grade));
  if (!eligible.length) return;
  const book = eligible[i % eligible.length];
  const borrowedDaysAgo = between(3, 20);
  const borrowedOn = shift(-borrowedDaysAgo);
  const dueOn = shift(-borrowedDaysAgo + 14);
  const returned = i % 18 === 0;
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
    renewals: i % 12 === 0 ? 1 : 0,
    condition: i % 30 === 0 ? 'damaged' : 'good',
  });
});

/* ── notifications ───────────────────────────────────────────────────── */

const notifications = [];
let nSeq = 0;
const notify = (userId, title, body, kind, daysAgo, link, read = false, schoolId = SCHOOL_ID) =>
  notifications.push({
    id: `ntf-${++nSeq}`,
    userId,
    // A notice to everyone stays inside the branch that raised it.
    schoolId: userId === 'all' ? schoolId : undefined,
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
notify('usr-principal', 'Three staff applications awaiting review', 'Two are newly submitted and one is under review. Open Staff Recruitment to act on them.', 'staff', 0, '/recruitment');
notify('usr-transport', 'Fitness certificate expired — TN 38 AX 1207', 'The FC for Bus 1207 has lapsed. The vehicle should not run until it is renewed.', 'transport', 1, '/transport');
notify('all', 'Deepavali holidays announced', 'The school will remain closed for Deepavali. Buses will not operate.', 'system', 6, '/circulars', true);

/* ── parent–teacher meetings ─────────────────────────────────────────── */

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

/* ── gate visits ─────────────────────────────────────────────────────── */

const visitPurposes = ['Parent-Teacher Meeting', 'Meet a teacher', 'Fee payment', 'Collect child', 'Document collection'];
const visits = [];
let passSeq = 500;

students.forEach((st, i) => {
  if (i % 9 !== 0) return;
  passSeq += 1;
  const daysAgo = between(-6, 20);
  const past = daysAgo > 0;
  const guardian = users.find((u) => u.id === st.guardianIds[0]);
  const teacher = users.find(
    (u) => u.id === classes.find((c) => c.id === st.classId).classTeacherId,
  );
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
    status: past ? 'completed' : i % 18 === 0 ? 'requested' : 'approved',
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

/* ── school map ──────────────────────────────────────────────────────── */

const places = [
  ['Main Block', 'academic', 32, 24, 32, 20, '08:30 – 16:30', 'Classrooms for 6 to 12, staff room and the Principal’s office.'],
  ['Primary Block', 'academic', 32, 46, 32, 12, '08:45 – 15:30', 'Classrooms 1 to 5 with the Headmistress’s room and an activity hall.'],
  ['Science Laboratories', 'lab', 70, 16, 24, 20, '09:00 – 16:00', 'Physics, Chemistry, Botany and Zoology labs with practical batches.'],
  ['Computer Laboratory', 'lab', 70, 40, 24, 12, '09:00 – 16:00', '30 systems with broadband, used from Class 6 upward.'],
  ['Library', 'academic', 6, 18, 20, 16, '09:00 – 16:00', 'Over 6,000 Tamil and English titles, with a quiet reading area.'],
  ['School Office', 'admin', 6, 40, 20, 14, '09:00 – 15:30', 'Admissions, fee counter and certificate requests.'],
  ['Assembly Ground', 'sports', 30, 62, 34, 16, '08:15 onwards', 'Morning assembly, Annual Day and the sports meet.'],
  ['Canteen', 'amenity', 6, 60, 18, 14, '10:00 – 15:00', 'Mid-day meal counter and a snacks stall.'],
  ['Bus Bay', 'amenity', 70, 58, 24, 14, '07:30 & 15:30', 'Four school buses; children board here under staff supervision.'],
].map(([name, kind, x, y, w, h, open, detail], i) => ({
  id: `plc-${i + 1}`,
  schoolId: SCHOOL_ID,
  name,
  kind,
  x,
  y,
  w,
  h,
  open,
  detail,
}));

/* ── the Mettupalayam branch ──────────────────────────────────────────── */

/**
 * The trust's second school, which is a primary school only — classes 1 to 5.
 *
 * It exists so the branch switcher has somewhere real to go. A switcher that
 * lands on an empty school proves nothing, and a second copy of the same school
 * would prove less: the point a trust cares about is that its branches differ,
 * and that figures do not bleed between them.
 */

const B2 = 'sch-2';

const b2StaffSpec = [
  ['b2-hm', 'Mrs. S. Rajalakshmi', 'hm.mettupalayam@school.edu', ['correspondent'], 'headmaster', 'M.A., B.Ed.', 10],
  ['b2-office', 'Mr. K. Thirumurugan', 'office.mettupalayam@school.edu', ['office-superintendent', 'accounts-officer'], 'office-superintendent', 'B.Com.', 6],
  ['b2-s1', 'Mrs. A. Kousalya', 'kousalya@school.edu', ['subject-teacher'], 'sgt', 'D.T.Ed., B.A.', 8],
  ['b2-s2', 'Mrs. M. Indirani', 'indirani@school.edu', ['subject-teacher'], 'sgt', 'D.T.Ed., B.Sc.', 5],
  ['b2-s3', 'Mrs. R. Chandraleka', 'chandraleka@school.edu', ['subject-teacher'], 'sgt', 'D.T.Ed., B.A.', 4],
  ['b2-s4', 'Mrs. P. Tamilarasi', 'tamilarasi@school.edu', ['subject-teacher'], 'sgt', 'D.T.Ed., B.A.', 7],
  ['b2-s5', 'Mrs. G. Nithyakalyani', 'nithyakalyani@school.edu', ['subject-teacher'], 'sgt', 'D.T.Ed., B.Sc.', 3],
  ['b2-pe', 'Mr. V. Sakthivel', 'sakthivel@school.edu', ['subject-teacher'], 'pet', 'B.P.Ed.', 2],
];

b2StaffSpec.forEach(([key, name, email, roles, designation, qualification, years], i) => {
  users.push({
    id: `usr-${key}`,
    schoolId: B2,
    name,
    email,
    password: 'Branch@123',
    roles,
    phone: `+91 98430 4${pad(i + 10)}0`,
    status: 'active',
    joinedOn: `${AY_START_YEAR - years}-06-01`,
    avatarHue: (i * 61 + 140) % 360,
    employeeId: `EMP-M${pad(i + 1)}`,
    designation,
    qualification,
    tetCleared: designation === 'sgt',
    dateOfJoining: `${AY_START_YEAR - years}-06-01`,
    subjectIds: designation === 'pet' ? ['sub-pe'] : ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs'],
  });
});

// Classes 1 to 5, one section each, a little smaller than the main campus.
const b2Classes = [1, 2, 3, 4, 5].map((grade) => ({
  id: `cls-m${grade}A`,
  schoolId: B2,
  grade,
  section: 'A',
  label: `${grade}-A`,
  stage: 'primary',
  hscGroupId: undefined,
  classTeacherId: `usr-b2-s${grade}`,
  room: `Room ${grade}`,
  strength: 26,
}));
classes.push(...b2Classes);

for (const cls of b2Classes) {
  const t = users.find((u) => u.id === cls.classTeacherId);
  if (t && !t.roles.includes('class-teacher')) t.roles.push('class-teacher');
  // A Secondary Grade Teacher takes every subject of their own class; games
  // goes to the PET, as it does everywhere.
  ['sub-tam1', 'sub-eng1', 'sub-mat1', 'sub-evs', 'sub-pe'].forEach((subjectId) => {
    const sub = subjectById(subjectId);
    classSubjects.push({
      id: `csub-${++csSeq}`,
      classId: cls.id,
      subjectId,
      teacherId: subjectId === 'sub-pe' ? 'usr-b2-pe' : cls.classTeacherId,
      periodsPerWeek: sub.kind === 'co-curricular' ? 2 : sub.kind === 'language' ? 6 : 5,
    });
  });
}

const b2Students = [];
b2Classes.forEach((cls) => {
  for (let r = 1; r <= cls.strength; r++) {
    const isBoy = (r + cls.grade) % 2 === 1;
    const first = isBoy
      ? boyNames[(r * 7 + cls.grade) % boyNames.length]
      : girlNames[(r * 11 + cls.grade) % girlNames.length];
    const initial = surnameInitials[(r * 3 + cls.grade) % surnameInitials.length];
    const sid = `stu-m${cls.grade}A-${pad(r)}`;
    const pid = `par-m${cls.grade}A-${pad(r)}`;
    admissionSeq += 1;

    const student = {
      id: sid,
      schoolId: B2,
      name: `${first} ${initial}.`,
      email: `${first.toLowerCase()}.${admissionSeq}@student.school.edu`,
      password: 'Student@123',
      roles: ['student'],
      // A branch issues its own admission numbers.
      admissionNo: `SVMM${AY_START_YEAR}${admissionSeq}`,
      rollNo: r,
      classId: cls.id,
      dateOfBirth: `${AY_START_YEAR - cls.grade - 5}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
      bloodGroup: pick(bloodGroups),
      guardianIds: [pid],
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      status: 'active',
      joinedOn: `${AY_START_YEAR - between(0, 3)}-06-05`,
      avatarHue: (r * 41 + cls.grade * 17) % 360,
    };
    b2Students.push(student);
    users.push(student);

    users.push({
      id: pid,
      schoolId: B2,
      name: `${initial}. ${r % 2 === 0 ? fatherNames[(r + cls.grade) % fatherNames.length] : motherNames[(r * 2 + cls.grade) % motherNames.length]}`,
      email: `parent.${admissionSeq}@gmail.com`,
      password: 'Parent@123',
      roles: ['parent'],
      childIds: [sid],
      occupation: occupations[(r * 3 + cls.grade) % occupations.length],
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      status: 'active',
      joinedOn: `${AY_START_YEAR}-06-05`,
      avatarHue: (r * 23 + 90) % 360,
    });
  }
});

// The same clash-free builder, so this branch's week is sound too.
buildWeek(b2Classes);

// This branch keeps better attendance than the main campus — smaller, closer.
const B2_ABSENCE = { 'cls-m1A': 6, 'cls-m2A': 5, 'cls-m3A': 4, 'cls-m4A': 4, 'cls-m5A': 3 };

b2Students.forEach((st, si) => {
  const absenceRate = B2_ABSENCE[st.classId] ?? 5;
  const irregular = si % 13 === 0 ? 8 : 0;
  schoolDays.forEach((date, di) => {
    const roll = (si * 11 + di * 7 + di * si) % 100;
    let status = 'present';
    if (roll < absenceRate + irregular) status = 'absent';
    else if (roll < absenceRate + irregular + 2) status = 'late';
    attendance.push({
      id: `att-${st.id}-${date}`,
      studentId: st.id,
      date,
      status,
      markedBy: b2Classes.find((c) => c.id === st.classId)?.classTeacherId,
    });
  });
});

// Marks for the exams already sat, so a report card is not blank.
b2Students.forEach((st, si) => {
  const cls = b2Classes.find((c) => c.id === st.classId);
  const offered = classSubjects
    .filter((cs) => cs.classId === cls.id)
    .filter((cs) => subjectById(cs.subjectId).kind !== 'co-curricular');
  exams
    .filter((e) => e.grade === cls.grade && e.published)
    .forEach((exam) => {
      offered.forEach((cs, bi) => {
        const span = subjectById(cs.subjectId).maxMarks;
        const base = Math.round(span * (0.5 + ((si * 5 + bi * 13 + exam.shortName.length * 3) % 45) / 100));
        marks.push({
          id: `mk-${st.id}-${exam.id}-${cs.subjectId}`,
          studentId: st.id,
          examId: exam.id,
          subjectId: cs.subjectId,
          marks: Math.min(span, base),
          maxMarks: span,
          practicalMarks: null,
        });
      });
    });
});

// Fees — this branch charges less than the main campus, as a smaller town does.
b2Students.forEach((st, si) => {
  const grade = b2Classes.find((c) => c.id === st.classId).grade;
  const tuition = 2400 + grade * 150;
  [
    ['Tuition Fee — Term 1', 1, tuition, -75],
    ['Tuition Fee — Term 2', 2, tuition, 12],
    ['Tuition Fee — Term 3', 3, tuition, 110],
    ['Books & Uniform', 0, 1500 + grade * 120, -85],
  ].forEach(([head, term, total, dueOffset], hi) => {
    const past = dueOffset < 0;
    const reliability = ((si * 7) % 10) < 6 ? 0 : ((si * 7) % 10) < 9 ? 1 : 2;
    const state = past
      ? reliability === 0 ? 'paid' : reliability === 1 ? ((si + hi) % 4 === 0 ? 'partial' : 'paid') : ((si + hi) % 3 === 0 ? 'due' : 'partial')
      : reliability === 0 ? ((si + hi) % 2 === 0 ? 'paid' : 'due') : 'due';
    const paid = state === 'paid' ? total : state === 'partial' ? Math.round((total * 0.5) / 100) * 100 : 0;
    const id = `fee-${st.id}-${hi}`;
    fees.push({ id, studentId: st.id, head, term, total, paid, dueOn: shift(dueOffset), concession: 0 });
    if (paid > 0) {
      receiptSeq += 1;
      payments.push({
        id: `pay-${st.id}-${hi}`,
        studentId: st.id,
        feeId: id,
        amount: paid,
        method: pick(['upi', 'cash', 'netbanking']),
        paidOn: shift(dueOffset - between(1, 8)),
        reference: `TXN${AY_START_YEAR}${between(100000, 999999)}`,
        receiptNo: `RCP/M/${AY_START_YEAR}/${receiptSeq}`,
      });
    }
  });
});

// Salary and payslips for the branch's own staff.
users
  .filter((u) => u.schoolId === B2 && u.employeeId)
  .forEach((st, i) => {
    const basic = SCALE[st.designation] ?? 20000;
    const da = Math.round(basic * 0.18);
    const hra = Math.round(basic * 0.1);
    const pf = Math.round(Math.min(basic, 15000) * 0.12);
    const esi = basic + da <= 21000 ? Math.round((basic + da) * 0.0075) : 0;
    const professionalTax = basic >= 21000 ? 208 : 135;
    salaries.push({
      id: `sal-${st.id}`,
      staffId: st.id,
      basic,
      da,
      hra,
      conveyance: 1200,
      otherAllowance: 0,
      pf,
      esi,
      professionalTax,
    });
    const gross = basic + da + hra + 1200;
    const deductions = pf + esi + professionalTax;
    for (let back = 2; back >= 0; back--) {
      const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - back, 1);
      payslips.push({
        id: `slip-${++slipSeq}`,
        staffId: st.id,
        month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
        gross,
        deductions,
        net: gross - deductions,
        lopDays: 0,
        status: back === 0 ? 'draft' : 'paid',
        paidOn: back === 0 ? undefined : iso(new Date(d.getFullYear(), d.getMonth() + 1, 1)),
      });
    }
  });

// One bus, one route.
vehicles.push({
  id: 'veh-m1',
  schoolId: B2,
  busNo: 'TN 43 BX 7781',
  model: 'Eicher Skyline 32',
  capacity: 32,
  driverName: 'N. Subramani',
  driverPhone: '+91 99445 41001',
  driverLicenceNo: 'TN43 20130004412',
  attendantName: 'Mrs. S. Jothi',
  attendantPhone: '+91 99445 51001',
  fcExpiry: shift(175),
  insuranceExpiry: shift(80),
  permitExpiry: shift(390),
});

routes.push({
  id: 'rt-m1',
  schoolId: B2,
  name: 'Route 1 — Annur Road',
  vehicleId: 'veh-m1',
  fee: 6000,
  stops: ['Annur Road Junction', 'Sirumugai Road', 'Karamadai Bypass', 'Mettupalayam Bus Stand'].map(
    (name, si) => ({ name, time: `0${7 + Math.floor((si * 10) / 60)}:${pad((si * 10) % 60)}` }),
  ),
});

let b2Seats = 32;
b2Students.forEach((st, i) => {
  if (i % 4 !== 0) return;
  const status = i % 20 === 0 ? 'requested' : b2Seats > 0 ? 'allotted' : null;
  if (!status) return;
  if (status === 'allotted') b2Seats -= 1;
  studentTransport.push({
    id: `stt-${st.id}`,
    studentId: st.id,
    routeId: 'rt-m1',
    stop: routes.at(-1).stops[i % 4].name,
    status,
    requestedOn: shift(-between(20, 100)),
  });
});

// A small library, and its own circulars.
[
  ['Panchatantra Stories', 'Vishnu Sharma', 'Children', 8, 'A-01', [1, 2, 3, 4, 5], 95],
  ['Aesop’s Fables', 'Aesop', 'Children', 6, 'A-02', [1, 2, 3, 4, 5], 110],
  ['Thirukkural for Children', 'Thiruvalluvar', 'Tamil Literature', 5, 'B-01', [3, 4, 5], 140],
  ['My First Atlas', 'Oxford', 'Reference', 3, 'B-04', [3, 4, 5], 320],
].forEach(([title, author, category, copies, rack, forGrades, price], i) => {
  books.push({
    id: `bok-m${i + 1}`,
    schoolId: B2,
    accessionNo: `ACM/${pad(i + 1)}${between(100, 999)}`,
    title,
    author,
    publisher: 'Children’s Book Trust',
    isbn: `978-81-704-${between(1000, 9999)}-${between(0, 9)}`,
    category,
    copies,
    rack,
    forGrades,
    price,
    addedOn: shift(-between(120, 700)),
  });
});

b2Students.forEach((st, i) => {
  if (i % 9 !== 0) return;
  const book = books.filter((b) => b.schoolId === B2)[i % 4];
  const ago = between(3, 18);
  loans.push({
    id: `lon-${st.id}`,
    bookId: book.id,
    studentId: st.id,
    borrowedOn: shift(-ago),
    dueOn: shift(-ago + 14),
    returnedOn: null,
    fine: 0,
    renewals: 0,
    condition: 'good',
  });
});

[
  ['Annual Day — Mettupalayam', 'ஆண்டு விழா', 'Event', 'Our branch Annual Day will be held in the school hall. Parents of all classes are invited. Children taking part in the dance items will have practice after school.', true, 3],
  ['Summer uniform from Monday', 'கோடை சீருடை', 'General', 'Children may wear the summer uniform from Monday onward. Caps and water bottles are compulsory for the games period.', false, 9],
].forEach(([title, titleTa, category, body, pinned, daysAgo], i) => {
  circulars.push({
    id: `cir-m${i + 1}`,
    schoolId: B2,
    title,
    titleTa,
    body,
    category,
    postedOn: shift(-daysAgo),
    author: 'Headmistress’s Office',
    pinned,
    audience: 'all',
    acknowledgedBy: [],
  });
});

events.push({
  id: 'evt-m1',
  schoolId: B2,
  title: 'Annual Day — Mettupalayam',
  description: 'Dance, drama and prize distribution for classes 1 to 5.',
  category: 'Cultural',
  date: shift(21),
  time: '16:30',
  venue: 'School Hall',
  organiser: 'Headmistress’s Office',
  forClasses: 'all',
});

[
  ['Main Block', 'academic', 30, 28, 36, 24, '08:45 – 15:30', 'Classrooms 1 to 5 and the Headmistress’s room.'],
  ['School Office', 'admin', 6, 30, 20, 16, '09:00 – 15:30', 'Admissions and the fee counter.'],
  ['Play Area', 'sports', 30, 58, 36, 20, '08:30 onwards', 'Morning assembly and the games period.'],
  ['Library', 'academic', 72, 28, 22, 18, '09:30 – 15:00', 'A reading room for the primary classes.'],
].forEach(([name, kind, x, y, w, h, open, detail], i) => {
  places.push({ id: `plc-m${i + 1}`, schoolId: B2, name, kind, x, y, w, h, open, detail });
});

notify('usr-b2-hm', 'Term 2 fee reminders are due', 'Twenty-one families have Term 2 tuition outstanding. The office can send reminders from the Fees page.', 'fee', 1, '/fees');

/* ── emit ────────────────────────────────────────────────────────────── */

const db = {
  group, schools, hscGroups, classes, subjects, classSubjects, users,
  applications, leaves, substitutions, timetable,
  labs, labBatches, labItems, labBreakages,
  attendance, homework, homeworkStatus, exams, marks,
  fees, payments, salaries, payslips,
  circulars, events, requests, meetingSlots, meetingBookings, visits,
  vehicles, routes, studentTransport, books, loans, notifications, places,
};

for (const [name, rows] of Object.entries(db)) write(name, rows);

console.log(
  `Seeded ${ACADEMIC_YEAR}, term ${CURRENT_TERM}, ${classes.length} classes, ${students.length} students, ${schoolDays.length} school days\n`,
);
let total = 0;
for (const [k, v] of Object.entries(db)) {
  total += v.length;
  console.log(`  ${k.padEnd(18)} ${String(v.length).padStart(6)}`);
}
console.log(`  ${'TOTAL'.padEnd(18)} ${String(total).padStart(6)} rows`);
console.log(`\nDemo child: ${DEMO_STUDENT?.name} (8-A, roll ${DEMO_STUDENT?.rollNo})`);
console.log(`Substitutions arranged today: ${substitutions.length}`);
