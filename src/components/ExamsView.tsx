import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Filter,
  Layers,
  Calendar,
} from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import { Modal } from './Modal';
import {
  formatDeadlineCountdown,
  formatLocalDateReadable,
  toLocalDateString,
  parseLocalDateParts,
} from '../utils/dateAndMath';
import type { DeadlineItem, DeadlineType } from '../types/campuskit';

const TYPE_BADGES: Record<
  DeadlineType,
  { label: string; bg: string; text: string; ring: string }
> = {
  Exam: {
    label: 'Exam',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-200/80 dark:ring-rose-900/60',
  },
  Assignment: {
    label: 'Assignment',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-200/80 dark:ring-indigo-900/60',
  },
  Quiz: {
    label: 'Quiz',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200/80 dark:ring-amber-900/60',
  },
};

export const ExamsView: React.FC = () => {
  const { deadlines, saveDeadline, toggleDeadlineComplete, deleteDeadline, now } = useCampusKit();

  const [typeFilter, setTypeFilter] = useState<'all' | DeadlineType>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeadlineItem | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DeadlineType>('Exam');
  const [dueDate, setDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openNewDeadlineModal = () => {
    setEditingItem(null);
    setTitle('');
    setType('Exam');
    setDueDate(toLocalDateString(now));
    setFormError(null);
    setModalOpen(true);
  };

  const openEditDeadlineModal = (item: DeadlineItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setType(item.type);
    setDueDate(item.dueDate);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Please enter a title or course name.');
      return;
    }
    if (!dueDate || !parseLocalDateParts(dueDate)) {
      setFormError('Please select a valid calendar date.');
      return;
    }

    saveDeadline({
      id: editingItem?.id,
      title: cleanTitle,
      type,
      dueDate,
      completed: editingItem?.completed ?? false,
    });
    setModalOpen(false);
  };

  const filteredAndSortedDeadlines = useMemo(() => {
    return deadlines
      .filter((d) => {
        if (typeFilter !== 'all' && d.type !== typeFilter) return false;
        if (statusFilter === 'active' && d.completed) return false;
        if (statusFilter === 'completed' && !d.completed) return false;
        return true;
      })
      .sort((a, b) => {
        // Active first, then by due date ascending
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [deadlines, typeFilter, statusFilter]);

  const activeCount = useMemo(() => deadlines.filter((d) => !d.completed).length, [deadlines]);
  const completedCount = useMemo(() => deadlines.filter((d) => d.completed).length, [deadlines]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Assessments & Deadlines
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Exams & Quizzes
            </h1>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Precise local calendar day countdowns across term dates.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewDeadlineModal}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add Deadline
          </button>
        </div>

        {/* Filter Controls */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 dark:border-stone-800">
          {/* Status Tabs */}
          <div className="inline-flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-medium transition ${
                statusFilter === 'active'
                  ? 'bg-white text-stone-900 shadow-2xs dark:bg-stone-700 dark:text-white'
                  : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-medium transition ${
                statusFilter === 'completed'
                  ? 'bg-white text-stone-900 shadow-2xs dark:bg-stone-700 dark:text-white'
                  : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              Done ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs dark:bg-stone-700 dark:text-white'
                  : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              All ({deadlines.length})
            </button>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-stone-400" />
            <select
              aria-label="Filter by deadline type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | DeadlineType)}
              className="min-h-[40px] rounded-xl border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
            >
              <option value="all">All Types</option>
              <option value="Exam">Exams</option>
              <option value="Assignment">Assignments</option>
              <option value="Quiz">Quizzes</option>
            </select>
          </div>
        </div>
      </section>

      {/* Deadlines List */}
      <section className="space-y-3">
        {filteredAndSortedDeadlines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center dark:border-stone-800">
            <Calendar className="mx-auto h-8 w-8 text-stone-400 dark:text-stone-600" />
            <h3 className="mt-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
              {deadlines.length === 0
                ? 'No deadlines scheduled yet'
                : 'No deadlines match the current filter'}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
              {deadlines.length === 0
                ? 'Add midterms, lab finals, term papers, and quizzes to keep track of upcoming dates.'
                : 'Try switching the filter to view all or completed deadlines.'}
            </p>
            {deadlines.length === 0 && (
              <button
                type="button"
                onClick={openNewDeadlineModal}
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Deadline
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAndSortedDeadlines.map((item) => {
              const countdown = formatDeadlineCountdown(item.dueDate, item.completed, now);
              const badge = TYPE_BADGES[item.type];

              // Styling per state
              let statusClasses = 'bg-stone-50 text-stone-600 dark:bg-stone-800 dark:text-stone-300';
              if (!item.completed) {
                if (countdown.state === 'overdue') {
                  statusClasses =
                    'bg-rose-100 text-rose-800 font-semibold dark:bg-rose-950/60 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-800';
                } else if (countdown.state === 'today') {
                  statusClasses =
                    'bg-amber-100 text-amber-900 font-semibold dark:bg-amber-950/60 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-800';
                } else if (countdown.diffDays === 1) {
                  statusClasses =
                    'bg-indigo-100 text-indigo-900 font-semibold dark:bg-indigo-950/60 dark:text-indigo-200';
                }
              }

              return (
                <div
                  key={item.id}
                  className={`flex items-start justify-between rounded-xl border p-4 shadow-2xs transition ${
                    item.completed
                      ? 'border-stone-200/60 bg-stone-50/50 opacity-70 dark:border-stone-800/60 dark:bg-stone-900/40'
                      : countdown.state === 'overdue'
                        ? 'border-rose-200 bg-white ring-1 ring-rose-200/50 dark:border-rose-900/50 dark:bg-stone-900'
                        : countdown.state === 'today'
                          ? 'border-amber-200 bg-white ring-1 ring-amber-200/50 dark:border-amber-900/50 dark:bg-stone-900'
                          : 'border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    <button
                      type="button"
                      onClick={() => toggleDeadlineComplete(item.id, !item.completed)}
                      aria-label={
                        item.completed
                          ? `Reopen ${item.title}`
                          : `Mark ${item.title} as completed`
                      }
                      className="mt-0.5 inline-flex min-h-[44px] min-w-[44px] items-center justify-center -ml-2 rounded-lg text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="h-5 w-5 text-stone-300 dark:text-stone-600" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${badge.bg} ${badge.text} ${badge.ring}`}
                        >
                          {badge.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${statusClasses}`}
                        >
                          {countdown.label}
                        </span>
                      </div>

                      <h3
                        className={`mt-1.5 break-words text-sm font-semibold text-stone-900 dark:text-stone-100 ${
                          item.completed ? 'line-through text-stone-500 dark:text-stone-400' : ''
                        }`}
                      >
                        {item.title}
                      </h3>

                      <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Due: {formatLocalDateReadable(item.dueDate)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditDeadlineModal(item)}
                      aria-label={`Edit ${item.title}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDeadline(item.id)}
                      aria-label={`Delete ${item.title}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Deadline Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Deadline' : 'Add New Deadline'}
      >
        <form onSubmit={handleSaveDeadline} className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="deadline-title" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              Title / Subject <span className="text-rose-500">*</span>
            </label>
            <input
              id="deadline-title"
              type="text"
              placeholder="e.g. Physics II Midterm, Database Lab Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="deadline-type" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Type
              </label>
              <select
                id="deadline-type"
                value={type}
                onChange={(e) => setType(e.target.value as DeadlineType)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                <option value="Exam">Exam (Mid / Final)</option>
                <option value="Assignment">Assignment / Report</option>
                <option value="Quiz">Quiz / Class Test</option>
              </select>
            </div>

            <div>
              <label htmlFor="deadline-due-date" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="deadline-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {editingItem ? 'Save Changes' : 'Add Deadline'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
