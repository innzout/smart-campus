import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, RotateCcw, ShieldCheck, UserCog, Users } from 'lucide-react';
import { useCan } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { staffOf } from '@/lib/queries';
import { setUserRoles } from '@/lib/actions';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_CATALOGUE,
  isRoleEdited,
  permissionsForRole,
  primaryRole,
  roleName,
  setRolePermissions,
} from '@/services/auth.service';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { DESIGNATION_LABEL } from '@/data/types';
import type { Role, User } from '@/data/types';

/**
 * Roles and permissions.
 *
 * Two things this screen exists to make true. First, a person holds several
 * roles rather than one: in a school of five hundred the Accounts Officer is
 * also the Payroll Officer, and a Vice Principal still teaches. Inventing a
 * combined role for each pairing produces a list no school recognises, so
 * permissions are the union of what they hold.
 *
 * Second, what a role may do is data, not code. A school that wants its Office
 * Superintendent to collect fees can grant it here without waiting for us.
 */

const ROLES = Object.keys(ROLE_CATALOGUE) as Role[];

export default function Roles() {
  const db = useDatabase();
  const can = useCan();
  const manage = can('role.manage');

  const [editing, setEditing] = useState<Role | null>(null);
  const [assigning, setAssigning] = useState<User | null>(null);

  const staff = staffOf(db);
  const countFor = (role: Role) => db.users.filter((u) => u.roles.includes(role)).length;
  const edited = ROLES.filter((r) => isRoleEdited(r));
  const multiRole = staff.filter((u) => u.roles.length > 1);

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        subtitle="What each role may do, and who holds which. A person may hold more than one."
      />

      <StatGrid>
        <StatTile label="Roles defined" value={ROLES.length} note="From trust to student" icon={ShieldCheck} />
        <StatTile
          label="Permissions"
          value={ALL_PERMISSIONS.length}
          note="Individually grantable"
          icon={KeyRound}
          delay={0.06}
        />
        <StatTile
          label="Holding several roles"
          value={multiRole.length}
          note="Staff wearing more than one hat"
          icon={UserCog}
          delay={0.12}
        />
        <StatTile
          label="Changed from default"
          value={edited.length}
          note={edited.length ? 'Edited by the school' : 'All at factory settings'}
          icon={Users}
          tone={edited.length ? 'warning' : 'neutral'}
          delay={0.18}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── the role catalogue ── */}
        <MotionCard delay={0.1}>
          <CardHeader
            title="Roles"
            subtitle={manage ? 'Open a role to change what it may do' : 'What each role may do'}
          />
          <CardBody className="pt-4">
            <ul className="space-y-2">
              {ROLES.map((role) => {
                const def = ROLE_CATALOGUE[role];
                const held = countFor(role);
                const changed = isRoleEdited(role);
                return (
                  <li key={role}>
                    <button
                      type="button"
                      onClick={() => setEditing(role)}
                      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {def.name}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-3">
                          {def.blurb}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center gap-2">
                        {changed ? <Badge tone="info">Edited</Badge> : null}
                        <Badge tone="neutral">
                          {permissionsForRole(role).length} permissions
                        </Badge>
                        <Badge tone={held ? 'brand' : 'neutral'}>
                          {held} {held === 1 ? 'person' : 'people'}
                        </Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </MotionCard>

        {/* ── who holds what ── */}
        <MotionCard delay={0.16}>
          <CardHeader
            title="Staff and their roles"
            subtitle="Designation is what they are employed as; roles are what they may do"
          />
          <CardBody className="pt-4">
            {staff.length === 0 ? (
              <EmptyState
                icon={<Users className="size-6" />}
                title="No staff on roll"
                description="Approve a staff application to create an account."
              />
            ) : (
              <ul className="space-y-2">
                {staff.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={!manage}
                      onClick={() => setAssigning(u)}
                      className={cn(
                        'flex w-full flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors',
                        manage && 'hover:border-line-strong hover:bg-surface-hover',
                      )}
                    >
                      <Avatar name={u.name} hue={u.avatarHue} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {u.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          {u.designation ? DESIGNATION_LABEL[u.designation] : 'Staff'} ·{' '}
                          {u.employeeId}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <Badge
                            key={r}
                            tone={r === primaryRole(u.roles) ? 'brand' : 'neutral'}
                          >
                            {roleName(r)}
                          </Badge>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </MotionCard>
      </div>

      {editing ? (
        <PermissionDialog role={editing} canEdit={manage} onClose={() => setEditing(null)} />
      ) : null}
      {assigning ? (
        <AssignRolesDialog user={assigning} onClose={() => setAssigning(null)} />
      ) : null}
    </>
  );
}

/* ── editing a role's permission set ─────────────────────────────────── */

function PermissionDialog({
  role,
  canEdit,
  onClose,
}: {
  role: Role;
  canEdit: boolean;
  onClose: () => void;
}) {
  const def = ROLE_CATALOGUE[role];
  const [held, setHeld] = useState<string[]>(() => permissionsForRole(role));

  const toggle = (key: string) =>
    setHeld((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const save = () => {
    setRolePermissions(role, held);
    toast.success(`${def.name} updated`, {
      description: `${held.length} permissions. Anyone holding this role sees the change on their next page load.`,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={def.name}
      description={def.blurb}
      size="lg"
      footer={
        canEdit ? (
          <>
            <Button
              variant="ghost"
              icon={<RotateCcw className="size-4" />}
              onClick={() => {
                setRolePermissions(role, null);
                toast.success(`${def.name} reset to the default set`);
                onClose();
              }}
            >
              Reset to default
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={held.length === 0}>
              Save permissions
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          Navigation and every page guard read these permissions directly, so removing one hides the
          page it unlocks rather than leaving a screen that errors when opened.
        </p>

        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
              {group.label}
            </p>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <Checkbox
                  key={item.key}
                  label={
                    <span>
                      {item.label}
                      <span className="ml-1.5 text-[11px] text-ink-3">{item.key}</span>
                    </span>
                  }
                  checked={held.includes(item.key)}
                  disabled={!canEdit}
                  onChange={() => toggle(item.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ── changing the roles a person holds ───────────────────────────────── */

function AssignRolesDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [roles, setRoles] = useState<Role[]>(user.roles);

  const toggle = (role: Role) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const save = () => {
    setUserRoles(user.id, roles);
    toast.success(`${user.name}'s roles updated`, {
      description: `${roles.length} role${roles.length === 1 ? '' : 's'} — their menu changes accordingly.`,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user.name}
      description={`${user.designation ? DESIGNATION_LABEL[user.designation] : 'Staff'} · ${user.employeeId}. Tick every role this person holds.`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={roles.length === 0}>
            Save roles
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          Their permissions are the union of every role ticked. A person must keep at least one.
        </p>
        {(Object.keys(ROLE_CATALOGUE) as Role[])
          .filter((r) => r !== 'student' && r !== 'parent')
          .map((role) => (
            <Checkbox
              key={role}
              label={
                <span>
                  <span className="font-medium text-ink">{ROLE_CATALOGUE[role].name}</span>
                  <span className="ml-1.5 text-[11.5px] text-ink-3">
                    {ROLE_CATALOGUE[role].blurb}
                  </span>
                </span>
              }
              checked={roles.includes(role)}
              onChange={() => toggle(role)}
            />
          ))}
      </div>
    </Modal>
  );
}
