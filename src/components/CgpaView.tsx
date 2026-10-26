import React, { useState } from 'react';
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Calculator,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  BookOpen,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import { Modal } from './Modal';
import { TranscriptCalculator } from './TranscriptCalculator';
import {
  computeCompletedCgpa,
  computeProjectedCgpa,
  computeWhatIfGpa,
} from '../utils/dateAndMath';
import type { CompletedSemester, CurrentCourse } from '../types/campuskit';

export const CgpaView: React.FC = () => {
  const {
    settings,
    semesters,
    saveSemester,
    deleteSemester,
    courses,
    saveCourse,
    deleteCourse,
  } = useCampusKit();

  const gradingScaleMax = settings.gradingScaleMax ?? 4.0;

  // Completed semester modal state
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<CompletedSemester | null>(null);
  const [semName, setSemName] = useState('');
  const [semCredits, setSemCredits] = useState('');
  const [semGpa, setSemGpa] = useState('');
  const [semError, setSemError] = useState<string | null>(null);

  // Current course modal state
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CurrentCourse | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseCredits, setCourseCredits] = useState('');
  const [courseGradePoints, setCourseGradePoints] = useState('');
  const [courseError, setCourseError] = useState<string | null>(null);

  // What-If planner state
  const [whatIfCurrentCgpa, setWhatIfCurrentCgpa] = useState('');
  const [whatIfCompletedCredits, setWhatIfCompletedCredits] = useState('');
  const [whatIfTargetCgpa, setWhatIfTargetCgpa] = useState('');
  const [whatIfRemainingCredits, setWhatIfRemainingCredits] = useState('');

  // Calculations
  const completedStats = computeCompletedCgpa(semesters, gradingScaleMax);
  const projectedStats = computeProjectedCgpa(semesters, courses, gradingScaleMax);
  const whatIfResult = computeWhatIfGpa(
    whatIfCurrentCgpa,
    whatIfCompletedCredits,
    whatIfTargetCgpa,
    whatIfRemainingCredits,
    gradingScaleMax
  );

  // Prefill What-If from completed records
  const handleSyncWhatIfWithRecords = () => {
    if (completedStats.cgpa !== null) {
      setWhatIfCurrentCgpa(completedStats.cgpa.toFixed(2));
      setWhatIfCompletedCredits(String(completedStats.totalCredits));
    }
  };

  // Open Semester Modal
  const openNewSemesterModal = () => {
    setEditingSemester(null);
    setSemName('');
    setSemCredits('');
    setSemGpa('');
    setSemError(null);
    setSemesterModalOpen(true);
  };

  const openEditSemesterModal = (sem: CompletedSemester) => {
    setEditingSemester(sem);
    setSemName(sem.name);
    setSemCredits(String(sem.credits));
    setSemGpa(sem.gpa.toFixed(2));
    setSemError(null);
    setSemesterModalOpen(true);
  };

  const handleSaveSemester = (e: React.FormEvent) => {
    e.preventDefault();
    const name = semName.trim();
    if (!name) {
      setSemError('Please enter a semester name (e.g. Fall 2023, 1st Year 1st Sem).');
      return;
    }
    const credits = Number(semCredits);
    if (!Number.isFinite(credits) || credits <= 0 || credits > 40) {
      setSemError('Credits must be a valid number between 0.5 and 40.');
      return;
    }
    const gpa = Number(semGpa);
    if (!Number.isFinite(gpa) || gpa < 0 || gpa > gradingScaleMax) {
      setSemError(`GPA must be between 0.00 and ${gradingScaleMax.toFixed(2)}.`);
      return;
    }

    saveSemester({
      id: editingSemester?.id,
      name,
      credits,
      gpa,
    });
    setSemesterModalOpen(false);
  };

  // Open Course Modal
  const openNewCourseModal = () => {
    setEditingCourse(null);
    setCourseName('');
    setCourseCredits('');
    setCourseGradePoints('');
    setCourseError(null);
    setCourseModalOpen(true);
  };

  const openEditCourseModal = (c: CurrentCourse) => {
    setEditingCourse(c);
    setCourseName(c.name);
    setCourseCredits(String(c.credits));
    setCourseGradePoints(c.expectedGradePoints.toFixed(2));
    setCourseError(null);
    setCourseModalOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const name = courseName.trim();
    if (!name) {
      setCourseError('Please enter a course name or code (e.g. CSE115, MATH101).');
      return;
    }
    const credits = Number(courseCredits);
    if (!Number.isFinite(credits) || credits <= 0 || credits > 15) {
      setCourseError('Credits must be between 0.5 and 15.');
      return;
    }
    const gradePoints = Number(courseGradePoints);
    if (!Number.isFinite(gradePoints) || gradePoints < 0 || gradePoints > gradingScaleMax) {
      setCourseError(`Expected grade points must be between 0.00 and ${gradingScaleMax.toFixed(2)}.`);
      return;
    }

    saveCourse({
      id: editingCourse?.id,
      name,
      credits,
      expectedGradePoints: gradePoints,
    });
    setCourseModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Overview Card */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Academic Standing · {gradingScaleMax.toFixed(2)} Scale
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Cumulative CGPA
            </h1>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Strictly credit-weighted sum of quality points over total completed credits.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Official CGPA Display */}
          <div className="col-span-2 rounded-xl bg-indigo-50/80 p-4 ring-1 ring-indigo-200/60 sm:col-span-1 dark:bg-indigo-950/40 dark:ring-indigo-900/60">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              Cumulative CGPA
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-indigo-950 dark:text-indigo-100">
                {completedStats.cgpa !== null ? completedStats.cgpa.toFixed(2) : '--'}
              </span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                / {gradingScaleMax.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
              {completedStats.cgpa !== null
                ? `${completedStats.totalCredits} completed credits`
                : 'No completed semesters logged'}
            </p>
          </div>

          {/* Total Quality Points */}
          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Quality Points
            </span>
            <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">
              {completedStats.totalQualityPoints.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
              Σ (GPA × Credits)
            </p>
          </div>

          {/* Completed Credits */}
          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Earned Credits
            </span>
            <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">
              {completedStats.totalCredits}
            </p>
            <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
              {semesters.length} {semesters.length === 1 ? 'semester' : 'semesters'}
            </p>
          </div>
        </div>

        {/* Projected Cumulative Banner if current courses exist */}
        {courses.length > 0 && projectedStats.projectedCumulativeCgpa !== null && (
          <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Projected Cumulative CGPA
                  </span>
                  <span className="rounded-sm bg-emerald-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-200">
                    Estimate, not official
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-emerald-950 dark:text-emerald-100">
                    {projectedStats.projectedCumulativeCgpa.toFixed(2)}
                  </span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    across {projectedStats.combinedCredits} combined credits (includes current{' '}
                    {projectedStats.projectedSemesterGpa !== null
                      ? `${projectedStats.projectedSemesterGpa.toFixed(2)} term GPA`
                      : ''}
                    )
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Transcript CGPA Calculator (IUB style) */}
      <TranscriptCalculator />

      {/* Completed Semesters Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Completed Semesters
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Log past term GPAs and credit loads
            </p>
          </div>
          <button
            type="button"
            onClick={openNewSemesterModal}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add Semester
          </button>
        </div>

        {semesters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center dark:border-stone-800">
            <BookOpen className="mx-auto h-8 w-8 text-stone-400 dark:text-stone-600" />
            <h3 className="mt-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
              No completed semesters yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
              Add your completed semesters to compute your weighted cumulative CGPA across your university degree.
            </p>
            <button
              type="button"
              onClick={openNewSemesterModal}
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Semester
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {semesters.map((sem) => {
              const qp = sem.credits * sem.gpa;
              return (
                <div
                  key={sem.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-2xs transition dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="min-w-0 pr-3">
                    <h3 className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {sem.name}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                      <span>{sem.credits} credits</span>
                      <span>·</span>
                      <span>{qp.toFixed(2)} quality points</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-mono text-base font-bold text-stone-900 dark:text-stone-100">
                        {sem.gpa.toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-stone-400">GPA</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditSemesterModal(sem)}
                        aria-label={`Edit ${sem.name}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete the completed semester "${sem.name}"? This cannot be undone.`)) {
                            deleteSemester(sem.id);
                          }
                        }}
                        aria-label={`Delete ${sem.name}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Current Semester Projection Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Current Semester Courses
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Project semester GPA with expected course grades
            </p>
          </div>
          <button
            type="button"
            onClick={openNewCourseModal}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-xs transition hover:bg-indigo-100 active:scale-95 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
          >
            <Plus className="h-4 w-4" />
            Add Course
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-center dark:border-stone-800">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No current courses added. Add your ongoing courses and expected grade points to project this term&apos;s GPA.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100/70 p-3 text-xs dark:bg-stone-800/60">
              <div>
                <span className="text-stone-500 dark:text-stone-400">Current Term Credits:</span>
                <span className="ml-1.5 font-bold text-stone-800 dark:text-stone-200">
                  {projectedStats.currentCredits}
                </span>
              </div>
              <div className="text-right">
                <span className="text-stone-500 dark:text-stone-400">Projected Term GPA:</span>
                <span className="ml-1.5 font-bold text-stone-900 dark:text-stone-100">
                  {projectedStats.projectedSemesterGpa !== null
                    ? projectedStats.projectedSemesterGpa.toFixed(2)
                    : '--'}
                </span>
              </div>
            </div>

            {courses.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-2xs dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="min-w-0 pr-3">
                  <h3 className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {c.name}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {c.credits} credits · {(c.credits * c.expectedGradePoints).toFixed(2)} QP
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-mono text-base font-bold text-stone-900 dark:text-stone-100">
                      {c.expectedGradePoints.toFixed(2)}
                    </span>
                    <span className="block text-[10px] text-stone-400">Expected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditCourseModal(c)}
                      aria-label={`Edit ${c.name}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete the course "${c.name}"? This cannot be undone.`)) {
                          deleteCourse(c.id);
                        }
                      }}
                      aria-label={`Delete ${c.name}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* What-If Target Planner Section */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <Calculator className="h-4 w-4" />
              What-If Target Planner
            </div>
            <h2 className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
              Calculate Required GPA
            </h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Formula: [Target × (Completed + Remaining) − (Current × Completed)] ÷ Remaining
            </p>
          </div>
          {completedStats.cgpa !== null && (
            <button
              type="button"
              onClick={handleSyncWhatIfWithRecords}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-100 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750"
              title="Copy current CGPA and completed credits from logged semesters"
            >
              Sync Records
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label
              htmlFor="whatif-current-cgpa"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              Current CGPA
            </label>
            <input
              id="whatif-current-cgpa"
              type="number"
              step="0.01"
              min="0"
              max={gradingScaleMax.toFixed(2)}
              placeholder={`e.g. ${(gradingScaleMax * 0.85).toFixed(2)}`}
              value={whatIfCurrentCgpa}
              onChange={(e) => setWhatIfCurrentCgpa(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="whatif-completed-credits"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              Completed Credits
            </label>
            <input
              id="whatif-completed-credits"
              type="number"
              step="0.5"
              min="0"
              placeholder="e.g. 60"
              value={whatIfCompletedCredits}
              onChange={(e) => setWhatIfCompletedCredits(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="whatif-target-cgpa"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              Target CGPA
            </label>
            <input
              id="whatif-target-cgpa"
              type="number"
              step="0.01"
              min="0"
              max={gradingScaleMax.toFixed(2)}
              placeholder={`e.g. ${(gradingScaleMax * 0.9).toFixed(2)}`}
              value={whatIfTargetCgpa}
              onChange={(e) => setWhatIfTargetCgpa(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          <div>
            <label
              htmlFor="whatif-remaining-credits"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              Remaining Credits
            </label>
            <input
              id="whatif-remaining-credits"
              type="number"
              step="0.5"
              min="0"
              placeholder="e.g. 36"
              value={whatIfRemainingCredits}
              onChange={(e) => setWhatIfRemainingCredits(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>
        </div>

        {/* What-If Output Display */}
        <div className="mt-4">
          {whatIfResult.kind === 'empty' && (
            <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-xs text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">
              <Info className="h-4 w-4 shrink-0" />
              <span>Enter your numbers above to calculate your required future GPA.</span>
            </div>
          )}

          {whatIfResult.kind === 'error' && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{whatIfResult.message}</span>
            </div>
          )}

          {whatIfResult.kind === 'achievable' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100">
                      {whatIfResult.requiredGpa.toFixed(2)}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Required Average GPA / {gradingScaleMax.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-200">
                    {whatIfResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {whatIfResult.kind === 'already-secured' && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                    Target Already Secured
                  </h4>
                  <p className="mt-1 text-xs text-indigo-900 dark:text-indigo-200">
                    {whatIfResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {whatIfResult.kind === 'impossible' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-950 dark:text-rose-100">
                      Exceeds {gradingScaleMax.toFixed(2)}
                    </span>
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                      (Needs {whatIfResult.requiredGpa.toFixed(2)})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-rose-900 dark:text-rose-200">
                    {whatIfResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {whatIfResult.kind === 'zero-remaining' && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-800/50">
              <div className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-stone-500 dark:text-stone-400" />
                <div>
                  <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {whatIfResult.alreadyMet ? 'Target Met with 0 Credits Remaining' : 'Cannot Change CGPA'}
                  </h4>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                    {whatIfResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Completed Semester Modal */}
      <Modal
        isOpen={semesterModalOpen}
        onClose={() => setSemesterModalOpen(false)}
        title={editingSemester ? 'Edit Semester' : 'Add Completed Semester'}
      >
        <form onSubmit={handleSaveSemester} className="space-y-4">
          {semError && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {semError}
            </div>
          )}

          <div>
            <label htmlFor="sem-name" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              Semester Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="sem-name"
              type="text"
              placeholder="e.g. Spring 2024, Semester 1"
              value={semName}
              onChange={(e) => setSemName(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sem-credits" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Credits <span className="text-rose-500">*</span>
              </label>
              <input
                id="sem-credits"
                type="number"
                step="0.5"
                min="0.5"
                max="40"
                placeholder="e.g. 15"
                value={semCredits}
                onChange={(e) => setSemCredits(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label htmlFor="sem-gpa" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Term GPA <span className="text-rose-500">*</span>
              </label>
              <input
                id="sem-gpa"
                type="number"
                step="0.01"
                min="0"
                max={gradingScaleMax.toFixed(2)}
                placeholder={`e.g. ${(gradingScaleMax * 0.9).toFixed(2)}`}
                value={semGpa}
                onChange={(e) => setSemGpa(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setSemesterModalOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {editingSemester ? 'Save Changes' : 'Add Semester'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Current Course Modal */}
      <Modal
        isOpen={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        title={editingCourse ? 'Edit Current Course' : 'Add Current Course'}
      >
        <form onSubmit={handleSaveCourse} className="space-y-4">
          {courseError && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {courseError}
            </div>
          )}

          <div>
            <label htmlFor="course-name" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              Course Name / Code <span className="text-rose-500">*</span>
            </label>
            <input
              id="course-name"
              type="text"
              placeholder="e.g. CSE220 Data Structures"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="course-credits" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Credits <span className="text-rose-500">*</span>
              </label>
              <input
                id="course-credits"
                type="number"
                step="0.5"
                min="0.5"
                max="15"
                placeholder="e.g. 3.0"
                value={courseCredits}
                onChange={(e) => setCourseCredits(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label htmlFor="course-grade" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Expected Grade Points <span className="text-rose-500">*</span>
              </label>
              <input
                id="course-grade"
                type="number"
                step="0.01"
                min="0"
                max={gradingScaleMax.toFixed(2)}
                placeholder={`e.g. ${(gradingScaleMax * 0.9).toFixed(2)}`}
                value={courseGradePoints}
                onChange={(e) => setCourseGradePoints(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setCourseModalOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {editingCourse ? 'Save Changes' : 'Add Course'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
