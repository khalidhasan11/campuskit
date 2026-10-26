import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  ClipboardList,
  Info,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Modal } from './Modal';
import { STORAGE_KEYS } from '../storage/localStore';
import {
  GRADE_OPTIONS,
  GRADE_POINTS_TENTHS,
  addTranscriptRows,
  computeTranscript,
  createBlankRows,
  resetTranscriptRows,
  type TranscriptRow,
} from '../utils/transcriptCgpa';

/**
 * Transcript CGPA Calculator (IUB style), modelled on the reference
 * calculator at shouravbr.github.io/iub-cgpa-calculator (rules verified from
 * its source and reproduced in src/utils/transcriptCgpa.ts).
 *
 * State is persisted additively under its own versioned localStorage key.
 * Since v1.1.0 it IS part of the main backup archive (see localStore.ts:
 * BackupArchive.transcript) and is removed by clear-all, so backup and
 * clear-all agree.
 */
const TRANSCRIPT_STORAGE_KEY = STORAGE_KEYS.transcript;

interface TranscriptState {
  prevCgpa: string;
  prevCredits: string;
  rows: TranscriptRow[];
}

const DEFAULT_STATE: TranscriptState = {
  prevCgpa: '',
  prevCredits: '',
  rows: createBlankRows(5),
};

function sanitizeRow(raw: unknown): TranscriptRow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const grade =
    typeof r.grade === 'string' && r.grade in GRADE_POINTS_TENTHS ? r.grade : 'A';
  return {
    name: typeof r.name === 'string' ? r.name.slice(0, 12) : '',
    grade,
    credit: typeof r.credit === 'string' ? r.credit.slice(0, 6) : '',
  };
}

