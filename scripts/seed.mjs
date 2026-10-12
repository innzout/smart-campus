/**
 * Seed generator for the college demo database.
 *
 * Models a Tamil Nadu autonomous arts and science college affiliated to
 * Bharathiar University: departments, programmes, batches moving through
 * semesters, courses carrying credits, per-hour attendance, internal plus
 * end-semester assessment producing a GPA and a CGPA, arrears, placements and
 * a hostel.
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
let seed = 20261012;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const write = (name, data) =>
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data, null, 2) + '\n');

const pad = (n, w = 2) => String(n).padStart(w, '0');
const TODAY = new Date();
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (days) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return iso(d);
};
const TODAY_ISO = iso(TODAY);

/* A Tamil Nadu academic year runs June to April; odd semesters sit in it first. */
const month = TODAY.getMonth();
const AY_START = month >= 5 ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
const ACADEMIC_YEAR = `${AY_START}-${String(AY_START + 1).slice(2)}`;
const TERM = month >= 5 && month <= 10 ? 'odd' : 'even';
/** Semesters in session: the odd term teaches 1, 3, 5; the even term 2, 4, 6. */
const SEM_OFFSET = TERM === 'odd' ? 1 : 2;

/* ── the trust and the college ─────────────────────────────────────────── */

const group = [
  {
    id: 'grp-1',
    name: 'Sri Vidya Educational Trust',
    trustName: 'Sri Vidya Educational and Charitable Trust',
    registrationNo: `TN/CBE/TRUST/${AY_START - 24}/318`,
    chairman: 'Mr. V. Ramanathan',
    address: 'Saravanampatti, Coimbatore 641035, Tamil Nadu',
    phone: '+91 422 265 4400',
    email: 'trust@srividya.edu.in',
  },
];

const COLLEGE_ID = 'col-1';

const colleges = [
  {
    id: COLLEGE_ID,
    groupId: 'grp-1',
    name: 'Sri Vidya Arts and Science College (Autonomous)',
    shortName: 'Sri Vidya College',
    code: 'C-41238',
    affiliatedTo: 'Bharathiar University, Coimbatore',
    autonomous: true,
    naacGrade: 'A+ (CGPA 3.41)',
    tagline: 'அறிவே ஆற்றல்',
    taglineEn: 'Knowledge is power',
    address: 'Saravanampatti Main Road',
    city: 'Coimbatore',
    phone: '+91 422 265 4400',
    email: 'office@srividyacollege.ac.in',
    academicYear: ACADEMIC_YEAR,
    currentTerm: TERM,
    isMain: true,
    // The date this data was generated. The app shifts every date forward by
    // whole weeks from here, so a deployed demo never goes stale.
    seededOn: TODAY_ISO,
  },
];

/* ── departments and programmes ────────────────────────────────────────── */

const departmentSpec = [
  ['cs', 'Computer Science', 'CS', 1998],
  ['com', 'Commerce', 'COM', 1992],
  ['mgt', 'Management Studies', 'MGT', 2004],
  ['mat', 'Mathematics', 'MAT', 1992],
  ['eng', 'English', 'ENG', 1992],
];

const departments = departmentSpec.map(([id, name, shortName, establishedIn]) => ({
  id: `dep-${id}`,
  collegeId: COLLEGE_ID,
  name,
  shortName,
  hodId: '',
  establishedIn,
}));

const programmeSpec = [
  // id, dept, name, short, level, years, intake, register-number code
  ['bsc-cs', 'cs', 'B.Sc. Computer Science', 'B.Sc. CS', 'ug', 3, 36, 'UCS'],
  ['bca', 'cs', 'Bachelor of Computer Applications', 'B.C.A.', 'ug', 3, 36, 'UCA'],
  ['bcom', 'com', 'B.Com. (Computer Applications)', 'B.Com. CA', 'ug', 3, 36, 'UCM'],
  ['bba', 'mgt', 'Bachelor of Business Administration', 'B.B.A.', 'ug', 3, 36, 'UBA'],
  ['msc-cs', 'cs', 'M.Sc. Computer Science', 'M.Sc. CS', 'pg', 2, 18, 'PCS'],
];

const programmes = programmeSpec.map(
  ([id, dep, name, shortName, level, durationYears, intake, code]) => ({
    id: `prg-${id}`,
    collegeId: COLLEGE_ID,
    departmentId: `dep-${dep}`,
    name,
    shortName,
    level,
    durationYears,
    semesters: durationYears * 2,
    totalCredits: level === 'pg' ? 90 : 140,
    intake,
    selfFinancing: true,
    code,
  }),
);
const programmeById = (id) => programmes.find((p) => p.id === id);

/* ── the syllabus ──────────────────────────────────────────────────────── */

/**
 * Courses by programme and semester. Real paper titles matter: a correspondent
 * reads "Data Structures" and recognises their own syllabus, where "Core Paper
 * III" tells them nothing.
 *
 * Each entry is [title, kind, credits, hours a week].
 */
const SYLLABUS = {
  'prg-bsc-cs': {
    1: [
      ['Tamil — Paper I', 'language', 3, 5],
      ['Communicative English — Paper I', 'language', 3, 5],
      ['Programming in C', 'core', 5, 5],
      ['Digital Fundamentals and Computer Organisation', 'core', 4, 4],
      ['Programming in C — Practical', 'practical', 3, 4],
      ['Allied Mathematics — I', 'allied', 4, 4],
    ],
    2: [
      ['Tamil — Paper II', 'language', 3, 5],
      ['Communicative English — Paper II', 'language', 3, 5],
      ['Object Oriented Programming with C++', 'core', 5, 5],
      ['Data Structures', 'core', 4, 4],
      ['C++ and Data Structures — Practical', 'practical', 3, 4],
      ['Allied Mathematics — II', 'allied', 4, 4],
    ],
    3: [
      ['Java Programming', 'core', 5, 5],
      ['Database Management Systems', 'core', 5, 5],
      ['Operating Systems', 'core', 4, 4],
      ['Java and DBMS — Practical', 'practical', 3, 4],
      ['Allied Statistics', 'allied', 4, 4],
      ['Soft Skills and Personality Development', 'skill', 2, 2],
    ],
    4: [
      ['Python Programming', 'core', 5, 5],
      ['Computer Networks', 'core', 4, 4],
      ['Software Engineering', 'core', 4, 4],
      ['Python — Practical', 'practical', 3, 4],
      ['Allied Numerical Methods', 'allied', 4, 4],
      ['Environmental Studies', 'skill', 2, 2],
    ],
    5: [
      ['Web Technology', 'core', 5, 5],
      ['Data Mining and Warehousing', 'core', 4, 4],
      ['Computer Graphics and Multimedia', 'core', 4, 4],
      ['Web Technology — Practical', 'practical', 3, 4],
      ['Elective — Cloud Computing', 'elective', 4, 4],
      ['Elective — Mobile Application Development', 'elective', 4, 4],
    ],
    6: [
      ['Artificial Intelligence and Machine Learning', 'core', 5, 5],
      ['Cyber Security and Cryptography', 'core', 4, 4],
      ['Project Work and Viva Voce', 'project', 8, 8],
      ['Elective — Internet of Things', 'elective', 4, 4],
      ['Elective — Big Data Analytics', 'elective', 4, 4],
    ],
  },
  'prg-bca': {
    1: [
      ['Tamil — Paper I', 'language', 3, 5],
      ['Communicative English — Paper I', 'language', 3, 5],
      ['Fundamentals of Information Technology', 'core', 4, 5],
      ['Programming in C', 'core', 5, 5],
      ['Office Automation — Practical', 'practical', 3, 4],
      ['Allied Business Mathematics', 'allied', 4, 4],
    ],
    2: [
      ['Tamil — Paper II', 'language', 3, 5],
      ['Communicative English — Paper II', 'language', 3, 5],
      ['Data Structures using C', 'core', 5, 5],
      ['Digital Computer Fundamentals', 'core', 4, 4],
      ['Data Structures — Practical', 'practical', 3, 4],
      ['Allied Statistics', 'allied', 4, 4],
    ],
    3: [
      ['Object Oriented Programming with Java', 'core', 5, 5],
      ['Relational Database Management Systems', 'core', 5, 5],
      ['Visual Programming', 'core', 4, 4],
      ['Java and RDBMS — Practical', 'practical', 3, 4],
      ['Allied Financial Accounting', 'allied', 4, 4],
      ['Soft Skills and Personality Development', 'skill', 2, 2],
    ],
    4: [
      ['Web Design and Development', 'core', 5, 5],
      ['Operating Systems', 'core', 4, 4],
      ['Software Engineering', 'core', 4, 4],
      ['Web Design — Practical', 'practical', 3, 4],
      ['Allied Cost Accounting', 'allied', 4, 4],
      ['Environmental Studies', 'skill', 2, 2],
    ],
    5: [
      ['Python Programming', 'core', 5, 5],
      ['Computer Networks', 'core', 4, 4],
      ['Enterprise Resource Planning', 'core', 4, 4],
      ['Python — Practical', 'practical', 3, 4],
      ['Elective — Cloud Computing', 'elective', 4, 4],
      ['Elective — Digital Marketing', 'elective', 4, 4],
    ],
    6: [
      ['Mobile Application Development', 'core', 5, 5],
      ['Information Security', 'core', 4, 4],
      ['Project Work and Viva Voce', 'project', 8, 8],
      ['Elective — Data Analytics', 'elective', 4, 4],
      ['Elective — E-Commerce', 'elective', 4, 4],
    ],
  },
  'prg-bcom': {
    1: [
      ['Tamil — Paper I', 'language', 3, 5],
      ['Communicative English — Paper I', 'language', 3, 5],
      ['Financial Accounting — I', 'core', 5, 5],
      ['Principles of Commerce', 'core', 4, 4],
      ['Computer Applications — Practical', 'practical', 3, 4],
      ['Allied Business Economics', 'allied', 4, 4],
    ],
    2: [
      ['Tamil — Paper II', 'language', 3, 5],
      ['Communicative English — Paper II', 'language', 3, 5],
      ['Financial Accounting — II', 'core', 5, 5],
      ['Business Law', 'core', 4, 4],
      ['Tally and Accounting Packages — Practical', 'practical', 3, 4],
      ['Allied Business Statistics', 'allied', 4, 4],
    ],
    3: [
      ['Corporate Accounting', 'core', 5, 5],
      ['Banking Theory, Law and Practice', 'core', 4, 4],
      ['Business Management', 'core', 4, 4],
      ['Database and MIS — Practical', 'practical', 3, 4],
      ['Allied Mathematics for Commerce', 'allied', 4, 4],
      ['Soft Skills and Personality Development', 'skill', 2, 2],
    ],
    4: [
      ['Cost Accounting', 'core', 5, 5],
      ['Income Tax Law and Practice', 'core', 5, 5],
      ['Entrepreneurial Development', 'core', 4, 4],
      ['E-Commerce — Practical', 'practical', 3, 4],
      ['Allied Marketing Management', 'allied', 4, 4],
      ['Environmental Studies', 'skill', 2, 2],
    ],
    5: [
      ['Management Accounting', 'core', 5, 5],
      ['Auditing and Assurance', 'core', 4, 4],
      ['Goods and Services Tax', 'core', 4, 4],
      ['Computerised Accounting — Practical', 'practical', 3, 4],
      ['Elective — Financial Markets', 'elective', 4, 4],
      ['Elective — Human Resource Management', 'elective', 4, 4],
    ],
    6: [
      ['Corporate Law and Secretarial Practice', 'core', 5, 5],
      ['Financial Management', 'core', 4, 4],
      ['Project Work and Viva Voce', 'project', 8, 8],
      ['Elective — International Business', 'elective', 4, 4],
      ['Elective — Investment Management', 'elective', 4, 4],
    ],
  },
  'prg-bba': {
    1: [
      ['Tamil — Paper I', 'language', 3, 5],
      ['Communicative English — Paper I', 'language', 3, 5],
      ['Principles of Management', 'core', 5, 5],
      ['Business Environment', 'core', 4, 4],
      ['Computer Applications — Practical', 'practical', 3, 4],
      ['Allied Business Economics', 'allied', 4, 4],
    ],
    2: [
      ['Tamil — Paper II', 'language', 3, 5],
      ['Communicative English — Paper II', 'language', 3, 5],
      ['Organisational Behaviour', 'core', 5, 5],
      ['Financial Accounting for Managers', 'core', 4, 4],
      ['Business Analytics — Practical', 'practical', 3, 4],
      ['Allied Business Statistics', 'allied', 4, 4],
    ],
    3: [
      ['Marketing Management', 'core', 5, 5],
      ['Human Resource Management', 'core', 5, 5],
      ['Business Communication', 'core', 4, 4],
      ['Spreadsheet Modelling — Practical', 'practical', 3, 4],
      ['Allied Business Law', 'allied', 4, 4],
      ['Soft Skills and Personality Development', 'skill', 2, 2],
    ],
    4: [
      ['Financial Management', 'core', 5, 5],
      ['Production and Operations Management', 'core', 4, 4],
      ['Entrepreneurial Development', 'core', 4, 4],
      ['Digital Marketing — Practical', 'practical', 3, 4],
      ['Allied Cost and Management Accounting', 'allied', 4, 4],
      ['Environmental Studies', 'skill', 2, 2],
    ],
    5: [
      ['Strategic Management', 'core', 5, 5],
      ['Services Marketing', 'core', 4, 4],
      ['Supply Chain Management', 'core', 4, 4],
      ['Business Research — Practical', 'practical', 3, 4],
      ['Elective — Retail Management', 'elective', 4, 4],
      ['Elective — Banking and Insurance', 'elective', 4, 4],
    ],
    6: [
      ['International Business Management', 'core', 5, 5],
      ['Project Management', 'core', 4, 4],
      ['Project Work and Viva Voce', 'project', 8, 8],
      ['Elective — Event Management', 'elective', 4, 4],
      ['Elective — Rural Marketing', 'elective', 4, 4],
    ],
  },
  'prg-msc-cs': {
    1: [
      ['Advanced Data Structures and Algorithms', 'core', 5, 5],
      ['Advanced Java Programming', 'core', 5, 5],
      ['Advanced Operating Systems', 'core', 4, 4],
      ['Advanced Java — Practical', 'practical', 4, 5],
      ['Elective — Machine Learning', 'elective', 4, 4],
    ],
    2: [
      ['Design and Analysis of Algorithms', 'core', 5, 5],
      ['Advanced Database Technology', 'core', 5, 5],
      ['Distributed Computing', 'core', 4, 4],
      ['Database Technology — Practical', 'practical', 4, 5],
      ['Elective — Deep Learning', 'elective', 4, 4],
    ],
    3: [
      ['Cloud Computing and Virtualisation', 'core', 5, 5],
      ['Data Science and Analytics', 'core', 5, 5],
      ['Compiler Design', 'core', 4, 4],
      ['Data Science — Practical', 'practical', 4, 5],
      ['Elective — Natural Language Processing', 'elective', 4, 4],
    ],
    4: [
      ['Research Methodology', 'core', 4, 4],
      ['Project Work and Viva Voce', 'project', 12, 12],
      ['Elective — Blockchain Technology', 'elective', 4, 4],
    ],
  },
};

