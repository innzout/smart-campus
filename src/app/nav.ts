import {
  BadgeIndianRupee,
  BedDouble,
  Briefcase,
  BarChart3,
  Bell,
  BookMarked,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  FlaskConical,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Map,
  Megaphone,
  PartyPopper,
  Repeat2,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Any one of these permissions unlocks the page. */
  permissions: string[];
  group: 'My Child' | 'School' | 'Manage';
  keywords?: string;
}

/**
 * Navigation is built from what the signed-in user may actually do, so adding a
 * role never means editing this list.
 */
export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permissions: ['dashboard.view'], group: 'My Child', keywords: 'home overview today' },
  { to: '/attendance', label: 'Attendance', icon: BarChart3, permissions: ['attendance.view.child', 'attendance.view.self', 'attendance.view.class', 'attendance.view.school'], group: 'My Child', keywords: 'present absent leave register daily' },
  { to: '/assignments', label: 'Assignments', icon: ClipboardList, permissions: ['assignment.view'], group: 'My Child', keywords: 'assignment submission internal marks due' },
  { to: '/results', label: 'Report Card', icon: GraduationCap, permissions: ['result.view.child', 'result.view.self', 'result.view.class'], group: 'My Child', keywords: 'marks grade quarterly exam progress rank' },
  { to: '/fees', label: 'Fees', icon: WalletCards, permissions: ['fee.view.child', 'fee.view.school'], group: 'My Child', keywords: 'pay due receipt term bus tuition' },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays, permissions: ['timetable.view'], group: 'My Child', keywords: 'periods schedule classes' },

  { to: '/circulars', label: 'Circulars', icon: Megaphone, permissions: ['circular.view'], group: 'School', keywords: 'notice announcement message ptm holiday' },
  { to: '/meetings', label: 'PTM & Meetings', icon: CalendarCheck, permissions: ['meeting.view'], group: 'School', keywords: 'parent teacher meeting slot book appointment' },
  { to: '/visits', label: 'School Visits', icon: DoorOpen, permissions: ['visit.view'], group: 'School', keywords: 'gate pass visitor appointment entry' },
  { to: '/events', label: 'Events', icon: PartyPopper, permissions: ['event.view'], group: 'School', keywords: 'annual day sports celebration' },
  { to: '/transport', label: 'Transport', icon: Bus, permissions: ['transport.view'], group: 'School', keywords: 'bus route stop driver pickup' },
  { to: '/placements', label: 'Placements', icon: Briefcase, permissions: ['placement.view'], group: 'School', keywords: 'campus drive recruiter offer package eligibility cgpa' },
  { to: '/hostel', label: 'Hostel', icon: BedDouble, permissions: ['hostel.view'], group: 'School', keywords: 'room block warden mess allotment resident' },
  { to: '/mentoring', label: 'Mentoring', icon: HeartHandshake, permissions: ['mentor.view'], group: 'School', keywords: 'mentor mentee tutor pastoral note concern' },
  { to: '/library', label: 'Library', icon: BookMarked, permissions: ['library.view'], group: 'School', keywords: 'books borrow return' },
  { to: '/requests', label: 'Help Desk', icon: LifeBuoy, permissions: ['request.raise', 'request.view.all'], group: 'School', keywords: 'leave certificate bonafide complaint' },
  { to: '/campus', label: 'School Map', icon: Map, permissions: ['map.view'], group: 'School', keywords: 'block room office directions' },
  { to: '/notifications', label: 'Notifications', icon: Bell, permissions: ['notification.view'], group: 'School', keywords: 'alerts inbox unread' },

  { to: '/students', label: 'Students & Staff', icon: Users, permissions: ['student.view', 'student.manage'], group: 'Manage', keywords: 'admission roll directory people' },
  { to: '/academics', label: 'Academic Setup', icon: Library, permissions: ['academic.view', 'academic.manage'], group: 'Manage', keywords: 'classes sections subjects groups assign teacher stage curriculum' },
  { to: '/substitutions', label: 'Cover & Adjustments', icon: Repeat2, permissions: ['substitution.view', 'substitution.manage', 'leave.request'], group: 'Manage', keywords: 'absent leave swap substitute free period adjustment' },
  { to: '/labs', label: 'Laboratories', icon: FlaskConical, permissions: ['lab.view', 'lab.manage'], group: 'Manage', keywords: 'physics chemistry botany zoology computer practical batch apparatus breakage' },
  { to: '/recruitment', label: 'Staff Recruitment', icon: UserPlus, permissions: ['recruitment.view', 'recruitment.review'], group: 'Manage', keywords: 'application appoint documents certificate tet approve hire' },
  { to: '/payroll', label: 'Payroll', icon: BadgeIndianRupee, permissions: ['payroll.view', 'payroll.manage'], group: 'Manage', keywords: 'salary payslip pf esi deduction net pay' },
  { to: '/roles', label: 'Roles & Permissions', icon: ShieldCheck, permissions: ['role.view', 'role.manage'], group: 'Manage', keywords: 'permission access designation correspondent principal grant' },
  { to: '/branches', label: 'Branches', icon: Building2, permissions: ['org.view', 'org.manage'], group: 'Manage', keywords: 'trust group campus school multi branch administrator' },
  { to: '/settings', label: 'Settings', icon: Settings, permissions: ['dashboard.view'], group: 'Manage', keywords: 'profile theme password' },
];

export const allows = (held: readonly string[], item: NavItem) =>
  item.permissions.some((p) => held.includes(p));

export const navFor = (held: readonly string[]) => NAV.filter((item) => allows(held, item));

export const permissionsForPath = (path: string) =>
  NAV.find((n) => n.to === path)?.permissions ?? [];

export const GROUP_ORDER: NavItem['group'][] = ['My Child', 'School', 'Manage'];

/** Parents and students see "My Child"; staff see the same block as academics. */
export const groupLabel = (group: NavItem['group'], roles: readonly string[]) =>
  group === 'My Child' && !roles.includes('parent') && !roles.includes('student')
    ? 'Academics'
    : group;
