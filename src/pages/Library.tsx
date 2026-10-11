import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  BookPlus,
  Clock,
  IndianRupee,
  Library as LibraryIcon,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useAuth, useCan } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { availableCopies, classById, classLabel, loansFor } from '@/lib/queries';
import { addBook, borrowBook, renewLoan, returnBook, settleLoan } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, StatusPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { cn, formatDate, money, num, relativeDay } from '@/lib/utils';
import type { Book, Loan, User } from '@/data/types';

const MAX_RENEWALS = 2;

/**
 * How many books a child may hold at once. A library that issues three novels
 * to a seven-year-old gets none of them back, so the limit rises with the
 * class, as it does in practice.
 */
function loanLimitFor(grade: number | undefined) {
  if (grade == null) return 3;
  if (grade <= 5) return 1;
  if (grade <= 8) return 2;
  return 3;
}

export default function Library() {
  const { subject } = useAuth();
  const db = useDatabase();
  const can = useCan();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  // Staff browse the whole catalogue; a parent or student sees their own loans.
  const student: User | null = subject;
  const myLoans = student ? loansFor(db, student.id) : [];
  const active = myLoans.filter((l) => !l.loan.returnedOn);
  const overdue = active.filter((l) => l.overdue);
  const fines = myLoans.reduce((t, l) => t + l.loan.fine, 0);

  const grade = student ? classById(db, student.classId)?.grade : undefined;
  const maxLoans = loanLimitFor(grade);
  const manage = can('library.manage');
  const [accessionOpen, setAccessionOpen] = useState(false);
  const [settling, setSettling] = useState<Loan | null>(null);
  const categories = ['all', ...new Set(db.books.map((b) => b.category))];

  const books = db.books.filter((b) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    const matchesCategory = category === 'all' || b.category === category;
    // Children only see books for their own level.
    const matchesGrade = grade == null || b.forGrades.includes(grade);
    return matchesQuery && matchesCategory && matchesGrade;
  });

  const borrow = (book: Book) => {
    if (!student) return;
    if (active.length >= maxLoans) {
      toast.error('Borrowing limit reached', {
        description: `A pupil in class ${grade} may hold ${maxLoans} book${maxLoans === 1 ? '' : 's'}. Please return one first.`,
      });
      return;
    }
    if (availableCopies(db, book.id) <= 0) {
      toast.error('No copies available', { description: `${book.title} is fully issued.` });
      return;
    }
    const due = borrowBook(book.id, student.id);
    toast.success(`Issued: ${book.title}`, { description: `Return by ${formatDate(due)}.` });
  };

  const columns: Column<Book>[] = [
    {
      key: 'title',
      header: 'Book',
      sortBy: (b) => b.title,
      cell: (b) => (
        <div>
          <p className="font-semibold text-ink">{b.title}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-3">{b.author}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', hideOnMobile: true, sortBy: (b) => b.category, cell: (b) => <Badge tone="neutral">{b.category}</Badge> },
    { key: 'grades', header: 'Classes', align: 'center', hideOnMobile: true, cell: (b) => <span className="tnum text-[12px]">{b.forGrades.join(', ')}</span> },
    { key: 'shelf', header: 'Shelf', align: 'center', hideOnMobile: true, cell: (b) => <span className="tnum">{b.rack}</span> },
    {
      key: 'available',
      header: 'Availability',
      align: 'right',
      sortBy: (b) => availableCopies(db, b.id),
      cell: (b) => {
        const free = availableCopies(db, b.id);
        return (
          <span className="flex flex-col items-end gap-1">
            <StatusPill status={free > 0 ? 'available' : 'borrowed'} />
            <span className="tnum text-[11px] text-ink-3">{free} of {b.copies} free</span>
          </span>
        );
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (b) => {
        if (!student || !can('library.borrow')) return null;
        const have = active.some((l) => l.loan.bookId === b.id);
        return (
          <Button size="sm" variant={have ? 'ghost' : 'secondary'} disabled={have || availableCopies(db, b.id) <= 0} onClick={() => borrow(b)}>
            {have ? 'With you' : 'Borrow'}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        action={
          manage ? (
            <Button icon={<BookPlus className="size-4" />} onClick={() => setAccessionOpen(true)}>
              Accession a title
            </Button>
          ) : null
        }
        title="Library"
        subtitle={
          student
            ? `${student.name} · ${classLabel(db, student.classId)} · up to ${maxLoans} book${maxLoans === 1 ? '' : 's'} at a time`
            : `${num(db.books.length)} titles · ${num(db.books.reduce((t, b) => t + b.copies, 0))} copies`
        }
      />

      {student ? (
        <StatGrid>
          <StatTile label="Books with you" value={active.length} note={`Limit is ${maxLoans} for class ${grade}`} icon={BookOpen} />
          <StatTile
            label="Due soon"
            value={active.filter((l) => l.daysLeft >= 0 && l.daysLeft <= 3).length}
            note={active[0]?.book ? `${active[0].book.title} · ${relativeDay(active[0].loan.dueOn)}` : 'Nothing due'}
            icon={Clock}
            tone={active.some((l) => l.daysLeft >= 0 && l.daysLeft <= 3) ? 'warning' : 'good'}
            delay={0.06}
          />
          <StatTile label="Overdue" value={overdue.length} note={overdue.length ? 'Fine of ₹2 per day' : 'Nothing overdue'} icon={AlertTriangle} tone={overdue.length ? 'critical' : 'good'} delay={0.12} />
          <StatTile label="Fine due" value={money(fines)} note={fines ? 'Payable at the library' : 'No fines'} icon={IndianRupee} tone={fines ? 'critical' : 'good'} delay={0.18} />
        </StatGrid>
      ) : null}

      {!student ? <LibrarianBoard onSettle={setSettling} /> : null}

      {student ? (
        <MotionCard delay={0.1}>
          <CardHeader title="Books with you" subtitle={`${active.length} on loan · ${myLoans.length - active.length} returned`} />
          <CardBody className="pt-4">
            {myLoans.length === 0 ? (
              <EmptyState icon={<BookMarked className="size-6" />} title="No books borrowed" description="Browse the catalogue below." />
            ) : (
              <ul className="space-y-2.5">
                {myLoans.map(({ loan, book, overdue: isOverdue }) => (
                  <li
                    key={loan.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-xl border p-4',
                      isOverdue ? 'border-[--color-critical]/35 bg-[--color-critical]/[0.04]'
                      : loan.returnedOn ? 'border-line bg-surface-2/60'
                      : 'border-line bg-surface',
                    )}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                      <BookOpen className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">{book?.title ?? 'Unknown'}</span>
                        <StatusPill status={loan.returnedOn ? 'returned' : isOverdue ? 'overdue' : 'borrowed'} />
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-ink-3">
                        {book?.author} · borrowed {formatDate(loan.borrowedOn)}
                        {loan.returnedOn ? ` · returned ${formatDate(loan.returnedOn)}` : ` · due ${formatDate(loan.dueOn)} (${relativeDay(loan.dueOn)})`}
                      </span>
                      {loan.fine > 0 ? (
                        <span className="mt-1 block text-[11.5px] font-semibold text-[--color-critical]">
                          Fine: {money(loan.fine)}
                        </span>
                      ) : null}
                    </span>
                    {!loan.returnedOn && can('library.borrow') ? (
                      <span className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<RefreshCw className="size-3.5" />}
                          disabled={loan.renewals >= MAX_RENEWALS}
                          onClick={() => {
                            if (renewLoan(loan.id, MAX_RENEWALS)) {
                              toast.success('Renewed for another fortnight', {
                                description: `${loan.renewals + 1} of ${MAX_RENEWALS} renewals used.`,
                              });
                            } else {
                              toast.error('Cannot renew', {
                                description: 'This loan has already been renewed the maximum number of times.',
                              });
                            }
                          }}
                        >
                          {loan.renewals >= MAX_RENEWALS ? 'No renewals left' : 'Renew'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<RotateCcw className="size-3.5" />}
                          onClick={() => {
                            returnBook(loan.id);
                            toast.success('Returned', { description: `${book?.title} is back on shelf ${book?.rack}.` });
                          }}
                        >
                          Return
                        </Button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </MotionCard>
      ) : null}

      <MotionCard delay={0.16} className={student ? 'mt-5' : ''}>
        <CardHeader
          title="Catalogue"
          subtitle={`${books.length} of ${db.books.length} titles${grade ? ` suitable for Class ${grade}` : ''}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title or author…"
                aria-label="Search the catalogue"
                leading={<Search className="size-4" />}
                className="h-9 w-full text-[13px] sm:w-56"
              />
              <Segmented
                size="sm"
                value={category}
                onChange={setCategory}
                options={categories.slice(0, 5).map((c) => ({ value: c, label: c === 'all' ? 'All' : c }))}
              />
            </div>
          }
        />
        <CardBody className="pt-4">
          <DataTable
            columns={columns}
            rows={books}
            initialSort={{ key: 'title', dir: 'asc' }}
            empty={<EmptyState icon={<Search className="size-6" />} title="No titles match" description={`Nothing matches “${query}”.`} />}
          />
        </CardBody>
      </MotionCard>

      <AccessionDialog open={accessionOpen} onClose={() => setAccessionOpen(false)} />
      {settling ? <SettleDialog loan={settling} onClose={() => setSettling(null)} /> : null}
    </>
  );
}

/* ── what the librarian needs: what is out, and what is overdue ───────── */

function LibrarianBoard({ onSettle }: { onSettle: (loan: Loan) => void }) {
  const db = useDatabase();
  const can = useCan();
  const manage = can('library.manage');

  const outstanding = db.loans.filter((l) => !l.returnedOn);
  const overdue = outstanding.filter((l) => l.fine > 0);
  const fines = db.loans.reduce((t, l) => t + (l.returnedOn ? 0 : l.fine), 0);
  const copies = db.books.reduce((t, b) => t + b.copies, 0);

  return (
    <>
      <StatGrid>
        <StatTile
          label="Titles"
          value={num(db.books.length)}
          note={`${num(copies)} copies accessioned`}
          icon={LibraryIcon}
        />
        <StatTile
          label="On loan"
          value={outstanding.length}
          note={`${Math.round((outstanding.length / Math.max(copies, 1)) * 100)}% of the stock is out`}
          icon={BookOpen}
          delay={0.06}
        />
        <StatTile
          label="Overdue"
          value={overdue.length}
          note={overdue.length ? 'Fine of ₹2 a day' : 'Nothing overdue'}
          icon={AlertTriangle}
          tone={overdue.length ? 'critical' : 'good'}
          delay={0.12}
        />
        <StatTile
          label="Fines outstanding"
          value={money(fines)}
          note={fines ? 'Collectable at the counter' : 'Nothing outstanding'}
          icon={IndianRupee}
          tone={fines ? 'warning' : 'good'}
          delay={0.18}
        />
      </StatGrid>

      <MotionCard delay={0.1} className="mb-5">
        <CardHeader
          title="Out on loan"
          subtitle="Overdue first — these are the ones to chase"
        />
        <CardBody className="pt-4">
          {outstanding.length === 0 ? (
            <EmptyState
              icon={<BookMarked className="size-6" />}
              title="Every copy is on the shelf"
              description="Nothing is currently issued."
            />
          ) : (
            <ul className="space-y-2">
              {[...outstanding]
                .sort((a, b) => b.fine - a.fine || a.dueOn.localeCompare(b.dueOn))
                .slice(0, 25)
                .map((loan) => {
                  const book = db.books.find((b) => b.id === loan.bookId);
                  const borrower = db.users.find((u) => u.id === loan.studentId);
                  const isOverdue = loan.fine > 0;
                  return (
                    <li
                      key={loan.id}
                      className={cn(
                        'flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3',
                        isOverdue
                          ? 'border-[--color-critical]/35 bg-[--color-critical]/[0.04]'
                          : 'border-line',
                      )}
                    >
                      {borrower ? (
                        <Avatar name={borrower.name} hue={borrower.avatarHue} size="md" />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">
                          {book?.title ?? 'Unknown title'}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          {borrower?.name ?? '—'} · {classLabel(db, borrower?.classId)} · rack{' '}
                          {book?.rack} · due {formatDate(loan.dueOn)} ({relativeDay(loan.dueOn)})
                          {loan.renewals ? ` · renewed ${loan.renewals}×` : ''}
                        </span>
                      </span>

                      {isOverdue ? (
                        <Badge tone="critical">Fine {money(loan.fine)}</Badge>
                      ) : (
                        <Badge tone="neutral">On loan</Badge>
                      )}

                      {manage ? (
                        <span className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              returnBook(loan.id);
                              toast.success('Returned', {
                                description: `${book?.title} is back on rack ${book?.rack}.`,
                              });
                            }}
                          >
                            Return
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onSettle(loan)}>
                            Lost or damaged
                          </Button>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          )}
        </CardBody>
      </MotionCard>
    </>
  );
}

/* ── closing a loan as lost or damaged ───────────────────────────────── */

function SettleDialog({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const db = useDatabase();
  const book = db.books.find((b) => b.id === loan.bookId);
  const borrower = db.users.find((u) => u.id === loan.studentId);
  const [condition, setCondition] = useState<'damaged' | 'lost'>('damaged');

  const charge = Math.round((book?.price ?? 0) * (condition === 'lost' ? 1 : 0.5));

  return (
    <Modal
      open
      onClose={onClose}
      title={book?.title ?? 'Settle loan'}
      description={`${borrower?.name ?? 'The borrower'} · ${classLabel(db, borrower?.classId)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              settleLoan(loan.id, condition);
              toast.success(`Recorded as ${condition}`, {
                description: `₹${charge} charged to the fee account and the parent notified.`,
              });
              onClose();
            }}
          >
            Charge {money(charge)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Condition" htmlFor="sc">
          <Select
            id="sc"
            value={condition}
            onChange={(e) => setCondition(e.target.value as 'damaged' | 'lost')}
          >
            <option value="damaged">Damaged — charged at half price</option>
            <option value="lost">Lost — charged at full price, copy written off</option>
          </Select>
        </Field>
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          The book is priced at {money(book?.price ?? 0)}, so {money(charge)} will be added to the
          fee account along with any fine already due.
          {condition === 'lost'
            ? ' The copy count falls by one, so the catalogue stays accurate.'
            : ''}
        </p>
      </div>
    </Modal>
  );
}

/* ── accessioning a new title ────────────────────────────────────────── */

function AccessionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState('Fiction');
  const [copies, setCopies] = useState(3);
  const [rack, setRack] = useState('');
  const [price, setPrice] = useState(200);
  const [fromGrade, setFromGrade] = useState(6);
  const [toGrade, setToGrade] = useState(10);

  const valid = title.trim().length > 2 && author.trim().length > 2 && toGrade >= fromGrade;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Accession a title"
      description="An accession number is allotted automatically, as the register does."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              addBook({
                title: title.trim(),
                author: author.trim(),
                publisher: publisher.trim(),
                isbn: isbn.trim(),
                category,
                copies,
                rack: rack.trim() || 'Unshelved',
                forGrades: Array.from(
                  { length: toGrade - fromGrade + 1 },
                  (_, i) => fromGrade + i,
                ),
                price,
              });
              toast.success(`${title.trim()} accessioned`, {
                description: `${copies} copies on rack ${rack.trim() || 'Unshelved'}.`,
              });
              setTitle('');
              setAuthor('');
              onClose();
            }}
          >
            Add to catalogue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required htmlFor="bt2">
          <Input id="bt2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Author" required htmlFor="ba2">
            <Input id="ba2" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Publisher" htmlFor="bp2">
            <Input id="bp2" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ISBN" htmlFor="bi2">
            <Input id="bi2" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
          </Field>
          <Field label="Category" htmlFor="bc2">
            <Select id="bc2" value={category} onChange={(e) => setCategory(e.target.value)}>
              {[
                'Fiction',
                'Children',
                'Tamil Literature',
                'Biography',
                'Science',
                'Mathematics',
                'Social Science',
                'Computer Science',
                'Competitive',
                'Reference',
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Copies" htmlFor="bcp">
            <Input
              id="bcp"
              type="number"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Number(e.target.value))}
            />
          </Field>
          <Field label="Rack" htmlFor="brk">
            <Input
              id="brk"
              value={rack}
              placeholder="C-04"
              onChange={(e) => setRack(e.target.value)}
            />
          </Field>
          <Field label="Price (₹)" htmlFor="bpr" hint="Used to charge for a lost copy.">
            <Input
              id="bpr"
              type="number"
              min={0}
              step={10}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Suitable from class" htmlFor="bfg">
            <Select
              id="bfg"
              value={String(fromGrade)}
              onChange={(e) => setFromGrade(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="up to class"
            htmlFor="btg"
            error={toGrade < fromGrade ? 'Must not be below the lower class.' : undefined}
          >
            <Select
              id="btg"
              value={String(toGrade)}
              onChange={(e) => setToGrade(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
