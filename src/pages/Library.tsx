import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BookMarked, BookOpen, Clock, IndianRupee, RotateCcw, Search } from 'lucide-react';
import { useAuth, useCan } from '@/app/auth';
import { useDatabase } from '@/lib/store';
import { availableCopies, classById, classLabel, loansFor } from '@/lib/queries';
import { borrowBook, returnBook } from '@/lib/actions';
import { StatGrid, StatTile } from '@/components/StatTile';
import { CardBody, CardHeader, MotionCard } from '@/components/ui/Card';
import { Badge, StatusPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { cn, formatDate, money, num, relativeDay } from '@/lib/utils';
import type { Book, User } from '@/data/types';

const MAX_LOANS = 3;

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
    if (active.length >= MAX_LOANS) {
      toast.error('Borrowing limit reached', {
        description: `A student may hold ${MAX_LOANS} books. Please return one first.`,
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
    { key: 'shelf', header: 'Shelf', align: 'center', hideOnMobile: true, cell: (b) => <span className="tnum">{b.shelf}</span> },
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
        title="Library"
        subtitle={
          student
            ? `${student.name} · ${classLabel(db, student.classId)} · up to ${MAX_LOANS} books at a time`
            : `${num(db.books.length)} titles · ${num(db.books.reduce((t, b) => t + b.copies, 0))} copies`
        }
      />

      {student ? (
        <StatGrid>
          <StatTile label="Books with you" value={active.length} note={`Limit is ${MAX_LOANS}`} icon={BookOpen} />
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
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<RotateCcw className="size-3.5" />}
                        onClick={() => {
                          returnBook(loan.id);
                          toast.success('Returned', { description: `${book?.title} is back on shelf ${book?.shelf}.` });
                        }}
                      >
                        Return
                      </Button>
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
    </>
  );
}