const courses = [];
for (const [programmeId, bySem] of Object.entries(SYLLABUS)) {
  const prog = programmeById(programmeId);
  for (const [semStr, papers] of Object.entries(bySem)) {
    const semester = Number(semStr);
    papers.forEach(([title, kind, credits, hoursPerWeek], i) => {
      const practical = kind === 'practical';
      courses.push({
        id: `crs-${programmeId.replace('prg-', '')}-${semester}-${i + 1}`,
        // Autonomous course codes: year, level, department, semester, number.
        code: `${String(AY_START).slice(2)}${prog.code}${semester}${pad(i + 1)}`,
        title,
        programmeId,
        semester,
        kind,
        credits,
        hoursPerWeek,
        // A practical is marked 40 internal / 60 external; theory 25 / 75.
        ciaMax: practical ? 40 : 25,
        eseMax: practical ? 60 : 75,
        labKind: practical ? 'computer' : undefined,
      });
    });
  }
}
const courseById = (id) => courses.find((c) => c.id === id);
const coursesFor = (programmeId, semester) =>
  courses.filter((c) => c.programmeId === programmeId && c.semester === semester);

/* ── staff ─────────────────────────────────────────────────────────────── */

const users = [];

const officeSpec = [
  ['usr-admin', 'Mr. V. Ramanathan', 'admin@college.edu', 'Admin@123', ['group-admin', 'chairman'], 'chairman', '', 'M.Com., MBA', 258, 22],
  ['usr-principal', 'Dr. R. Chitra', 'principal@college.edu', 'Principal@123', ['principal'], 'principal', 'dep-eng', 'M.A., M.Phil., Ph.D.', 320, 18],
  ['usr-vp', 'Dr. D. Sundaramoorthy', 'vp@college.edu', 'Vp@123', ['vice-principal'], 'vice-principal', 'dep-mat', 'M.Sc., Ph.D.', 200, 15],
  ['usr-coe', 'Dr. S. Meenakshi', 'coe@college.edu', 'Coe@123', ['controller-of-exams'], 'dean', 'dep-com', 'M.Com., Ph.D.', 12, 16],
  ['usr-office', 'Mrs. L. Punithavathi', 'office@college.edu', 'Office@123', ['office-superintendent'], 'office-superintendent', '', 'B.Com.', 40, 11],
  ['usr-accounts', 'Mr. A. Saravanan', 'accounts@college.edu', 'Accounts@123', ['accounts-officer', 'payroll-officer'], 'accounts-officer', '', 'B.Com., CA Inter', 150, 9],
  ['usr-placement', 'Mr. K. Gowtham', 'placement@college.edu', 'Placement@123', ['placement-officer'], 'placement-officer', 'dep-mgt', 'MBA', 95, 7],
  ['usr-librarian', 'Mrs. S. Hemalatha', 'library@college.edu', 'Library@123', ['librarian'], 'librarian', '', 'M.L.I.Sc., M.Phil.', 110, 8],
  ['usr-transport', 'Mr. P. Rajamani', 'transport@college.edu', 'Transport@123', ['transport-incharge'], 'office-assistant', '', 'Diploma (Mech.)', 25, 12],
  ['usr-warden-m', 'Mr. T. Elangovan', 'warden.men@college.edu', 'Warden@123', ['hostel-warden'], 'assistant-professor', 'dep-mat', 'M.Sc., M.Phil.', 180, 10],
  ['usr-warden-w', 'Mrs. G. Anitha', 'warden.women@college.edu', 'Warden@123', ['hostel-warden'], 'assistant-professor', 'dep-eng', 'M.A., M.Phil.', 300, 9],
  ['usr-lab1', 'Mr. C. Ezhilarasan', 'lab1@college.edu', 'Lab@123', ['lab-instructor'], 'lab-instructor', 'dep-cs', 'M.Sc. (CS)', 280, 6],
  ['usr-lab2', 'Mrs. J. Kanimozhi', 'lab2@college.edu', 'Lab@123', ['lab-instructor'], 'lab-instructor', 'dep-cs', 'M.C.A.', 340, 4],
];

officeSpec.forEach(([id, name, email, password, roles, designation, departmentId, qualification, hue, years], i) => {
  users.push({
    id,
    collegeId: COLLEGE_ID,
    name,
    email,
    password,
    roles,
    phone: `+91 98430 1${pad(i)}0${i}`,
    status: 'active',
    joinedOn: `${AY_START - years}-06-01`,
    avatarHue: hue,
    employeeId: `EMP-${pad(i + 1)}`,
    designation,
    departmentId: departmentId || undefined,
    qualification,
    netCleared: ['principal', 'vice-principal', 'dean'].includes(designation),
    experienceYears: years,
    dateOfJoining: `${AY_START - years}-06-01`,
    courseIds: [],
  });
});

/** Teaching staff belong to a department, and what they may teach follows. */
const facultySpec = [
  ['cs', 'f1', 'Dr. N. Chandrasekaran', 'professor', 'M.Sc., M.Phil., Ph.D.', true, 19],
  ['cs', 'f2', 'Dr. S. Balasubramanian', 'associate-professor', 'M.C.A., Ph.D.', true, 14],
  ['cs', 'f3', 'Mrs. R. Hemavathi', 'assistant-professor', 'M.Sc., M.Phil.', true, 9],
  ['cs', 'f4', 'Mr. K. Arunkumar', 'assistant-professor', 'M.C.A., M.Phil.', false, 7],
  ['cs', 'f5', 'Mrs. V. Shanthakumari', 'assistant-professor', 'M.Sc. (CS), NET', true, 6],
  ['cs', 'f6', 'Mr. G. Ravichandran', 'assistant-professor', 'M.Sc. (IT)', false, 5],
  ['cs', 'f7', 'Mrs. D. Kalaiselvi', 'assistant-professor', 'M.C.A.', false, 4],

  ['com', 'f8', 'Dr. S. Muthukrishnan', 'professor', 'M.Com., M.Phil., Ph.D.', true, 21],
  ['com', 'f9', 'Mrs. B. Lalithambikai', 'associate-professor', 'M.Com., M.Phil.', true, 13],
  ['com', 'f10', 'Mr. P. Senthilnathan', 'assistant-professor', 'M.Com., NET', true, 8],
  ['com', 'f11', 'Mrs. E. Thenmozhi', 'assistant-professor', 'M.Com., M.Phil.', false, 6],
  ['com', 'f12', 'Mr. R. Vetrivel', 'assistant-professor', 'M.Com.', false, 4],

  ['mgt', 'f13', 'Dr. C. Shobana', 'associate-professor', 'MBA, Ph.D.', true, 12],
  ['mgt', 'f14', 'Mr. S. Prabhakaran', 'assistant-professor', 'MBA, M.Phil.', false, 7],
  ['mgt', 'f15', 'Mrs. A. Sasirekha', 'assistant-professor', 'MBA, NET', true, 5],

  ['mat', 'f16', 'Dr. K. Senthilkumar', 'professor', 'M.Sc., M.Phil., Ph.D.', true, 20],
  ['mat', 'f17', 'Mrs. M. Alamelu', 'assistant-professor', 'M.Sc., M.Phil.', false, 8],

  ['eng', 'f18', 'Dr. P. Jayanthi', 'associate-professor', 'M.A., M.Phil., Ph.D.', true, 15],
  ['eng', 'f19', 'Mrs. N. Bhuvaneswari', 'assistant-professor', 'M.A., B.Ed.', false, 6],
  ['eng', 'f20', 'Mrs. S. Revathi', 'assistant-professor', 'M.A., NET', true, 5],
];