function loadState(): TranscriptState {
  try {
    const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rows = Array.isArray(parsed.rows)
      ? parsed.rows.map(sanitizeRow).filter((r): r is TranscriptRow => r !== null)
      : [];
    return {
      prevCgpa: typeof parsed.prevCgpa === 'string' ? parsed.prevCgpa : '',
      prevCredits: typeof parsed.prevCredits === 'string' ? parsed.prevCredits : '',
      rows: rows.length > 0 ? rows : createBlankRows(5),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const inputClass =
  'mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100';

export const TranscriptCalculator: React.FC = () => {
  const [state, setState] = useState<TranscriptState>(loadState);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full/blocked: the calculator keeps working in-memory.
    }
  }, [state]);

  // Reload after a backup restore or clear-all changes the storage key
  // underneath this component's in-memory state (dispatched by context).
  useEffect(() => {
    const reload = () => setState(loadState());
    window.addEventListener('campuskit:transcript-restored', reload);
    return () => window.removeEventListener('campuskit:transcript-restored', reload);
  }, []);

  const result = useMemo(
    () =>
      computeTranscript({
        prevCgpa: state.prevCgpa,
        prevCredits: state.prevCredits,
        rows: state.rows,
      }),
    [state]
  );

  const updateRow = (index: number, patch: Partial<TranscriptRow>) => {
    setState((s) => ({
      ...s,
      rows: s.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  };

  const removeRow = (index: number) => {
    setState((s) =>
      s.rows.length <= 1 ? s : { ...s, rows: s.rows.filter((_, i) => i !== index) }
    );
  };

  const handleResetRows = () => {
    // Reference semantics: reset clears ONLY the course rows (back to 5 blank
    // rows) and keeps the Previous CGPA / Previously earned credits inputs.
    setState((s) => ({ ...s, rows: resetTranscriptRows() }));
    setResetConfirmOpen(false);
  };

  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start gap-2.5">
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Transcript CGPA Calculator
            </h2>
            <span className="rounded-sm bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/70 dark:text-indigo-200">
              IUB style
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            Enter the CGPA and earned credits from your transcript, then add this
            semester&apos;s courses with their letter grades. Unofficial estimate —
            it may vary from the official transcript.
          </p>
        </div>
      </div>

      {/* Previous academic record */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="tc-prev-cgpa"
            className="block text-xs font-medium text-stone-700 dark:text-stone-300"
          >
            Previous CGPA <span className="text-rose-500">*</span>
          </label>
          <input
            id="tc-prev-cgpa"
            type="number"
            step="0.01"
            min="0"
            max="4"
            placeholder="e.g. 3.50"
            value={state.prevCgpa}
            onChange={(e) => setState((s) => ({ ...s, prevCgpa: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="tc-prev-credits"
            className="block text-xs font-medium text-stone-700 dark:text-stone-300"
          >
            Previously Earned Credits <span className="text-rose-500">*</span>
          </label>
          <input
            id="tc-prev-credits"
            type="number"
            step="0.5"
            min="0"
            placeholder="e.g. 60"
            value={state.prevCredits}
            onChange={(e) => setState((s) => ({ ...s, prevCredits: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-stone-400 dark:text-stone-500">
        Leave either field at 0 (or blank) if you have no previous record yet.
      </p>

      {/* Course rows */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
            New Courses
          </h3>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            Only the grade and credit are required
          </span>
        </div>

        {state.rows.map((row, i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-2.5 dark:border-stone-800 dark:bg-stone-900/50"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-stone-400">
                {i + 1}
              </span>
              <input
                type="text"
                aria-label={`Course ${i + 1} name or code (optional)`}
                placeholder="Course (optional)"
                maxLength={12}
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value.toUpperCase() })}
                className="block min-h-[44px] min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2.5 text-sm uppercase text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={state.rows.length <= 1}
                aria-label={`Remove course row ${i + 1}`}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex gap-2 pl-8">
              <div className="min-w-0 flex-1">
                <label htmlFor={`tc-grade-${i}`} className="sr-only">
                  Course {i + 1} grade
                </label>
                <select
                  id={`tc-grade-${i}`}
                  value={row.grade}
                  onChange={(e) => updateRow(i, { grade: e.target.value })}
                  className="block min-h-[44px] w-full rounded-lg border border-stone-300 bg-white px-2.5 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g.letter} value={g.letter}>
                      {g.letter} ({g.points.toFixed(1)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24 shrink-0">
                <label htmlFor={`tc-credit-${i}`} className="sr-only">
                  Course {i + 1} credit
                </label>
                <input
                  id={`tc-credit-${i}`}
                  type="number"
                  step="0.5"
                  min="0"
                  max="9"
                  placeholder="Credit"
                  value={row.credit}
                  onChange={(e) => updateRow(i, { credit: e.target.value })}
                  className="block min-h-[44px] w-full rounded-lg border border-stone-300 bg-white px-2.5 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, rows: addTranscriptRows(s.rows) }))}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add 5 Rows
          </button>
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Courses
          </button>
        </div>
        <p className="text-[11px] text-stone-400 dark:text-stone-500">
          Reset clears only the course rows above (back to 5 blank rows). Your
          Previous CGPA and Previously Earned Credits stay as they are.
        </p>
      </div>

      {/* Validation / guidance */}
      {result.errors.length > 0 && (
        <div className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {result.errors.map((err) => (
            <div key={err} className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}
      {result.errors.length === 0 && result.totalCredits === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-xs text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            Enter your previous credits, or give at least one course a credit above
            0, to see your updated CGPA.
          </span>
        </div>
      )}
      {result.errors.length === 0 && result.skippedRows > 0 && result.totalCredits > 0 && (
        <p className="mt-3 text-[11px] text-stone-400 dark:text-stone-500">
          {result.skippedRows} incomplete row{result.skippedRows === 1 ? '' : 's'}{' '}
          skipped — a row counts only when its credit is above 0.
        </p>
      )}

      {/* Results */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-indigo-50/80 p-4 ring-1 ring-indigo-200/60 dark:bg-indigo-950/40 dark:ring-indigo-900/60">
          <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
            Updated CGPA
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-indigo-950 dark:text-indigo-100">
              {result.updatedCgpa !== null ? result.updatedCgpa.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              / 4.00
            </span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
            {result.countedRows} new course{result.countedRows === 1 ? '' : 's'} counted
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <Award className="h-3.5 w-3.5" />
            Est. Merit Scholarship
          </span>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-950 dark:text-emerald-100">
            {result.meritPercent !== null ? `${result.meritPercent}%` : '--'}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-emerald-700/80 dark:text-emerald-300/80">
            100% at 3.85+ · 75% at 3.80+ · 50% at 3.70+ · 30% at 3.51+. Estimated
            from the updated CGPA — check IUB&apos;s official financial-aid rules.
          </p>
        </div>

        <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Total Credits
          </span>
          <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {result.totalCredits}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            After the new courses
          </p>
        </div>

        <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Total Grade Points
          </span>
          <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {result.totalPoints.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Σ (Grade point × Credit)
          </p>
        </div>
      </div>

      {/* Reset confirmation (reference clears rows but keeps transcript inputs) */}
      <Modal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Reset course rows?"
      >
        <p className="text-sm text-stone-600 dark:text-stone-300">
          This removes all course rows and starts again with 5 blank rows. Your
          Previous CGPA and Previously Earned Credits will be kept.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setResetConfirmOpen(false)}
            className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleResetRows}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-rose-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95"
          >
            Reset Courses
          </button>
        </div>
      </Modal>
    </section>
  );
};
