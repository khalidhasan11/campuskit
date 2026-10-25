import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import type { RoutineClass } from '../types/campuskit';
import {
  WEEKDAY_NAMES_FULL,
  findOverlappingClasses,
  formatClockTime,
  getClassLiveState,
  getOrderedWeekdays,
  parseMinutesFromMidnight,
} from '../utils/dateAndMath';
import { Modal } from './Modal';

export const RoutineView: React.FC = () => {
  const {
    now,
    settings,
    routine,
    saveRoutineClass,
    deleteRoutineClass,
    quickModal,
    setQuickModal,
  } = useCampusKit();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<RoutineClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoutineClass | null>(null);

  const [subject, setSubject] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(() => now.getDay());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [room, setRoom] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [overlapAcknowledged, setOverlapAcknowledged] = useState(false);

  const openAddModal = (defaultDay?: number) => {
    setEditingClass(null);
    setSubject('');
    setDayOfWeek(defaultDay ?? now.getDay());
    setStartTime('09:00');
    setEndTime('10:30');
    setRoom('');
    setFormError(null);
    setOverlapAcknowledged(false);
    setIsFormOpen(true);
  };

  const openEditModal = (cls: RoutineClass) => {
    setEditingClass(cls);
    setSubject(cls.subject);
    setDayOfWeek(cls.dayOfWeek);
    setStartTime(cls.startTime);
    setEndTime(cls.endTime);
    setRoom(cls.room);
    setFormError(null);
    setOverlapAcknowledged(false);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (quickModal === 'add-class') {
      openAddModal(now.getDay());
      setQuickModal(null);
    }
  }, [quickModal]);

  const liveOverlaps = useMemo(() => {
    return findOverlappingClasses(
      { id: editingClass?.id, dayOfWeek, startTime, endTime },
      routine
    );
  }, [editingClass?.id, dayOfWeek, startTime, endTime, routine]);

  useEffect(() => {
    setOverlapAcknowledged(false);
  }, [dayOfWeek, startTime, endTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setFormError('Subject name is required.');
      return;
    }
    const startMins = parseMinutesFromMidnight(startTime);
    const endMins = parseMinutesFromMidnight(endTime);
    if (startMins === null || endMins === null) {
      setFormError('Enter valid start and end times.');
      return;
    }
    if (endMins <= startMins) {
      setFormError('End time must be later than start time.');
      return;
    }
    if (liveOverlaps.length > 0 && !overlapAcknowledged) {
      setOverlapAcknowledged(true);
      setFormError(null);
      return;
    }

    saveRoutineClass({
      id: editingClass?.id,
      subject: trimmedSubject,
      dayOfWeek,
      startTime,
      endTime,
      room: room.trim(),
    });
    setIsFormOpen(false);
  };

  const orderedDays = useMemo(
    () => getOrderedWeekdays(settings.weekStart),
    [settings.weekStart]
  );

  const groupedByDay = useMemo(() => {
    const map = new Map<number, RoutineClass[]>();
    for (let d = 0; d < 7; d++) map.set(d, []);
    for (const cls of routine) {
      const list = map.get(cls.dayOfWeek) ?? [];
      list.push(cls);
      map.set(cls.dayOfWeek, list);
    }
    for (const [d, list] of map.entries()) {
      list.sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) ||
          a.endTime.localeCompare(b.endTime) ||
          a.subject.localeCompare(b.subject)
      );
      map.set(d, list);
    }
    return map;
  }, [routine]);

  const todayWeekday = now.getDay();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Weekly Routine
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Local device schedule · Week starts {WEEKDAY_NAMES_FULL[orderedDays[0]]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAddModal(todayWeekday)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Class</span>
        </button>
      </div>

      {routine.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-8 text-center">
          <Calendar className="w-8 h-8 text-stone-400 dark:text-stone-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Your class routine is empty
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto mt-1">
            Add your weekly lectures, labs, and tutorials. CampusKit highlights today&apos;s ongoing
            and upcoming classes automatically.
          </p>
          <button
            type="button"
            onClick={() => openAddModal(todayWeekday)}
            className="mt-5 min-h-[48px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Class</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {orderedDays.map((dayIdx) => {
            const dayClasses = groupedByDay.get(dayIdx) ?? [];
            const isToday = dayIdx === todayWeekday;

            return (
              <section
                key={dayIdx}
                aria-label={`${WEEKDAY_NAMES_FULL[dayIdx]} classes`}
                className={`rounded-2xl p-5 border transition-colors ${
                  isToday
                    ? 'bg-white dark:bg-stone-900 border-indigo-500/70 dark:border-indigo-500/70 ring-1 ring-indigo-500/20'
                    : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                      {WEEKDAY_NAMES_FULL[dayIdx]}
                    </h2>
                    {isToday && (
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        · Today
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddModal(dayIdx)}
                    aria-label={`Add class on ${WEEKDAY_NAMES_FULL[dayIdx]}`}
                    className="min-h-[44px] px-2.5 -mr-2 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {dayClasses.length === 0 ? (
                  <p className="text-xs text-stone-400 dark:text-stone-500 pt-3.5">
                    No classes scheduled.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800/80">
                    {dayClasses.map((cls) => {
                      const liveState = getClassLiveState(cls, now);
                      const overlaps = findOverlappingClasses(cls, dayClasses);
                      return (
                        <li key={cls.id} className="py-3.5 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 break-words">
                                  {cls.subject}
                                </p>
                                {isToday && liveState === 'ongoing' && (
                                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                    · Ongoing now
                                  </span>
                                )}
                                {isToday && liveState === 'upcoming' && (
                                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                    · Upcoming
                                  </span>
                                )}
                                {isToday && liveState === 'ended' && (
                                  <span className="text-xs text-stone-400 dark:text-stone-500">
                                    · Ended
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-600 dark:text-stone-400 tabular-nums mt-1">
                                <span>
                                  {formatClockTime(cls.startTime, settings.clockFormat)} –{' '}
                                  {formatClockTime(cls.endTime, settings.clockFormat)}
                                </span>
                                {cls.room && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>Room {cls.room}</span>
                                  </>
                                )}
                              </div>

                              {overlaps.length > 0 && (
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5 flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    Overlaps with {overlaps.map((o) => o.subject).join(', ')}
                                  </span>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center shrink-0 -mr-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(cls)}
                                aria-label={`Edit ${cls.subject}`}
                                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(cls)}
                                aria-label={`Delete ${cls.subject}`}
                                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingClass ? 'Edit Class' : 'Add Class'}
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="routine-subject"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Subject / Course Title *
            </label>
            <input
              id="routine-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="e.g. CSE 203 Data Structures"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="routine-day"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Day of Week *
            </label>
            <select
              id="routine-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
            >
              {orderedDays.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAMES_FULL[d]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="routine-start"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
              >
                Start Time *
              </label>
              <input
                id="routine-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="routine-end"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
              >
                End Time *
              </label>
              <input
                id="routine-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="routine-room"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Room / Lab (Optional)
            </label>
            <input
              id="routine-room"
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. AB4-302"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          {liveOverlaps.length > 0 && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1"
            >
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Time Overlap Detected</span>
              </p>
              <p>
                This slot overlaps on {WEEKDAY_NAMES_FULL[dayOfWeek]} with:{' '}
                <strong>
                  {liveOverlaps
                    .map(
                      (o) =>
                        `${o.subject} (${formatClockTime(o.startTime, settings.clockFormat)}–${formatClockTime(o.endTime, settings.clockFormat)})`
                    )
                    .join(', ')}
                </strong>
                .
              </p>
              {overlapAcknowledged && (
                <p className="font-medium pt-0.5">
                  Tap &ldquo;Save Overlapping Class&rdquo; below to keep both classes.
                </p>
              )}
            </div>
          )}

          {formError && (
            <p
              role="alert"
              className="text-xs font-medium text-rose-600 dark:text-rose-400"
            >
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              {liveOverlaps.length > 0 && overlapAcknowledged
                ? 'Save Overlapping Class'
                : editingClass
                  ? 'Save Changes'
                  : 'Save Class'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Class"
        maxWidthClass="max-w-sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Remove <strong>{deleteTarget.subject}</strong> on{' '}
              {WEEKDAY_NAMES_FULL[deleteTarget.dayOfWeek]} (
              {formatClockTime(deleteTarget.startTime, settings.clockFormat)} –{' '}
              {formatClockTime(deleteTarget.endTime, settings.clockFormat)}) from your routine?
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRoutineClass(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