facultySpec.forEach(([dep, key, name, designation, qualification, netCleared, years], i) => {
  const surname = name.split('. ').at(-1).toLowerCase();
  users.push({
    id: `usr-${key}`,
    collegeId: COLLEGE_ID,
    name,
    // The first Computer Science assistant professor is the demo faculty login.
    email: key === 'f3' ? 'faculty@college.edu' : `${surname}@college.edu`,
    password: 'Faculty@123',
    roles: ['faculty'],
    phone: `+91 98430 2${pad(i + 10)}0`,
    status: 'active',
    joinedOn: `${AY_START - years}-06-01`,
    avatarHue: (i * 47 + 30) % 360,
    employeeId: `EMP-${pad(20 + i)}`,
    designation,
    departmentId: `dep-${dep}`,
    qualification,
    netCleared,
    experienceYears: years,
    dateOfJoining: `${AY_START - years}-06-01`,
    courseIds: [],
  });
});

const faculty = users.filter((u) => u.roles.includes('faculty'));
const facultyOf = (departmentId) => faculty.filter((f) => f.departmentId === departmentId);

/* The senior-most member of each department heads it. */
const RANK = { professor: 0, 'associate-professor': 1, 'assistant-professor': 2 };
for (const dep of departments) {
  const staff = facultyOf(dep.id).sort(
    (a, b) => RANK[a.designation] - RANK[b.designation] || b.experienceYears - a.experienceYears,
  );
  const head = staff[0];
  if (head) {
    dep.hodId = head.id;
    if (!head.roles.includes('hod')) head.roles.push('hod');
  }
}

/* ── sections: a batch of a programme, in the semester it has reached ───── */

const sections = [];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

for (const prog of programmes) {
  for (let year = 1; year <= prog.durationYears; year++) {
    const batch = AY_START - (year - 1);
    const semester = (year - 1) * 2 + SEM_OFFSET;
    if (semester > prog.semesters) continue;
    sections.push({
      id: `sec-${prog.id.replace('prg-', '')}-${batch}`,
      collegeId: COLLEGE_ID,
      programmeId: prog.id,
      batch,
      section: 'A',
      semester,
      label: `${ROMAN[year]} ${prog.shortName}`,
      tutorId: '',
      room: `${prog.departmentId === 'dep-cs' ? 'CS' : prog.departmentId === 'dep-com' ? 'C' : 'M'}-${year}01`,
      strength: prog.intake,
    });
  }
}

/* Each section has a tutor from its own department, as a college does it. */
sections.forEach((sec, i) => {
  const prog = programmeById(sec.programmeId);
  const pool = facultyOf(prog.departmentId);
  const tutor = pool[i % pool.length];
  sec.tutorId = tutor.id;
  if (!tutor.roles.includes('tutor')) tutor.roles.push('tutor');
});

/* ── offerings: who teaches what, to whom, this semester ───────────────── */

const offerings = [];
let offSeq = 0;

for (const sec of sections) {
  const prog = programmeById(sec.programmeId);
  for (const course of coursesFor(sec.programmeId, sec.semester)) {
    // A language paper goes to English, an allied maths or statistics paper to
    // Mathematics, and everything else to the programme's own department.
    const deptId = course.title.includes('English')
      ? 'dep-eng'
      : course.kind === 'allied' && /Mathematic|Statistic/.test(course.title)
        ? 'dep-mat'
        : prog.departmentId;
    let pool = facultyOf(deptId);
    // Only a Ph.D. or NET-cleared member of staff takes a postgraduate paper.
    if (prog.level === 'pg') {
      const qualified = pool.filter((f) => f.netCleared || f.qualification.includes('Ph.D.'));
      if (qualified.length) pool = qualified;
    }
    if (!pool.length) pool = faculty;
    const teacher = pool[(offSeq + sec.batch) % pool.length];
    if (!teacher.courseIds.includes(course.id)) teacher.courseIds.push(course.id);

    offerings.push({
      id: `off-${++offSeq}`,
      sectionId: sec.id,
      courseId: course.id,
      facultyId: teacher.id,
      isElective: course.kind === 'elective',
      enrolledIds: [],
    });
  }
}
const offeringsOf = (sectionId) => offerings.filter((o) => o.sectionId === sectionId);

/* ── students and parents ──────────────────────────────────────────────── */

const maleNames = ['Aravind', 'Karthik', 'Dinesh', 'Hariharan', 'Kavin', 'Logesh', 'Manikandan', 'Naveen', 'Prakash', 'Ragul', 'Sanjay', 'Tamilselvan', 'Vignesh', 'Yuvaraj', 'Balaji', 'Gokul', 'Mohanraj', 'Surya', 'Vimal', 'Jeyaraman'];
const femaleNames = ['Abinaya', 'Bhavani', 'Divya', 'Gayathri', 'Ilakkiya', 'Janani', 'Kavya', 'Lavanya', 'Meena', 'Nandhini', 'Oviya', 'Pavithra', 'Ramya', 'Sandhya', 'Thamarai', 'Vaishnavi', 'Yazhini', 'Keerthana', 'Swetha', 'Aishwarya'];
const initials = ['R', 'K', 'S', 'M', 'P', 'V', 'G', 'T', 'A', 'N'];
const fatherNames = ['Murugan', 'Rajendran', 'Selvam', 'Kumaresan', 'Palanisamy', 'Ganesan', 'Thangavel', 'Arumugam', 'Natarajan', 'Velmurugan'];
const motherNames = ['Lakshmi', 'Saroja', 'Vasanthi', 'Amudha', 'Kalaivani', 'Rajeswari', 'Shanthi', 'Malathi', 'Devi', 'Pushpa'];
const occupations = ['Farmer', 'Textile business', 'Auto driver', 'Teacher', 'Shop owner', 'Mechanic', 'Nurse', 'Tailor', 'Software engineer', 'Government employee'];
const bloodGroups = ['A+', 'B+', 'O+', 'AB+', 'A-', 'O-'];
const quotas = ['management', 'government', 'government', 'first-graduate', 'sports'];

const students = [];
const parents = [];

