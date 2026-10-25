import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import type { AttendanceSubject } from '../types/campuskit';
import { computeAttendanceMetrics } from '../utils/dateAndMath';
import { Modal } from './Modal';

export const AttendView: React.FC = () => {
  const {
    attendance,
    attendanceUndo,
    undoLastAttendance,
    dismissAttendanceUndo,
    saveAttendanceSubject,
    markAttendance,
    deleteAttendanceSubject,
    quickModal,
    setQuickModal,
  } = useCampusKit();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AttendanceSubject | null>(null);
  const [correctingSubject, setCorrectingSubject] = useState<AttendanceSubject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceSubject | null>(null);

  const [name, setName] = useState('');
  const [requiredPct, setRequiredPct] = useState('80');
  const [totalHeld, setTotalHeld] = useState('0');
  const [attendedCount, setAttendedCount] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);

  const [corrTotal, setCorrTotal] = useState(0);
  const [corrAttended, setCorrAttended] = useState(0);
  const [corrError, setCorrError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingSubject(null);
    setName('');
    setRequiredPct('80');
    setTotalHeld('0');
    setAttendedCount('0');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (subj: AttendanceSubject) => {
    setEditingSubject(subj);
    setName(subj.name);
    setRequiredPct(String(subj.requiredPercentage));
    setTotalHeld(String(subj.total));
    setAttendedCount(String(subj.attended));
    setFormError(null);
    setIsFormOpen(true);
  };

  const openCorrectionModal = (subj: AttendanceSubject) => {
    setCorrectingSubject(subj);
    setCorrTotal(subj.total);
    setCorrAttended(subj.attended);
    setCorrError(null);
  };

  useEffect(() => {
    if (quickModal === 'record-attendance' && attendance.length === 0) {
      openAddModal();
      setQuickModal(null);
    }
  }, [quickModal, attendance.length]);

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Subject name is required.');
      return;
    }

    const reqNum = Number(requiredPct);
    if (!Number.isFinite(reqNum) || reqNum <= 0 || reqNum > 100) {
      setFormError('Required attendance % must be greater than 0 and at most 100.');
      return;
    }

    const totNum = Number(totalHeld);
    const attNum = Number(attendedCount);
    if (!Number.isInteger(totNum) || totNum < 0) {
      setFormError('Total classes held must be a whole number (0 or higher).');
      return;
    }
    if (!Number.isInteger(attNum) || attNum < 0) {
      setFormError('Attended classes must be a whole number (0 or higher).');
      return;
    }
    if (attNum > totNum) {
      setFormError('Attended classes cannot exceed total classes held.');
      return;
    }

    saveAttendanceSubject({
      id: editingSubject?.id,
      name: trimmedName,
      requiredPercentage: reqNum,
      total: totNum,
      attended: attNum,
    });
    setIsFormOpen(false);
  };

  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingSubject) return;
    if (!Number.isInteger(corrTotal) || corrTotal < 0) {
      setCorrError('Total classes must be 0 or greater.');
      return;
    }
    if (!Number.isInteger(corrAttended) || corrAttended < 0) {
      setCorrError('Attended classes must be 0 or greater.');
      return;
    }
    if (corrAttended > corrTotal) {
      setCorrError('Attended classes cannot exceed total held.');
      return;
    }
    saveAttendanceSubject({
      id: correctingSubject.id,
      name: correctingSubject.name,
      requiredPercentage: correctingSubject.requiredPercentage,
      total: corrTotal,
      attended: corrAttended,
    });
    setCorrectingSubject(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Attendance
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            One-tap Present / Absent · Exact safe misses &amp; recovery classes
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject</span>
        </button>
      </div>

      {attendanceUndo && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 px-4 py-3 flex items-center justify-between gap-3 shadow-md"
        >
          <p className="text-xs sm:text-sm font-medium min-w-0 truncate">
            Marked <strong>{attendanceUndo.actionLabel}</strong> for{' '}
            <strong>{attendanceUndo.subjectName}</strong>
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={undoLastAttendance}
              className="min-h-[44px] px-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={dismissAttendanceUndo}
              aria-label="Dismiss undo notice"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl opacity-75 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {attendance.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-stone-400 dark:text-stone-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            No subjects added yet
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto mt-1">
            Add each university course and its minimum attendance policy (default 80%). Record
            Present or Absent with one tap and see how many classes you can miss or must attend.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 min-h-[48px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Subject</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {attendance.map((subj) => {
            const m = computeAttendanceMetrics(subj);
            const barWidth =
              m.percentage !== null ? Math.min(100, Math.max(0, m.percentage)) : 0;

            return (
              <article
                key={subj.id}
                className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 break-words">
                      {subj.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums mt-0.5">
                      <span>
                        Attended {subj.attended} / {subj.total}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Required {subj.requiredPercentage}%</span>
                      {m.status !== 'NoData' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              m.status === 'Safe'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : m.status === 'Warning'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            Status: {m.status}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    {m.hasClasses && m.percentage !== null ? (
                      <p
                        className={`text-2xl font-bold ${
                          m.status === 'Safe'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : m.status === 'Warning'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {m.percentage.toFixed(1)}%
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-stone-400 dark:text-stone-500">
                        —
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-transform origin-left ${
                        !m.hasClasses
                          ? 'bg-stone-300 dark:bg-stone-700'
                          : m.status === 'Safe'
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : m.status === 'Warning'
                              ? 'bg-amber-500'
                              : 'bg-rose-600 dark:bg-rose-500'
                      }`}
                      style={{ transform: `scaleX(${barWidth / 100})` }}
                    />
                  </div>

                  {!m.hasClasses ? (
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      No classes recorded.
                    </p>
                  ) : (
                    <div className="text-xs text-stone-700 dark:text-stone-300 space-y-1 tabular-nums">
                      <p className="flex items-start gap-1.5 font-medium">
                        {m.status === 'Below' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <span>{m.summaryText}</span>
                      </p>
                      <p className="text-stone-500 dark:text-stone-400">
                        {m.status === 'Below'
                          ? m.isImpossible100
                            ? 'Safe misses: 0 · Recovery: Impossible at 100% requirement with past absences'
                            : `Safe misses: 0 · Recovery needed: ${m.recoveryClasses} ${
                                m.recoveryClasses === 1 ? 'class' : 'classes'
                              }`
                          : `Safe misses available: ${m.safeMisses} · Recovery needed: 0`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <button
                      type="button"
                      onClick={() => markAttendance(subj.id, 'present')}
                      className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Present</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => markAttendance(subj.id, 'absent')}
                      className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 active:scale-[0.99] text-stone-800 dark:text-stone-100 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <X className="w-4 h-4 shrink-0" />
                      <span>Absent</span>
                    </button>
                  </div>

                  <div className="flex items-center -mr-1.5">
                    <button
                      type="button"
                      onClick={() => openCorrectionModal(subj)}
                      aria-label={`Correct attendance counts for ${subj.name}`}
                      title="Correct attendance counts"
                      className="min-h-[44px] px-2.5 inline-flex items-center gap-1 rounded-xl text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Correct</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(subj)}
                      aria-label={`Edit ${subj.name}`}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(subj)}
                      aria-label={`Delete ${subj.name}`}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={quickModal === 'record-attendance' && attendance.length > 0}
        onClose={() => setQuickModal(null)}
        title="Record Today's Attendance"
      >
        <div className="space-y-3">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Tap Present or Absent for any class held today:
          </p>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {attendance.map((subj) => (
              <li
                key={subj.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {subj.name}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    {subj.attended}/{subj.total} attended
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => markAttendance(subj.id, 'present')}
                    className="min-h-[44px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    onClick={() => markAttendance(subj.id, 'absent')}
                    className="min-h-[44px] px-3.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold whitespace-nowrap"
                  >
                    Absent
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setQuickModal(null)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-sm font-medium text-stone-800 dark:text-stone-200"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add Subject'}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="attend-name"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Subject Name *
            </label>
            <input
              id="attend-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="e.g. EEE 101 Electrical Circuits"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="attend-req"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
            >
              Required Attendance Percentage (0–100%, default 80) *
            </label>
            <div className="flex items-center gap-2">
              <input
                id="attend-req"
                type="number"
                min="1"
                max="100"
                step="0.5"
                required
                value={requiredPct}
                onChange={(e) => {
                  setRequiredPct(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 tabular-nums"
              />
              {[75, 80, 90].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRequiredPct(String(preset))}
                  className="min-h-[44px] px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 tabular-nums shrink-0"
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="attend-total"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
              >
                Total Classes Held
              </label>
              <input
                id="attend-total"
                type="number"
                min="0"
                step="1"
                value={totalHeld}
                onChange={(e) => {
                  setTotalHeld(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="attend-present"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
              >
                Classes Attended
              </label>
              <input
                id="attend-present"
                type="number"
                min="0"
                step="1"
                value={attendedCount}
                onChange={(e) => {
                  setAttendedCount(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 tabular-nums"
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              {editingSubject ? 'Save Changes' : 'Add Subject'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(correctingSubject)}
        onClose={() => setCorrectingSubject(null)}
        title={correctingSubject ? `Correct Counts · ${correctingSubject.name}` : 'Correct Counts'}
        maxWidthClass="max-w-sm"
      >
        {correctingSubject && (
          <form onSubmit={handleSaveCorrection} className="space-y-4">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Adjust total classes held or classes attended if you tapped the wrong button earlier
              or want to match your department register.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div>
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    Total Held
                  </p>
                  <p className="text-[11px] text-stone-500">All classes conducted</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextT = Math.max(0, corrTotal - 1);
                      setCorrTotal(nextT);
                      if (corrAttended > nextT) setCorrAttended(nextT);
                      setCorrError(null);
                    }}
                    aria-label="Decrease total held"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-bold text-base"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    aria-label="Total held count"
                    value={corrTotal}
                    onChange={(e) => {
                      setCorrTotal(Math.max(0, Math.trunc(Number(e.target.value) || 0)));
                      setCorrError(null);
                    }}
                    className="w-16 min-h-[44px] text-center rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm font-semibold tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCorrTotal(corrTotal + 1);
                      setCorrError(null);
                    }}
                    aria-label="Increase total held"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div>
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    Attended
                  </p>
                  <p className="text-[11px] text-stone-500">Must be ≤ Total Held</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCorrAttended(Math.max(0, corrAttended - 1));
                      setCorrError(null);
                    }}
                    aria-label="Decrease attended"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-bold text-base"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    aria-label="Attended count"
                    value={corrAttended}
                    onChange={(e) => {
                      setCorrAttended(Math.max(0, Math.trunc(Number(e.target.value) || 0)));
                      setCorrError(null);
                    }}
                    className="w-16 min-h-[44px] text-center rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm font-semibold tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextA = corrAttended + 1;
                      setCorrAttended(nextA);
                      if (nextA > corrTotal) setCorrTotal(nextA);
                      setCorrError(null);
                    }}
                    aria-label="Increase attended"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {corrError && (
              <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {corrError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCorrectingSubject(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-sm font-medium text-stone-700 dark:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
              >
                Apply Correction
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Subject"
        maxWidthClass="max-w-sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Delete <strong>{deleteTarget.name}</strong> ({deleteTarget.attended}/
              {deleteTarget.total} classes recorded)? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-sm font-medium text-stone-700 dark:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAttendanceSubject(deleteTarget.id);
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