sections.forEach((sec) => {
  const prog = programmeById(sec.programmeId);
  const deptFaculty = facultyOf(prog.departmentId);

  for (let r = 1; r <= sec.strength; r++) {
    const isMale = (r + sec.batch) % 2 === 0;
    const first = isMale
      ? maleNames[(r * 3 + sec.batch) % maleNames.length]
      : femaleNames[(r * 5 + sec.batch) % femaleNames.length];
    const initial = initials[(r + sec.batch) % initials.length];
    const sid = `stu-${sec.id.replace('sec-', '')}-${pad(r, 3)}`;
    const pid = `par-${sec.id.replace('sec-', '')}-${pad(r, 3)}`;

    // The demo student is in the third-year B.Sc. Computer Science cohort —
    // the one with placements, arrears and a project to show.
    const isDemo = sec.id === `sec-bsc-cs-${AY_START - 2}` && r === 7;

    students.push({
      id: sid,
      collegeId: COLLEGE_ID,
      name: `${first} ${initial}.`,
      email: isDemo ? 'student@college.edu' : `${first.toLowerCase()}.${sid.slice(-7)}@student.college.edu`,
      password: 'Student@123',
      roles: ['student'],
      registerNo: `${String(sec.batch).slice(2)}${prog.code}${pad(r, 3)}`,
      rollNo: r,
      sectionId: sec.id,
      programmeId: sec.programmeId,
      dateOfBirth: `${sec.batch - 18}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
      bloodGroup: pick(bloodGroups),
      guardianIds: [pid],
      mentorId: deptFaculty[r % deptFaculty.length].id,
      admissionQuota: quotas[(r + sec.batch) % quotas.length],
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      status: 'active',
      joinedOn: `${sec.batch}-07-01`,
      avatarHue: (r * 37 + sec.batch * 11) % 360,
      isMale,
    });

    parents.push({
      id: pid,
      collegeId: COLLEGE_ID,
      name: `${initial}. ${r % 2 === 0 ? fatherNames[(r + sec.batch) % fatherNames.length] : motherNames[(r * 2 + sec.batch) % motherNames.length]}`,
      email: isDemo ? 'parent@college.edu' : `parent.${sid.slice(-7)}@gmail.com`,
      password: 'Parent@123',
      roles: ['parent'],
      childIds: [sid],
      occupation: occupations[(r + sec.batch) % occupations.length],
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      status: 'active',
      joinedOn: `${sec.batch}-07-01`,
      avatarHue: (r * 29 + 180) % 360,
    });
  }
});

users.push(...students, ...parents);
const DEMO_STUDENT = students.find((s) => s.email === 'student@college.edu');
const demoParent = parents.find((p) => p.email === 'parent@college.edu');
const studentsOf = (sectionId) => students.filter((s) => s.sectionId === sectionId);

/* Electives: a student takes one of those offered, not all of them. */
for (const sec of sections) {
  const roll = studentsOf(sec.id);
  const electives = offeringsOf(sec.id).filter((o) => o.isElective);
  for (const o of offeringsOf(sec.id).filter((x) => !x.isElective)) {
    o.enrolledIds = roll.map((s) => s.id);
  }
  roll.forEach((s, i) => {
    if (!electives.length) return;
    const choice = s.id === DEMO_STUDENT?.id ? electives[0] : electives[i % electives.length];
    choice.enrolledIds.push(s.id);
  });
}
const enrolledIn = (offeringId) => offerings.find((o) => o.id === offeringId)?.enrolledIds ?? [];

/* ── laboratories ──────────────────────────────────────────────────────── */

const labs = [
  ['computer', 'Computer Laboratory I', 'dep-cs', 'Lab 1', 36, 'usr-f2', 'usr-lab1'],
  ['computer', 'Computer Laboratory II', 'dep-cs', 'Lab 2', 36, 'usr-f4', 'usr-lab2'],
  ['computer', 'Commerce Computing Laboratory', 'dep-com', 'Lab 3', 36, 'usr-f10', 'usr-lab2'],
  ['computer', 'Management Computing Laboratory', 'dep-mgt', 'Lab 4', 36, 'usr-f14', 'usr-lab1'],
  ['language', 'Language Laboratory', 'dep-eng', 'Lab 5', 30, 'usr-f18', 'usr-lab1'],
].map(([kind, name, departmentId, room, capacity, inChargeId, assistantId], i) => ({
  id: `lab-${i + 1}`,
  collegeId: COLLEGE_ID,
  departmentId,
  name,
  kind,
  room,
  capacity,
  inChargeId,
  assistantId,
}));

for (const lab of labs) {
  const inCharge = users.find((u) => u.id === lab.inChargeId);
  if (inCharge && !inCharge.roles.includes('lab-instructor')) inCharge.roles.push('lab-instructor');
}

const labBatches = [];
for (const sec of sections) {
  const hasPractical = offeringsOf(sec.id).some((o) => courseById(o.courseId)?.kind === 'practical');
  if (!hasPractical) continue;
  const roll = studentsOf(sec.id);
  const capacity = Math.min(...labs.map((l) => l.capacity));
  const count = Math.max(1, Math.ceil(roll.length / capacity));
  for (let b = 0; b < count; b++) {
    labBatches.push({
      id: `batch-${sec.id}-${b + 1}`,
      sectionId: sec.id,
      name: `Batch ${String.fromCharCode(65 + b)}`,
      studentIds: roll.filter((_, i) => i % count === b).map((s) => s.id),
    });
  }
}

const apparatus = [
  ['Desktop workstation', 36, 'nos'],
  ['UPS 3 kVA', 4, 'nos'],
  ['Laser printer', 2, 'nos'],
  ['Network switch 24-port', 3, 'nos'],
  ['Projector', 1, 'nos'],
];
const labItems = [];
let itemSeq = 0;
labs.forEach((lab) => {
  apparatus.forEach(([name, quantity, unit], i) => {
    labItems.push({
      id: `labit-${++itemSeq}`,
      labId: lab.id,
      name,
      quantity,
      unit,
      condition: i === 1 ? 'needs-repair' : 'good',
    });
  });
});

const labBreakages = [
  ['lab-1', 1, 2400, 'Keyboard damaged during a practical.'],
  ['lab-2', 1, 850, 'Mouse and cable broken.'],
  ['lab-3', 1, 1200, 'Monitor stand cracked.'],
].map(([labId, quantity, amount, note], i) => {
  const item = labItems.find((it) => it.labId === labId);
  return {
    id: `brk-${i + 1}`,
    labId,
    itemId: item.id,
    studentId: students[(i * 37) % students.length].id,
    date: shift(-between(5, 30)),
    quantity,
    note,
    amount,
    recovered: i % 2 === 0,
  };
});

/* ── timetable ─────────────────────────────────────────────────────────── */

/** The college day: eight hours with a short break and lunch. */
const HOURS = [
  ['09:00', '09:50', 'hour'],
  ['09:50', '10:40', 'hour'],
  ['10:40', '10:55', 'break'],
  ['10:55', '11:45', 'hour'],
  ['11:45', '12:35', 'hour'],
  ['12:35', '13:25', 'lunch'],
  ['13:25', '14:15', 'hour'],
  ['14:15', '15:05', 'hour'],
  ['15:05', '15:55', 'hour'],
];

const timetable = [];
let hourSeq = 0;

/**
 * Build the week for every section at once.
 *
 * Doing it per section independently double-books faculty, which is the error
 * that makes a timetable useless — two cohorts waiting for the same person. So
 * every hour is placed against one shared busy map.
 */
{
  const busyFaculty = new Map();
  const busyLab = new Map();
  const at = (day, hour) => `${day}-${hour}`;
  const isFree = (map, day, hour, id) => !id || !(map.get(at(day, hour)) ?? new Set()).has(id);
  const occupy = (map, day, hour, id) => {
    if (!id) return;
    if (!map.has(at(day, hour))) map.set(at(day, hour), new Set());
    map.get(at(day, hour)).add(id);
  };

  const owed = new Map();
  for (const sec of sections) {
    const quota = new Map();
    for (const o of offeringsOf(sec.id)) quota.set(o.id, courseById(o.courseId).hoursPerWeek);
    owed.set(sec.id, quota);
  }

  const labFor = (sec) =>
    labs.find((l) => l.departmentId === programmeById(sec.programmeId).departmentId) ?? labs[0];

  for (let day = 1; day <= 6; day++) {
    HOURS.forEach(([start, end, kind], hi) => {
      const hour = hi + 1;
      // Saturday is a half day, as it is in most Tamil Nadu colleges.
      if (day === 6 && hi > 3) return;

      const order = sections.map((_, i) => sections[(i + day + hi) % sections.length]);

      for (const sec of order) {
        if (kind !== 'hour') {
          timetable.push({
            id: `hr-${++hourSeq}`,
            sectionId: sec.id,
            day,
            hour,
            start,
            end,
            offeringId: null,
            facultyId: null,
            room: sec.room,
            title: kind === 'break' ? 'Short Break' : 'Lunch Break',
            kind,
          });
          continue;
        }

        const quota = owed.get(sec.id);
        const lab = labFor(sec);
        const candidates = offeringsOf(sec.id)
          .map((o) => ({ o, course: courseById(o.courseId), left: quota.get(o.id) ?? 0 }))
          .filter(
            ({ o, course }) =>
              isFree(busyFaculty, day, hour, o.facultyId) &&
              (course.kind !== 'practical' || isFree(busyLab, day, hour, lab?.id)),
          )
          .sort((a, b) => b.left - a.left);

        // Only a paper that still owes hours. Once every quota for the week is
        // met the remaining hours are library or mentoring time, which is what a
        // college actually does with them — and what stops one paper absorbing
        // every spare hour in the week.
        const choice = candidates.find((c) => c.left > 0);

        if (!choice) {
          // A mentoring hour needs the tutor in the room, so it books them like
          // any other hour — otherwise a tutor ends up mentoring one cohort
          // while teaching another, which is a clash the board would not show.
          const wantsMentoring = day === 5 && hour >= 7;
          const isMentoring = wantsMentoring && isFree(busyFaculty, day, hour, sec.tutorId);
          timetable.push({
            id: `hr-${++hourSeq}`,
            sectionId: sec.id,
            day,
            hour,
            start,
            end,
            offeringId: null,
            facultyId: isMentoring ? sec.tutorId : null,
            room: sec.room,
            title: isMentoring ? 'Mentoring hour' : 'Library hour',
            kind: isMentoring ? 'mentoring' : 'library',
          });
          if (isMentoring) occupy(busyFaculty, day, hour, sec.tutorId);
          continue;
        }

        const isLab = choice.course.kind === 'practical';
        const batch = labBatches.find((b) => b.sectionId === sec.id);

        timetable.push({
          id: `hr-${++hourSeq}`,
          sectionId: sec.id,
          day,
          hour,
          start,
          end,
          offeringId: choice.o.id,
          facultyId: choice.o.facultyId,
          room: isLab ? (lab?.room ?? sec.room) : sec.room,
          title: isLab ? choice.course.title : undefined,
          kind: isLab ? 'lab' : 'hour',
          labId: isLab ? lab?.id : undefined,
          batchId: isLab ? batch?.id : undefined,
        });

        occupy(busyFaculty, day, hour, choice.o.facultyId);
        if (isLab) occupy(busyLab, day, hour, lab?.id);
        quota.set(choice.o.id, Math.max(0, (quota.get(choice.o.id) ?? 0) - 1));
      }
    });
  }
}

/* ── working days and per-hour attendance ──────────────────────────────── */

/**
 * Attendance follows the timetable: for each working day, every scheduled hour
 * produces a record for each student enrolled in that offering. That is what
 * makes a per-course percentage mean something rather than be invented.
 */
const workingDays = [];
for (let back = 0; workingDays.length < 12; back++) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - back);
  if (d.getDay() === 0) continue; // Sunday
  workingDays.push(iso(d));
}
workingDays.reverse();

/** Final years attend worst, as every college registrar will tell you. */
const SECTION_ABSENCE = {};
sections.forEach((sec) => {
  const year = Math.floor((sec.semester - 1) / 2) + 1;
  SECTION_ABSENCE[sec.id] = year === 1 ? 7 : year === 2 ? 11 : 16;
});

const attendance = [];
let attSeq = 0;
/**
 * The paper the demo student is deliberately short in — the first ordinary
 * theory paper of whatever semester they are actually in, so this holds whether
 * the demo is shown in the odd term or the even one.
 */
const demoShort = DEMO_STUDENT
  ? offeringsOf(DEMO_STUDENT.sectionId).find((o) => {
      const c = courseById(o.courseId);
      return c.kind === 'core' && c.hoursPerWeek >= 4;
    })
  : undefined;
const DEMO_SHORT_OFFERING = demoShort?.id ?? null;
let demoShortSeen = 0;
const DEMO_SHORT_TITLE = demoShort ? courseById(demoShort.courseId).title : 'one paper';

for (const date of workingDays) {
  const dow = new Date(date).getDay();
  for (const slot of timetable) {
    if (slot.day !== dow || !slot.offeringId) continue;
    const roll = enrolledIn(slot.offeringId);
    const rate = SECTION_ABSENCE[slot.sectionId] ?? 10;

    roll.forEach((studentId, si) => {
      const n = attSeq + si;
      let status = 'present';
      if (studentId === DEMO_STUDENT?.id) {
        // Short in exactly one paper, fine in the rest — the situation a parent
        // is actually called about.
        // Count the hours of this paper as they go by rather than hashing the
        // day: the paper is held ten times in the window, so a hash is too
        // coarse to land the figure between the 65% condonation floor and the
        // 75% requirement, which is the only interesting place for it to be.
        if (slot.offeringId === DEMO_SHORT_OFFERING) {
          status = demoShortSeen % 10 < 3 ? 'absent' : 'present';
          demoShortSeen += 1;
        } else {
          status = 'present';
        }
      } else {
        const roll100 = (n * 7 + dow * 13 + slot.hour * 11) % 100;
        if (roll100 < rate) status = 'absent';
        else if (roll100 < rate + 2) status = 'od';
      }
      attendance.push({
        id: `att-${++attSeq}`,
        studentId,
        offeringId: slot.offeringId,
        date,
        hour: slot.hour,
        status,
      });
    });
  }
}

/* ── condonation: who is short, and who has applied ────────────────────── */

const condonations = [];
{
  const seen = new Map();
  for (const row of attendance) {
    const key = `${row.studentId}|${row.offeringId}`;
    const agg = seen.get(key) ?? { held: 0, present: 0 };
    agg.held += 1;
    if (row.status !== 'absent') agg.present += 1;
    seen.set(key, agg);
  }
  let cSeq = 0;
  let considered = 0;
  for (const [key, agg] of seen) {
    const percent = Math.round((agg.present / agg.held) * 100);
    // Between 65 and 75 a student may apply; below that nothing can be done.
    if (percent >= 75 || percent < 65) continue;
    considered += 1;
    const [studentId, offeringId] = key.split('|');
    if (considered % 4 !== 0 && studentId !== DEMO_STUDENT?.id) continue;
    const sec = sections.find((s) => s.id === offerings.find((o) => o.id === offeringId)?.sectionId);
    condonations.push({
      id: `cond-${++cSeq}`,
      studentId,
      offeringId,
      semester: sec?.semester ?? 1,
      percent,
      reason: pick([
        'Hospitalised for a week with dengue; records enclosed.',
        'Family bereavement.',
        'Represented the college at the inter-zone tournament.',
        'Prolonged illness; medical certificate submitted.',
      ]),
      status: cSeq % 3 === 0 ? 'approved' : 'requested',
      fee: 500,
      decidedById: cSeq % 3 === 0 ? 'usr-coe' : undefined,
    });
  }
}

/* ── assignments ───────────────────────────────────────────────────────── */

const assignments = [];
const assignmentStatus = [];
let asgSeq = 0;

for (const sec of sections) {
  offeringsOf(sec.id)
    .filter((o) => !o.isElective && courseById(o.courseId).kind !== 'project')
    .slice(0, 3)
    .forEach((o, i) => {
      const course = courseById(o.courseId);
      const dueOffset = i * 4 - 3;
      const a = {
        id: `asg-${++asgSeq}`,
        offeringId: o.id,
        title: `${course.title} — Assignment ${i + 1}`,
        description: `Answer all questions from unit ${i + 1}. Hand-written submissions only, in the prescribed format, with the register number on every sheet.`,
        assignedOn: shift(dueOffset - 7),
        dueOn: shift(dueOffset),
        maxMarks: 10,
        assignedById: o.facultyId,
      };
      assignments.push(a);

      enrolledIn(o.id).forEach((studentId, si) => {
        const overdue = a.dueOn < TODAY_ISO;
        const submitted = overdue ? (si + i) % 7 !== 0 : (si + i) % 4 === 0;
        assignmentStatus.push({
          id: `asgs-${a.id}-${studentId}`,
          assignmentId: a.id,
          studentId,
          submittedOn: submitted ? a.dueOn : null,
          marks: submitted && overdue ? between(5, 10) : null,
          remark: submitted && overdue ? pick(['Good', 'Well presented', 'Incomplete working', '']) : '',
        });
      });
    });
}

/* ── internal assessment ───────────────────────────────────────────────── */

const internalMarks = [];
let imSeq = 0;

for (const o of offerings) {
  const course = courseById(o.courseId);
  if (course.kind === 'project') continue;
  const split =
    course.ciaMax === 40
      ? [['CIA-1', 15], ['CIA-2', 15], ['Assignment', 10]]
      : [['CIA-1', 10], ['CIA-2', 10], ['Assignment', 5]];

  enrolledIn(o.id).forEach((studentId, si) => {
    split.forEach(([component, maxMarks], ci) => {
      // The second internal has been held for some papers and not yet others.
      const held = ci !== 1 || si % 5 !== 0;
      internalMarks.push({
        id: `im-${++imSeq}`,
        studentId,
        offeringId: o.id,
        component,
        marks: held
          ? Math.min(maxMarks, Math.round(maxMarks * (0.55 + ((si * 7 + ci * 13) % 40) / 100)))
          : null,
        maxMarks,
      });
    });
  });
}

/* ── examinations and results ──────────────────────────────────────────── */

const exams = [];
const results = [];
let resSeq = 0;

const gradeFor = (total) => {
  if (total >= 91) return ['O', 10];
  if (total >= 81) return ['D+', 9];
  if (total >= 71) return ['D', 8];
  if (total >= 61) return ['A+', 7];
  if (total >= 51) return ['A', 6];
  if (total >= 40) return ['B', 5];
  return ['RA', 0];
};

const maxSemester = Math.max(...sections.map((s) => s.semester));
for (let sem = 1; sem <= maxSemester; sem++) {
  const past = sem < maxSemester;
  exams.push({
    id: `exm-${sem}`,
    collegeId: COLLEGE_ID,
    name: `End Semester Examination — Semester ${sem}`,
    shortName: `ESE Sem ${sem}`,
    semester: sem,
    academicYear: ACADEMIC_YEAR,
    startsOn: past ? shift(-180 * (maxSemester - sem) - 30) : shift(55),
    endsOn: past ? shift(-180 * (maxSemester - sem) - 16) : shift(70),
    published: past,
  });
}

/**
 * Results for every semester a student has already completed. This is what
 * gives a CGPA something to be computed from, and what makes an arrear real: a
 * paper failed in semester 1 is still carried in semester 5.
 */
students.forEach((st, si) => {
  const sec = sections.find((s) => s.id === st.sectionId);
  // Stable per student, so a transcript reads as one person's record. The
  // demo student is deliberately strong — they hold a placement offer that
  // carries a CGPA and arrear condition, and the two have to agree.
  const ability = st.id === DEMO_STUDENT?.id ? 88 : (si * 13) % 100;

  for (let sem = 1; sem < sec.semester; sem++) {
    const exam = exams.find((e) => e.semester === sem);
    for (const course of coursesFor(st.programmeId, sem)) {
      // Assume one of the two electives offered in that semester.
      if (course.kind === 'elective' && (si + course.semester) % 2 === 1) continue;

      const base = 38 + Math.round(ability * 0.5);
      const spread = ((si * 7 + course.semester * 11 + course.title.length) % 30) - 10;
      const total = Math.max(14, Math.min(98, base + spread));
      const [grade, point] = gradeFor(total);
      const cia = Math.round(course.ciaMax * Math.min(1, (total + 12) / 100));
      const ese = Math.max(0, total - cia);

      results.push({
        id: `res-${++resSeq}`,
        studentId: st.id,
        examId: exam.id,
        courseId: course.id,
        semester: sem,
        cia,
        ese,
        total,
        grade,
        gradePoint: point,
        credits: course.credits,
        status: total >= 40 ? 'pass' : 'arrear',
        attempt: 1,
      });
    }
  }
});

/* ── fees ──────────────────────────────────────────────────────────────── */

const fees = [];
const payments = [];
let receiptSeq = 1000;

const tuitionFor = (prog) =>
  prog.level === 'pg' ? 42000 : prog.name.includes('B.Sc') ? 32000 : 28000;

students.forEach((st, si) => {
  const prog = programmeById(st.programmeId);
  const sec = sections.find((s) => s.id === st.sectionId);
  const heads = [
    [`Tuition Fee — Semester ${sec.semester}`, sec.semester, tuitionFor(prog), -60],
    ['Examination Fee', sec.semester, prog.level === 'pg' ? 2400 : 1800, 25],
    ['Laboratory and Library Fee', sec.semester, 4500, -60],
    ['College Development Fund', 0, 3000, -60],
  ];

  // Tamil Nadu students lean heavily on scholarships; some pay very little.
  const scholar =
    si % 9 === 0 ? 'First Graduate Scholarship' : si % 17 === 0 ? 'BC/MBC Scholarship' : undefined;

  heads.forEach(([head, semester, total, dueOffset], hi) => {
    const concession = scholar && hi === 0 ? Math.round(total * 0.5) : 0;
    const payable = total - concession;
    const past = dueOffset < 0;
    const reliability = (si * 11) % 10 < 5 ? 0 : (si * 11) % 10 < 8 ? 1 : 2;
    const state = past
      ? reliability === 0
        ? 'paid'
        : reliability === 1
          ? (si + hi) % 4 === 0
            ? 'partial'
            : 'paid'
          : (si + hi) % 3 === 0
            ? 'due'
            : 'partial'
      : reliability === 0
        ? (si + hi) % 2 === 0
          ? 'paid'
          : 'due'
        : 'due';
    const paid =
      state === 'paid' ? payable : state === 'partial' ? Math.round((payable * 0.5) / 100) * 100 : 0;
    const id = `fee-${st.id}-${hi}`;

    fees.push({
      id,
      studentId: st.id,
      head,
      semester,
      total: payable,
      paid,
      dueOn: shift(dueOffset),
      concession,
      scholarship: concession ? scholar : undefined,
    });

    if (paid > 0) {
      receiptSeq += 1;
      payments.push({
        id: `pay-${st.id}-${hi}`,
        studentId: st.id,
        feeId: id,
        amount: paid,
        method: pick(['upi', 'netbanking', 'dd', 'cash', 'card']),
        paidOn: shift(dueOffset - between(1, 12)),
        reference: `TXN${AY_START}${between(100000, 999999)}`,
        receiptNo: `SVC/${AY_START}/${receiptSeq}`,
      });
    }
  });
});

/* ── payroll ───────────────────────────────────────────────────────────── */

/** Indicative UGC-style scales, not any college's sanctioned pay. */
const SCALE = {
  chairman: 0,
  principal: 95000,
  'vice-principal': 78000,
  dean: 72000,
  professor: 68000,
  'associate-professor': 54000,
  'assistant-professor': 38000,
  'physical-director': 34000,
  librarian: 32000,
  'lab-instructor': 22000,
  'office-superintendent': 28000,
  'accounts-officer': 34000,
  'placement-officer': 40000,
  'office-assistant': 18000,
};

const salaries = [];
const payslips = [];
let slipSeq = 0;

users
  .filter((u) => u.employeeId)
  .forEach((st, i) => {
    const basic = SCALE[st.designation] ?? 25000;
    if (basic === 0) return; // the Chairman draws no salary
    const da = Math.round(basic * 0.18);
    const hra = Math.round(basic * 0.1);
    const conveyance = 1600;
    const otherAllowance = st.netCleared ? 2000 : 0;
    const pf = Math.round(Math.min(basic, 15000) * 0.12);
    const esi = basic + da <= 21000 ? Math.round((basic + da) * 0.0075) : 0;
    const professionalTax = basic >= 21000 ? 208 : 135;

    salaries.push({
      id: `sal-${st.id}`,
      staffId: st.id,
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
    for (let back = 2; back >= 0; back--) {
      const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - back, 1);
      const lopDays = back === 1 && i % 11 === 0 ? 1 : 0;
      const lop = Math.round((gross / 30) * lopDays);
      payslips.push({
        id: `slip-${++slipSeq}`,
        staffId: st.id,
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

/* ── placements ────────────────────────────────────────────────────────── */

const companies = [
  ['Zoho Corporation', 'Software Products', 'zoho.com', 'Ms. R. Divya', 'campus@zoho.example'],
  ['Cognizant', 'IT Services', 'cognizant.com', 'Mr. S. Arun', 'hiring@cognizant.example'],
  ['Infosys BPM', 'Business Process', 'infosys.com', 'Ms. K. Nithya', 'campus@infosys.example'],
  ['KGiSL', 'IT Services', 'kgisl.com', 'Mr. P. Vignesh', 'careers@kgisl.example'],
  ['HDFC Bank', 'Banking', 'hdfcbank.com', 'Ms. A. Gayathri', 'campus@hdfc.example'],
  ['Deloitte USI', 'Consulting', 'deloitte.com', 'Mr. M. Karthik', 'campus@deloitte.example'],
].map(([name, sector, website, contactName, contactEmail], i) => ({
  id: `cmp-${i + 1}`,
  collegeId: COLLEGE_ID,
  name,
  sector,
  website,
  contactName,
  contactEmail,
}));

const finalYearSections = sections.filter(
  (s) => s.semester >= (programmeById(s.programmeId).level === 'pg' ? 3 : 5),
);
const csProgrammes = programmes.filter((p) => p.departmentId === 'dep-cs').map((p) => p.id);
const otherProgrammes = programmes.filter((p) => p.departmentId !== 'dep-cs').map((p) => p.id);
const allProgrammeIds = programmes.map((p) => p.id);

const drives = [
  ['cmp-1', 'Member Technical Staff', 7.5, 'Chennai', csProgrammes, 7.0, 0, -12, -20, ['Aptitude', 'Technical', 'HR'], 'completed'],
  ['cmp-2', 'Programmer Analyst Trainee', 4.5, 'Coimbatore', csProgrammes, 6.0, 1, 6, -2, ['Aptitude', 'Technical', 'HR'], 'registration-open'],
  ['cmp-3', 'Process Executive', 3.2, 'Bengaluru', allProgrammeIds, 5.5, 2, 14, 6, ['Aptitude', 'Communication', 'HR'], 'announced'],
  ['cmp-4', 'Junior Software Engineer', 4.0, 'Coimbatore', csProgrammes, 6.5, 0, 3, -4, ['Written', 'Technical', 'HR'], 'in-progress'],
  ['cmp-5', 'Assistant Manager — Sales', 3.6, 'Coimbatore', otherProgrammes, 5.5, 2, 20, 11, ['Group Discussion', 'HR'], 'announced'],
  ['cmp-6', 'Analyst — Audit', 5.5, 'Hyderabad', otherProgrammes, 7.5, 0, -25, -35, ['Aptitude', 'Case Study', 'Partner Round'], 'completed'],
].map(
  (
    [companyId, role, packageLpa, location, programmeIds, minCgpa, maxArrears, driveOffset, closeOffset, rounds, status],
    i,
  ) => ({
    id: `drv-${i + 1}`,
    companyId,
    role,
    packageLpa,
    location,
    programmeIds,
    minCgpa,
    maxArrears,
    driveOn: shift(driveOffset),
    registrationCloses: shift(closeOffset),
    rounds,
    status,
  }),
);

const driveApplications = [];
let daSeq = 0;
const finalYearStudents = finalYearSections.flatMap((s) => studentsOf(s.id));

/** CGPA over the papers a student has passed, and the arrears still standing. */
const academicStanding = (studentId) => {
  const mine = results.filter((r) => r.studentId === studentId);
  const passed = mine.filter((r) => r.status === 'pass');
  const credits = passed.reduce((t, r) => t + r.credits, 0);
  return {
    cgpa: credits ? passed.reduce((t, r) => t + r.gradePoint * r.credits, 0) / credits : 0,
    arrears: mine.filter((r) => r.status === 'arrear').length,
  };
};

drives.forEach((drive, di) => {
  finalYearStudents
    .filter((s) => {
      if (!drive.programmeIds.includes(s.programmeId)) return false;
      // A recruiter's bar is a condition of registering, not something
      // discovered afterwards, so the data respects it.
      const { cgpa, arrears } = academicStanding(s.id);
      return cgpa >= drive.minCgpa && arrears <= drive.maxArrears;
    })
    .forEach((s, i) => {
      if ((i + di) % 3 === 0) return; // not everyone eligible applies
      const stage =
        drive.status === 'completed'
          ? (i + di) % 11 === 0
            ? 'selected'
            : (i + di) % 4 === 0
              ? 'hr'
              : (i + di) % 2 === 0
                ? 'technical'
                : 'rejected'
          : drive.status === 'in-progress'
            ? (i + di) % 3 === 0
              ? 'technical'
              : 'shortlisted'
            : 'applied';
      driveApplications.push({
        id: `dap-${++daSeq}`,
        driveId: drive.id,
        studentId: s.id,
        appliedOn: drive.registrationCloses < TODAY_ISO ? shift(-30) : shift(-3),
        stage,
        note: stage === 'selected' ? `Offer letter issued — ₹${drive.packageLpa} LPA.` : '',
      });
    });
});

// The demo student has an offer in hand, which is what a parent wants to see.
if (DEMO_STUDENT) {
  const zoho = drives[0];
  const existing = driveApplications.find(
    (a) => a.driveId === zoho.id && a.studentId === DEMO_STUDENT.id,
  );
  const note = `Offer letter issued — ₹${zoho.packageLpa} LPA, Chennai.`;
  if (existing) {
    existing.stage = 'selected';
    existing.note = note;
  } else {
    driveApplications.push({
      id: `dap-${++daSeq}`,
      driveId: zoho.id,
      studentId: DEMO_STUDENT.id,
      appliedOn: shift(-30),
      stage: 'selected',
      note,
    });
  }
}

/* ── hostel ────────────────────────────────────────────────────────────── */

const hostelBlocks = [
  ['Thiruvalluvar Block', 'men', 'usr-warden-m', 3, 3200],
  ['Avvaiyar Block', 'women', 'usr-warden-w', 4, 3200],
].map(([name, forGender, wardenId, floors, messCharge], i) => ({
  id: `hbk-${i + 1}`,
  collegeId: COLLEGE_ID,
  name,
  forGender,
  wardenId,
  floors,
  messCharge,
}));

const hostelRooms = [];
hostelBlocks.forEach((block) => {
  for (let floor = 1; floor <= block.floors; floor++) {
    for (let n = 1; n <= 8; n++) {
      const capacity = n % 3 === 0 ? 2 : n % 2 === 0 ? 3 : 4;
      hostelRooms.push({
        id: `hrm-${block.id}-${floor}${pad(n)}`,
        blockId: block.id,
        number: `${floor}${pad(n)}`,
        floor,
        capacity,
        // Fewer to a room costs more, which is how every hostel prices it.
        rentPerYear: capacity === 2 ? 48000 : capacity === 3 ? 38000 : 30000,
      });
    }
  }
});

const hostelAllotments = [];
let haSeq = 0;
{
  const menRooms = hostelRooms.filter((r) => r.blockId === 'hbk-1');
  const womenRooms = hostelRooms.filter((r) => r.blockId === 'hbk-2');
  const occupancy = new Map();

  students.forEach((s, i) => {
    // Roughly a quarter live in; those from nearby towns travel daily.
    if (i % 4 !== 0) return;
    const pool = s.isMale ? menRooms : womenRooms;
    const room = pool.find((r) => (occupancy.get(r.id) ?? 0) < r.capacity);
    if (!room) return;
    occupancy.set(room.id, (occupancy.get(room.id) ?? 0) + 1);
    hostelAllotments.push({
      id: `hal-${++haSeq}`,
      roomId: room.id,
      studentId: s.id,
      allottedOn: `${sections.find((x) => x.id === s.sectionId).batch}-07-05`,
      status: i % 37 === 0 ? 'requested' : 'allotted',
    });
  });
}

/* ── mentoring ─────────────────────────────────────────────────────────── */

const mentorNotes = [];
let mnSeq = 0;
students.forEach((s, i) => {
  if (i % 6 !== 0) return;
  const concern = i % 18 === 0 ? 'attendance' : i % 12 === 0 ? 'academic' : 'none';
  mentorNotes.push({
    id: `mnt-${++mnSeq}`,
    mentorId: s.mentorId,
    studentId: s.id,
    on: shift(-between(3, 40)),
    note:
      concern === 'attendance'
        ? 'Attendance short in two papers. Parent informed by telephone; the student has undertaken to attend regularly.'
        : concern === 'academic'
          ? 'Struggling with the practical component. Advised to attend the remedial class on Saturdays.'
          : pick([
              'Monthly review. Progressing well; interested in placements.',
              'Discussed the elective choice for the coming semester.',
              'No concerns. Encouraged to take part in the symposium.',
            ]),
    concern,
  });
});

/* ── circulars, events and the help desk ───────────────────────────────── */

const circulars = [
  ['End Semester Examination timetable published', 'தேர்வு அட்டவணை', 'Exam', 'The timetable for the forthcoming End Semester Examinations is now available. Students carrying arrears must register separately at the examination cell before the last date. Hall tickets will be issued only to students meeting the attendance requirement.', true, 2],
  ['Zoho campus drive — registration open', 'வேலைவாய்ப்பு முகாம்', 'Placement', 'Zoho Corporation will conduct a campus drive for final year Computer Science and B.C.A. students. A minimum of 7.0 CGPA with no standing arrears is required. Register through the Placements page before the closing date.', true, 3],
  ['Attendance shortage — condonation', 'வருகைப் பற்றாக்குறை', 'General', 'Students falling below 75% attendance in any paper must apply for condonation with supporting documents. Condonation is at the discretion of the Principal on payment of the prescribed fee. Below 65% no condonation is possible.', true, 5],
  ['Semester fee — last date', 'கட்டணம் செலுத்தும் நாள்', 'Fee', 'The last date for payment of semester fees is approaching. Payment may be made online through the portal or by demand draft at the office counter. Hall tickets are withheld where dues are outstanding.', true, 7],
  ['Hostel mess charges revised', 'விடுதி கட்டணம்', 'Hostel', 'Mess charges for the current semester have been revised with effect from the first of next month. Residents are requested to clear outstanding mess bills before the end of the month.', false, 9],
  ['National conference on Data Science', 'கருத்தரங்கம்', 'Event', 'The Department of Computer Science is organising a two-day national conference. Students presenting papers will be granted on-duty. Registration is through the department office.', false, 12],
  ['Bus Route 3 timing change', 'பேருந்து நேர மாற்றம்', 'Transport', 'From Monday, Route 3 will reach the Kalapatti Road stop ten minutes earlier. Students are requested to be at the stop accordingly.', false, 16],
].map(([title, titleTa, category, body, pinned, daysAgo], i) => ({
  id: `cir-${i + 1}`,
  collegeId: COLLEGE_ID,
  title,
  titleTa,
  body,
  category,
  postedOn: shift(-daysAgo),
  author: i % 2 === 0 ? 'Principal’s Office' : 'College Office',
  pinned,
  audience: 'all',
  acknowledgedBy: parents.filter((_, pi) => (pi + i) % 5 === 0).map((p) => p.id),
}));

const events = [
  ['Parent–Teacher Meeting', 'Academic', 'Tutors meet parents to discuss attendance, internal marks and arrears.', 4, '10:00', 'Respective classrooms', 'Office of the Principal'],
  ['Zoho Campus Drive', 'Placement', 'Aptitude, technical and HR rounds for shortlisted final year students.', 6, '08:30', 'Seminar Hall', 'Placement Cell'],
  ['National Conference on Data Science', 'Seminar', 'Two-day conference with paper presentations and invited talks.', 15, '09:30', 'Auditorium', 'Department of Computer Science'],
  ['Inter-Department Sports Meet', 'Sports', 'Track and field events across all departments.', 24, '08:00', 'College Ground', 'Physical Education Department'],
  ['Annual Day and Prize Distribution', 'Cultural', 'Cultural programmes, prize distribution and the Chief Guest’s address.', 42, '17:00', 'Auditorium', 'Cultural Committee'],
].map(([title, category, description, daysAhead, time, venue, organiser], i) => ({
  id: `evt-${i + 1}`,
  collegeId: COLLEGE_ID,
  title,
  description,
  category,
  date: shift(daysAhead),
  time,
  venue,
  organiser,
  forSections: 'all',
}));

const requests = [
  ['Bonafide certificate for passport', 'Certificate', 'resolved', 'Bonafide certificate required for a passport application. Kindly issue at the earliest.', demoParent?.id, DEMO_STUDENT?.id, 11],
  [`Attendance condonation — ${DEMO_SHORT_TITLE}`, 'Exam', 'in-progress', 'My ward was hospitalised for ten days. Requesting condonation of the attendance shortage in one paper. Medical records enclosed.', demoParent?.id, DEMO_STUDENT?.id, 4],
  ['Change of elective', 'Other', 'open', 'Requesting a change of elective from Cloud Computing to Mobile Application Development before the internal assessment begins.', students[8]?.id, students[8]?.id, 2],
  ['Hostel room change', 'Hostel', 'in-progress', 'Requesting a change of room owing to a persistent dust allergy. A ground floor room would be preferable.', students[20]?.id, students[20]?.id, 6],
  ['Projector not working — CS-301', 'Facility', 'open', 'The projector in CS-301 has not been working for a week. Practical demonstrations are affected.', 'usr-f3', undefined, 3],
].map(([title, category, status, description, raisedBy, aboutStudentId, daysAgo], i) => ({
  id: `req-${i + 1}`,
  ref: `REQ/${AY_START}/${pad(101 + i, 3)}`,
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
          { on: shift(-daysAgo + 1), note: 'Received at the college office.' },
          { on: shift(-daysAgo + 3), note: 'Certificate issued. Please collect from the office.' },
        ]
      : status === 'in-progress'
        ? [{ on: shift(-daysAgo + 1), note: 'Forwarded to the Principal for orders.' }]
        : [],
}));

/* ── parent meetings and gate visits ───────────────────────────────────── */

const ptmDate = shift(4);
const slotTimes = [
  ['10:00', '10:15'], ['10:15', '10:30'], ['10:30', '10:45'], ['10:45', '11:00'],
  ['11:15', '11:30'], ['11:30', '11:45'], ['11:45', '12:00'], ['12:00', '12:15'],
];

const meetingSlots = [];
sections.forEach((sec) => {
  slotTimes.forEach(([start, end], i) => {
    meetingSlots.push({
      id: `ms-${sec.id}-${i + 1}`,
      date: ptmDate,
      start,
      end,
      facultyId: sec.tutorId,
      sectionId: sec.id,
      capacity: 3,
    });
  });
});

const meetingBookings = [];
students.forEach((st, i) => {
  if (i % 4 !== 0) return;
  const slots = meetingSlots.filter((m) => m.sectionId === st.sectionId);
  const slot = slots[i % slots.length];
  meetingBookings.push({
    id: `mb-${st.id}`,
    slotId: slot.id,
    parentId: st.guardianIds[0],
    studentId: st.id,
    bookedOn: shift(-between(1, 6)),
    status: 'booked',
    note: pick(['Would like to discuss attendance.', 'About arrears.', '', 'Placement prospects.']),
    facultyNote: '',
  });
});

if (demoParent && DEMO_STUDENT && !meetingBookings.some((b) => b.studentId === DEMO_STUDENT.id)) {
  const slot = meetingSlots.find((m) => m.sectionId === DEMO_STUDENT.sectionId);
  if (slot) {
    meetingBookings.push({
      id: `mb-${DEMO_STUDENT.id}`,
      slotId: slot.id,
      parentId: demoParent.id,
      studentId: DEMO_STUDENT.id,
      bookedOn: shift(-2),
      status: 'booked',
      note: 'Would like to discuss the attendance shortage and the Zoho offer.',
      facultyNote: '',
    });
  }
}

const visitPurposes = ['Parent-Teacher Meeting', 'Meet a faculty member', 'Fee payment', 'Hostel', 'Document collection'];
const visits = [];
let passSeq = 500;
students.forEach((st, i) => {
  if (i % 11 !== 0) return;
  passSeq += 1;
  const daysAgo = between(-6, 20);
  const past = daysAgo > 0;
  const guardian = users.find((u) => u.id === st.guardianIds[0]);
  const tutor = users.find((u) => u.id === sections.find((s) => s.id === st.sectionId).tutorId);
  visits.push({
    id: `vis-${st.id}`,
    passNo: `VP/${AY_START}/${passSeq}`,
    parentId: st.guardianIds[0],
    studentId: st.id,
    visitorName: guardian ? guardian.name : 'Parent',
    purpose: visitPurposes[i % visitPurposes.length],
    date: shift(-daysAgo),
    time: pick(['09:30', '10:00', '11:00', '14:00', '15:00']),
    meetingWith: tutor ? tutor.name : '',
    status: past ? 'completed' : i % 22 === 0 ? 'requested' : 'approved',
    inTime: past ? '09:34' : undefined,
    outTime: past ? '10:05' : undefined,
    note: '',
  });
});

if (demoParent && DEMO_STUDENT) {
  passSeq += 1;
  const tutor = users.find(
    (u) => u.id === sections.find((s) => s.id === DEMO_STUDENT.sectionId).tutorId,
  );
  visits.unshift({
    id: 'vis-demo-upcoming',
    passNo: `VP/${AY_START}/${passSeq}`,
    parentId: demoParent.id,
    studentId: DEMO_STUDENT.id,
    visitorName: demoParent.name,
    purpose: 'Parent-Teacher Meeting',
    date: ptmDate,
    time: '10:30',
    meetingWith: tutor?.name ?? '',
    status: 'approved',
    note: 'Attendance and placement discussion.',
  });
}

/* ── transport ─────────────────────────────────────────────────────────── */

const vehicles = [
  ['TN 38 AX 1204', 'Ashok Leyland Lynx 54', 54, 'R. Murugesan', '+91 99445 21001', 'TN38 20110004521', 'Mr. A. Selvam', '+91 99445 31001', 95, 140, 410],
  ['TN 38 AX 1205', 'Ashok Leyland Lynx 54', 54, 'K. Chinnasamy', '+91 99445 21002', 'TN38 20090011874', 'Mr. R. Kannan', '+91 99445 31002', 22, 60, 300],
  ['TN 38 AX 1206', 'Eicher Skyline 48', 48, 'S. Velmurugan', '+91 99445 21003', 'TN38 20140007733', 'Mr. M. Bhuvan', '+91 99445 31003', 210, 18, 520],
  ['TN 38 AX 1207', 'Tata Starbus 52', 52, 'M. Palanivel', '+91 99445 21004', 'TN38 20120003290', 'Mr. P. Nirmal', '+91 99445 31004', -12, 95, 260],
].map(
  (
    [busNo, model, capacity, driverName, driverPhone, driverLicenceNo, attendantName, attendantPhone, fc, ins, permit],
    i,
  ) => ({
    id: `veh-${i + 1}`,
    collegeId: COLLEGE_ID,
    busNo,
    model,
    capacity,
    driverName,
    driverPhone,
    driverLicenceNo,
    attendantName,
    attendantPhone,
    // Bus 1207's fitness certificate has lapsed; a compliance screen with
    // nothing wrong on it proves nothing.
    fcExpiry: shift(fc),
    insuranceExpiry: shift(ins),
    permitExpiry: shift(permit),
  }),
);

const routes = [
  ['Route 1 — Gandhipuram', 'veh-1', ['Gandhipuram Bus Stand', 'Cross Cut Road', 'Sivananda Colony', 'Thudiyalur Road'], 14000],
  ['Route 2 — Peelamedu', 'veh-2', ['Peelamedu Signal', 'Hope College', 'Nehru Stadium', 'Avinashi Road'], 14000],
  ['Route 3 — Saravanampatti', 'veh-3', ['Saravanampatti Junction', 'Kalapatti Road', 'KCT Gate', 'Vilankurichi'], 11000],
  ['Route 4 — Mettupalayam Road', 'veh-4', ['Thudiyalur', 'Periyanaickenpalayam', 'Karamadai', 'Mettupalayam Road'], 16000],
].map(([name, vehicleId, stopNames, fee], i) => ({
  id: `rt-${i + 1}`,
  collegeId: COLLEGE_ID,
  name,
  vehicleId,
  fee,
  stops: stopNames.map((s, si) => ({
    name: s,
    time: `0${7 + Math.floor((si * 12) / 60)}:${pad((si * 12) % 60)}`,
  })),
}));

const studentTransport = [];
const seatsLeft = new Map(
  routes.map((r) => [r.id, vehicles.find((v) => v.id === r.vehicleId).capacity]),
);
const hostellers = new Set(hostelAllotments.map((a) => a.studentId));

if (DEMO_STUDENT) {
  studentTransport.push({
    id: `stt-${DEMO_STUDENT.id}`,
    studentId: DEMO_STUDENT.id,
    routeId: 'rt-3',
    stop: 'Kalapatti Road',
    status: 'allotted',
    requestedOn: shift(-between(30, 120)),
  });
  seatsLeft.set('rt-3', seatsLeft.get('rt-3') - 1);
}

students.forEach((st, i) => {
  if (st.id === DEMO_STUDENT?.id) return;
  // Someone living in the hostel does not also take the bus.
  if (hostellers.has(st.id)) return;
  if (i % 3 === 0) return;
  const requestedOn = shift(-between(20, 120));
  if (i % 29 === 0) {
    const route = routes[i % routes.length];
    studentTransport.push({
      id: `stt-${st.id}`,
      studentId: st.id,
      routeId: route.id,
      stop: route.stops[i % route.stops.length].name,
      status: 'requested',
      requestedOn,
    });
    return;
  }
  for (let k = 0; k < routes.length; k++) {
    const route = routes[(i + k) % routes.length];
    if (seatsLeft.get(route.id) > 0) {
      seatsLeft.set(route.id, seatsLeft.get(route.id) - 1);
      studentTransport.push({
        id: `stt-${st.id}`,
        studentId: st.id,
        routeId: route.id,
        stop: route.stops[i % route.stops.length].name,
        status: 'allotted',
        requestedOn,
      });
      return;
    }
  }
});

/* ── library ───────────────────────────────────────────────────────────── */

const books = [
  ['Let Us C', 'Yashavant Kanetkar', 'BPB Publications', '978-81-831-7944-6', 'Computer Science', 12, 'A-01', csProgrammes, 425],
  ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest', 'MIT Press', '978-02-620-3384-8', 'Computer Science', 6, 'A-04', csProgrammes, 1250],
  ['Database System Concepts', 'Silberschatz, Korth', 'McGraw Hill', '978-00-725-1551-8', 'Computer Science', 8, 'A-06', csProgrammes, 980],
  ['Java: The Complete Reference', 'Herbert Schildt', 'McGraw Hill', '978-12-605-4012-1', 'Computer Science', 10, 'A-08', csProgrammes, 875],
  ['Operating System Concepts', 'Silberschatz, Galvin', 'Wiley', '978-11-190-4336-1', 'Computer Science', 7, 'A-11', csProgrammes, 920],
  ['Advanced Accountancy — Volume I', 'S.P. Jain and K.L. Narang', 'Kalyani', '978-93-272-6109-4', 'Commerce', 14, 'B-01', otherProgrammes, 560],
  ['Income Tax Law and Practice', 'V.P. Gaur and D.B. Narang', 'Kalyani', '978-93-272-6200-8', 'Commerce', 10, 'B-03', otherProgrammes, 640],
  ['Principles of Management', 'Harold Koontz', 'McGraw Hill', '978-93-392-2286-4', 'Management', 9, 'B-07', otherProgrammes, 710],
  ['Marketing Management', 'Philip Kotler', 'Pearson', '978-93-325-5718-5', 'Management', 8, 'B-09', otherProgrammes, 899],
  ['Ponniyin Selvan (Part 1)', 'Kalki Krishnamurthy', 'Vanathi Pathippagam', '978-81-234-0011-2', 'Tamil Literature', 6, 'C-01', allProgrammeIds, 420],
  ['Wings of Fire', 'A.P.J. Abdul Kalam', 'Universities Press', '978-81-732-5114-6', 'Biography', 8, 'C-03', allProgrammeIds, 295],
  ['Quantitative Aptitude for Competitive Examinations', 'R.S. Aggarwal', 'S. Chand', '978-93-525-3402-9', 'Competitive', 15, 'D-01', allProgrammeIds, 545],
].map(([title, author, publisher, isbn, category, copies, rack, forProgrammes, price], i) => ({
  id: `bok-${i + 1}`,
  collegeId: COLLEGE_ID,
  accessionNo: `ACC/${pad(i + 1)}${between(100, 999)}`,
  title,
  author,
  publisher,
  isbn,
  category,
  copies,
  rack,
  forProgrammes,
  price,
  addedOn: shift(-between(90, 1200)),
}));

const loans = [];
students.forEach((st, i) => {
  if (i % 7 !== 0) return;
  const eligible = books.filter((b) => b.forProgrammes.includes(st.programmeId));
  if (!eligible.length) return;
  const book = eligible[i % eligible.length];
  const ago = between(3, 25);
  const returned = i % 21 === 0;
  const dueOn = shift(-ago + 14);
  const overdueDays =
    !returned && dueOn < TODAY_ISO
      ? Math.round((Date.parse(TODAY_ISO) - Date.parse(dueOn)) / 86400000)
      : 0;
  loans.push({
    id: `lon-${st.id}`,
    bookId: book.id,
    studentId: st.id,
    borrowedOn: shift(-ago),
    dueOn,
    returnedOn: returned ? shift(-1) : null,
    fine: overdueDays > 0 ? overdueDays * 2 : 0,
    renewals: i % 14 === 0 ? 1 : 0,
    condition: i % 40 === 0 ? 'damaged' : 'good',
  });
});

/* ── staff recruitment ─────────────────────────────────────────────────── */

const ALL_DOCS = ['degree', 'pg', 'phd', 'net', 'aadhaar', 'pan', 'bank', 'experience', 'publications'];

const applications = [
  ['Dr. K. Sumathi', 'sumathi.k@gmail.com', 'assistant-professor', 'dep-cs', 'M.Sc., M.Phil., Ph.D.', true, true, 8, 11, 'submitted', 2, ''],
  ['Mr. R. Vetrivelan', 'vetrivelan@gmail.com', 'assistant-professor', 'dep-com', 'M.Com., NET', true, false, 4, 2, 'under-review', 6, 'Qualification verified. Demonstration class scheduled.'],
  ['Mrs. A. Priyadharshini', 'priya.a@gmail.com', 'assistant-professor', 'dep-eng', 'M.A., M.Phil.', false, false, 3, 0, 'submitted', 1, ''],
  ['Dr. S. Bhuvanesh', 'bhuvanesh.s@gmail.com', 'associate-professor', 'dep-mgt', 'MBA, Ph.D.', true, true, 12, 19, 'approved', 20, 'Strong publication record. Approved for appointment.'],
  ['Mr. V. Ashokkumar', 'ashok.v@gmail.com', 'lab-instructor', 'dep-cs', 'M.Sc. (CS)', false, false, 5, 0, 'under-review', 9, 'Bank passbook copy still awaited.'],
  ['Mrs. N. Gowthami', 'gowthami.n@gmail.com', 'assistant-professor', 'dep-mat', 'M.Sc.', false, false, 1, 0, 'rejected', 26, 'NET not cleared and experience insufficient for the post.'],
].map(
  (
    [name, email, designation, departmentId, qualification, netCleared, phd, experienceYears, publications, status, daysAgo, reviewNote],
    i,
  ) => {
    const missing = status === 'submitted' ? 2 : status === 'under-review' ? 1 : 0;
    const needed = ALL_DOCS.filter((k) => {
      if (k === 'phd' && !phd) return false;
      if (k === 'net' && !netCleared) return false;
      if (k === 'experience' && experienceYears === 0) return false;
      if (k === 'publications' && publications === 0) return false;
      if (k === 'pg' && designation === 'lab-instructor') return false;
      return true;
    });
    return {
      id: `app-${i + 1}`,
      ref: `APP/${AY_START}/${pad(31 + i)}`,
      collegeId: COLLEGE_ID,
      name,
      email,
      phone: `+91 9${between(4000, 9999)} ${between(10000, 99999)}`,
      designation,
      departmentId,
      qualification,
      netCleared,
      phd,
      experienceYears,
      publications,
      courseIds: [],
      documents: needed.slice(0, needed.length - missing).map((kind) => ({
        kind,
        fileName: `${kind}-${name.split(' ').at(-1).toLowerCase()}.pdf`,
        uploadedOn: shift(-daysAgo - between(0, 3)),
        verified: status === 'approved' || status === 'rejected',
      })),
      status,
      submittedOn: shift(-daysAgo),
      reviewedById: status === 'submitted' ? undefined : 'usr-principal',
      reviewedOn: status === 'submitted' ? undefined : shift(-daysAgo + 3),
      reviewNote,
    };
  },
);

/* ── leave and cover ───────────────────────────────────────────────────── */

const leaves = [
  ['usr-f4', 'medical', 0, 1, 'Viral fever. Medical certificate attached.', 'approved'],
  ['usr-f11', 'on-duty', 0, 0, 'Attending the Board of Studies meeting at the university.', 'approved'],
  ['usr-f17', 'casual', 1, 1, 'Personal.', 'requested'],
  ['usr-f20', 'academic', -9, -7, 'Presented a paper at the national conference, Madurai.', 'approved'],
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

const substitutions = [];
let subSeq = 0;
const todayDow = TODAY.getDay() === 0 ? 1 : TODAY.getDay();
const absentToday = leaves
  .filter((l) => l.status === 'approved' && l.from <= TODAY_ISO && l.to >= TODAY_ISO)
  .map((l) => l.staffId);

absentToday.forEach((absentId) => {
  timetable
    .filter((s) => s.day === todayDow && s.facultyId === absentId && s.kind !== 'break' && s.kind !== 'lunch')
    .forEach((slot) => {
      const busy = new Set(
        timetable.filter((s) => s.day === slot.day && s.hour === slot.hour).map((s) => s.facultyId),
      );
      const absentSet = new Set(absentToday);
      const course = courseById(offerings.find((o) => o.id === slot.offeringId)?.courseId);
      const freeNow = faculty.filter((f) => !busy.has(f.id) && !absentSet.has(f.id));
      const best = freeNow.find((f) => f.courseIds.includes(course?.id)) ?? freeNow[0];
      if (!best) return;
      substitutions.push({
        id: `sbt-${++subSeq}`,
        date: TODAY_ISO,
        hourId: slot.id,
        sectionId: slot.sectionId,
        absentFacultyId: absentId,
        coverFacultyId: best.id,
        assignedById: 'usr-vp',
        note: best.courseIds.includes(course?.id)
          ? ''
          : `Supervision only — not a ${course?.title ?? 'subject'} teacher.`,
      });
    });
});

/* ── notifications and the campus map ──────────────────────────────────── */

const notifications = [];
let nSeq = 0;
const notify = (userId, title, body, kind, daysAgo, link, read = false) =>
  notifications.push({
    id: `ntf-${++nSeq}`,
    userId,
    collegeId: userId === 'all' ? COLLEGE_ID : undefined,
    title,
    body,
    kind,
    createdOn: shift(-daysAgo),
    read,
    link,
  });

if (demoParent && DEMO_STUDENT) {
  const first = DEMO_STUDENT.name.split(' ')[0];
  notify(demoParent.id, `${first} is short of attendance in one paper`, `Attendance has fallen below 75% in ${DEMO_SHORT_TITLE}. A condonation application may be made with supporting documents.`, 'attendance', 3, '/attendance');
  notify(demoParent.id, 'Semester fee is due', 'Tuition and examination fees for this semester are due shortly. Hall tickets are withheld where dues are outstanding.', 'fee', 1, '/fees');
  notify(demoParent.id, `${first} has been selected by Zoho Corporation`, 'Offer letter issued — ₹7.5 LPA, Chennai. Congratulations.', 'placement', 12, '/placements', true);
  notify(demoParent.id, 'Parent–Teacher Meeting on Saturday', 'The tutor will discuss attendance, internal marks and arrears. A slot may be booked through the app.', 'event', 2, '/meetings');
  notify(demoParent.id, 'Previous semester results published', 'The results for the previous semester are now available under Results.', 'result', 20, '/results', true);
}
notify('usr-principal', 'Three staff applications awaiting review', 'Two are newly submitted and one is under review. Open Staff Recruitment to act on them.', 'staff', 0, '/recruitment');
notify('usr-coe', 'Condonation applications pending', 'Attendance condonation applications are awaiting your orders ahead of hall ticket issue.', 'attendance', 1, '/attendance');
notify('usr-placement', 'Zoho drive registration closes soon', 'Eligible students who have not yet registered should be reminded.', 'placement', 1, '/placements');
notify('all', 'End Semester Examination timetable published', 'Hall tickets will be issued only to students meeting the attendance requirement and with no outstanding dues.', 'system', 2, '/circulars', true);

const places = [
  ['Main Block', 'academic', 30, 20, 34, 18, '08:30 – 16:30', 'Administration, the Principal’s office and the Commerce department.'],
  ['Science Block', 'academic', 30, 42, 34, 16, '08:30 – 16:30', 'Computer Science, Mathematics and the laboratories.'],
  ['Computer Laboratories', 'lab', 68, 20, 26, 16, '09:00 – 17:00', 'Five laboratories with 174 workstations and broadband.'],
  ['Central Library', 'academic', 4, 20, 22, 18, '08:30 – 18:00', 'Over 42,000 volumes, journals and a digital section.'],
  ['Examination Cell', 'admin', 4, 42, 22, 14, '09:00 – 16:00', 'Hall tickets, arrear registration, revaluation and mark sheets.'],
  ['Placement Cell', 'admin', 68, 40, 26, 12, '09:00 – 17:00', 'Training, drives and recruiter liaison.'],
  ['Thiruvalluvar Hostel (Men)', 'hostel', 4, 62, 24, 16, 'Residential', '72 residents across three floors, with a mess.'],
  ['Avvaiyar Hostel (Women)', 'hostel', 70, 60, 24, 18, 'Residential', '96 residents across four floors, with a mess.'],
  ['Auditorium', 'amenity', 32, 62, 34, 14, 'On event days', 'Seats 800. Conferences, Annual Day and campus drives.'],
].map(([name, kind, x, y, w, h, open, detail], i) => ({
  id: `plc-${i + 1}`,
  collegeId: COLLEGE_ID,
  name,
  kind,
  x,
  y,
  w,
  h,
  open,
  detail,
}));

/* Strip the helper flag used only while generating hostel allotments. */
for (const s of students) delete s.isMale;

/* ── emit ──────────────────────────────────────────────────────────────── */

const db = {
  group, colleges, departments, programmes, sections, courses, offerings, users,
  mentorNotes, applications, leaves, substitutions, timetable,
  labs, labBatches, labItems, labBreakages,
  attendance, condonations, assignments, assignmentStatus, internalMarks, exams, results,
  fees, payments, salaries, payslips,
  companies, drives, driveApplications,
  hostelBlocks, hostelRooms, hostelAllotments,
  circulars, events, requests, meetingSlots, meetingBookings, visits,
  vehicles, routes, studentTransport, books, loans, notifications, places,
};

for (const [name, rows] of Object.entries(db)) write(name, rows);

console.log(
  `Seeded ${ACADEMIC_YEAR}, ${TERM} semester · ${programmes.length} programmes · ${sections.length} sections · ${students.length} students · ${workingDays.length} working days\n`,
);
let total = 0;
for (const [k, v] of Object.entries(db)) {
  total += v.length;
  console.log(`  ${k.padEnd(20)} ${String(v.length).padStart(7)}`);
}
console.log(`  ${'TOTAL'.padEnd(20)} ${String(total).padStart(7)} rows`);
console.log(`\nDemo student: ${DEMO_STUDENT?.name} (${DEMO_STUDENT?.registerNo})`);
console.log(`Cover arranged today: ${substitutions.length}`);
