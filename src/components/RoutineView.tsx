import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import type { RoutineClass, RoutineCourse } from '../types/campuskit';
import {
  WEEKDAY_NAMES_FULL,
  WEEKDAY_NAMES_SHORT,
  findOverlappingClasses,
  formatClockTime,
  getClassLiveState,
  getOrderedWeekdays,
  parseMinutesFromMidnight,
  parseRoutineCsv,
  CsvImportResult,
} from '../utils/dateAndMath';
import { Modal } from './Modal';

export const RoutineView: React.FC = () => {
  const {
    now,
    settings,
    routine,
    saveRoutineClass,
    deleteRoutineClass,
    importRoutineClasses,
    routineCourses,
    saveRoutineCourse,
    deleteRoutineCourse,
    quickModal,
    setQuickModal,
  } = useCampusKit();

  const [activeSubView, setActiveSubView] = useState<'schedule' | 'courses'>('schedule');

  // Class Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<RoutineClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoutineClass | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(() => now.getDay());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [room, setRoom] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [overlapAcknowledged, setOverlapAcknowledged] = useState(false);

  // Course Form Modal State
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<RoutineCourse | null>(null);
  const [courseDeleteTarget, setCourseDeleteTarget] = useState<RoutineCourse | null>(null);

  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cCredits, setCCredits] = useState('3.0');
  const [cTeacher, setCTeacher] = useState('');
  const [cClassroom, setCClassroom] = useState('');
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  // CSV Import State
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvImportResult | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvSuccessMessage, setCsvSuccessMessage] = useState<string | null>(null);

  const openAddModal = (defaultDay?: number) => {
    setEditingClass(null);
    setSelectedCourseId('');
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
    setSelectedCourseId(cls.courseId ?? '');
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

  // Handle course picker selection in Class Form
  const handleCoursePickerChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    if (!courseId) return;
    const found = routineCourses.find((c) => c.id === courseId);
    if (found) {
      if (!subject || subject === editingClass?.subject) {
        setSubject(found.courseCode ? `${found.courseCode} - ${found.name}` : found.name);
      }
      if (found.classroom && (!room || room === editingClass?.room)) {
        setRoom(found.classroom);
      }
    }
  };

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
      courseId: selectedCourseId || undefined,
    });
    setIsFormOpen(false);
  };

  // Course Form Handlers
  const openAddCourseModal = () => {
    setEditingCourse(null);
    setCName('');
    setCCode('');
    setCCredits('3.0');
    setCTeacher('');
    setCClassroom('');
    setCourseFormError(null);
    setIsCourseModalOpen(true);
  };

  const openEditCourseModal = (course: RoutineCourse) => {
    setEditingCourse(course);
    setCName(course.name);
    setCCode(course.courseCode);
    setCCredits(String(course.credits));
    setCTeacher(course.teacher);
    setCClassroom(course.classroom);
    setCourseFormError(null);
    setIsCourseModalOpen(true);
  };

  const handleCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = cName.trim();
    if (!nameTrim) {
      setCourseFormError('Course title is required.');
      return;
    }
    const creditsNum = Number(cCredits);
    if (!Number.isFinite(creditsNum) || creditsNum <= 0) {
      setCourseFormError('Enter a valid credits amount (e.g. 3.0).');
      return;
    }

    saveRoutineCourse({
      id: editingCourse?.id,
      name: nameTrim,
      courseCode: cCode.trim(),
      credits: creditsNum,
      teacher: cTeacher.trim(),
      classroom: cClassroom.trim(),
    });
    setIsCourseModalOpen(false);
  };

  // CSV Import Handlers
  const handleCsvFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = parseRoutineCsv(text, routine);
      setCsvPreview(result);
      setCsvModalOpen(true);
    } catch {
      alert('Could not read the selected CSV file.');
    } finally {
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    }
  };

  const handleConfirmCsvImport = () => {
    if (!csvPreview || csvPreview.validRows.length === 0) return;
    const count = importRoutineClasses(csvPreview.validRows);
    setCsvModalOpen(false);
    setCsvPreview(null);
    setCsvSuccessMessage(`Successfully imported ${count} class${count === 1 ? '' : 'es'} into your routine.`);
    setTimeout(() => setCsvSuccessMessage(null), 5000);
  };

  const orderedDays = useMemo(
    () => getOrderedWeekdays(settings.weekStart),
    [settings.weekStart]
  );

  const groupedByDay = useMemo(() => {
    const map = new Map<number, RoutineClass[]>();
    for (const d of orderedDays) map.set(d, []);
    for (const cls of routine) {
      const list = map.get(cls.dayOfWeek);
      if (list) list.push(cls);
      else map.set(cls.dayOfWeek, [cls]);
    }
    for (const [, list] of map.entries()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [routine, orderedDays]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Navigation */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Class Routine
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Weekly Routine
            </h1>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Manage your semester schedule, courses, and import routine via CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden CSV Input */}
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileChosen}
              className="hidden"
              id="routine-csv-upload"
            />
            <button
              type="button"
              onClick={() => csvFileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              title="Import routine from CSV (subject,day,start,end,room)"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>

            {activeSubView === 'schedule' ? (
              <button
                type="button"
                onClick={() => openAddModal()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                <Plus className="h-4 w-4" />
                Add Class
              </button>
            ) : (
              <button
                type="button"
                onClick={openAddCourseModal}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                <Plus className="h-4 w-4" />
                Add Course
              </button>
            )}
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="mt-5 flex gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setActiveSubView('schedule')}
            className={`min-h-[40px] flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
              activeSubView === 'schedule'
                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/60'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            Weekly Schedule ({routine.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('courses')}
            className={`min-h-[40px] flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
              activeSubView === 'courses'
                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/60'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            Courses Catalog ({routineCourses.length})
          </button>
        </div>

        {csvSuccessMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{csvSuccessMessage}</span>
          </div>
        )}
      </section>

      {/* SUBVIEW 1: WEEKLY SCHEDULE */}
      {activeSubView === 'schedule' && (
        <section className="space-y-4">
          {routine.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center dark:border-stone-800">
              <Calendar className="mx-auto h-8 w-8 text-stone-400 dark:text-stone-600" />
              <h3 className="mt-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
                No classes scheduled yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
                Add your weekly classes or import your timetable using CSV to view daily schedules and live indicators.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openAddModal()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add First Class
                </button>
                <button
                  type="button"
                  onClick={() => csvFileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 active:scale-95 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import from CSV
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {orderedDays.map((dayNum) => {
                const dayClasses = groupedByDay.get(dayNum) ?? [];
                const isToday = now.getDay() === dayNum;

                return (
                  <div
                    key={dayNum}
                    className={`rounded-2xl border p-4 shadow-2xs transition ${
                      isToday
                        ? 'border-indigo-300 bg-white ring-1 ring-indigo-200/50 dark:border-indigo-900/60 dark:bg-stone-900'
                        : 'border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                          {WEEKDAY_NAMES_FULL[dayNum]}
                        </h2>
                        {isToday && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-indigo-500">
                            Today
                          </span>
                        )}
                        <span className="text-xs text-stone-400">
                          ({dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAddModal(dayNum)}
                        aria-label={`Add class on ${WEEKDAY_NAMES_FULL[dayNum]}`}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>

                    {dayClasses.length === 0 ? (
                      <p className="py-2 text-xs italic text-stone-400 dark:text-stone-500">
                        No classes scheduled for {WEEKDAY_NAMES_FULL[dayNum]}.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {dayClasses.map((cls) => {
                          const liveState = getClassLiveState(cls, now);
                          const linkedCourse = cls.courseId
                            ? routineCourses.find((c) => c.id === cls.courseId)
                            : undefined;

                          return (
                            <div
                              key={cls.id}
                              className={`flex items-center justify-between rounded-xl border p-3 transition ${
                                liveState === 'ongoing'
                                  ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-300 dark:border-emerald-900/80 dark:bg-emerald-950/40'
                                  : 'border-stone-100 bg-stone-50/70 dark:border-stone-800 dark:bg-stone-800/40'
                              }`}
                            >
                              <div className="min-w-0 pr-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-stone-900 dark:text-stone-100 text-sm truncate">
                                    {cls.subject}
                                  </span>
                                  {liveState === 'ongoing' && (
                                    <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                      In Session
                                    </span>
                                  )}
                                  {linkedCourse?.courseCode && (
                                    <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                      {linkedCourse.courseCode}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500 dark:text-stone-400">
                                  <span className="font-mono">
                                    {formatClockTime(cls.startTime, settings.clockFormat)} –{' '}
                                    {formatClockTime(cls.endTime, settings.clockFormat)}
                                  </span>
                                  {cls.room && <span>Room: {cls.room}</span>}
                                  {linkedCourse?.teacher && (
                                    <span>Teacher: {linkedCourse.teacher}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(cls)}
                                  aria-label={`Edit ${cls.subject}`}
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 dark:hover:bg-stone-750 dark:hover:text-stone-200"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(cls)}
                                  aria-label={`Delete ${cls.subject}`}
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
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SUBVIEW 2: COURSES CATALOG */}
      {activeSubView === 'courses' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Registered Courses
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Save teachers, rooms, and credits to quickly autofill routine classes.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddCourseModal}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Add Course
            </button>
          </div>

          {routineCourses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center dark:border-stone-800">
              <BookOpen className="mx-auto h-8 w-8 text-stone-400 dark:text-stone-600" />
              <h3 className="mt-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
                No courses added yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
                Add your academic courses (e.g. CSE115, MATH101) with their instructors, credits, and default classrooms.
              </p>
              <button
                type="button"
                onClick={openAddCourseModal}
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {routineCourses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {c.courseCode && (
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {c.courseCode}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">{c.credits} Credits</span>
                      </div>
                      <h3 className="mt-1 font-bold text-stone-900 dark:text-stone-100 text-sm truncate">
                        {c.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditCourseModal(c)}
                        aria-label={`Edit course ${c.name}`}
                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourseDeleteTarget(c)}
                        aria-label={`Delete course ${c.name}`}
                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 border-t border-stone-100 pt-2.5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
                    {c.teacher && (
                      <p className="flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                        <span>Teacher: {c.teacher}</span>
                      </p>
                    )}
                    {c.classroom && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Layers className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                        <span>Room: {c.classroom}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* CLASS ADD/EDIT MODAL */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingClass ? 'Edit Routine Class' : 'Add Class to Routine'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {formError}
            </div>
          )}

          {/* Optional Course Picker */}
          {routineCourses.length > 0 && (
            <div>
              <label
                htmlFor="class-course-picker"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                Link Course <span className="text-stone-400">(optional autofill)</span>
              </label>
              <select
                id="class-course-picker"
                value={selectedCourseId}
                onChange={(e) => handleCoursePickerChange(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                <option value="">-- None (Type custom subject) --</option>
                {routineCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode ? `[${c.courseCode}] ` : ''}
                    {c.name} {c.classroom ? `(${c.classroom})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="class-subject"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              Subject / Course Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="class-subject"
              type="text"
              placeholder="e.g. Physics 101, Data Structures"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="class-day"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                Day of Week <span className="text-rose-500">*</span>
              </label>
              <select
                id="class-day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                {orderedDays.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_NAMES_FULL[d]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="class-start"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="class-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="class-end"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                id="class-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="class-room"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              Classroom / Room <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="class-room"
              type="text"
              placeholder="e.g. Room 402, CS Lab 2, Main Aud"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          {/* Overlap Warning Banner */}
          {liveOverlaps.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">Schedule Overlap Detected</p>
                  <p className="mt-0.5">
                    This time overlaps with: {liveOverlaps.map((o) => `"${o.subject}" (${o.startTime}–${o.endTime})`).join(', ')}.
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    {overlapAcknowledged
                      ? 'Acknowledged. Click "Save Class" again to save anyway.'
                      : 'Clicking save will ask you to confirm this overlapping time.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {liveOverlaps.length > 0 && !overlapAcknowledged
                ? 'Check & Save'
                : editingClass
                  ? 'Save Changes'
                  : 'Add Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* COURSE ADD/EDIT MODAL */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title={editingCourse ? 'Edit Course' : 'Add Academic Course'}
      >
        <form onSubmit={handleCourseSubmit} className="space-y-4">
          {courseFormError && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {courseFormError}
            </div>
          )}

          <div>
            <label
              htmlFor="course-name"
              className="block text-xs font-medium text-stone-700 dark:text-stone-300"
            >
              Course Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="course-name"
              type="text"
              placeholder="e.g. Data Structures & Algorithms"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="course-code"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                Course Code <span className="text-stone-400">(e.g. CSE220)</span>
              </label>
              <input
                id="course-code"
                type="text"
                placeholder="e.g. CSE220"
                value={cCode}
                onChange={(e) => setCCode(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="course-credits"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                Credits <span className="text-rose-500">*</span>
              </label>
              <input
                id="course-credits"
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={cCredits}
                onChange={(e) => setCCredits(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="course-teacher"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                Teacher / Instructor
              </label>
              <input
                id="course-teacher"
                type="text"
                placeholder="e.g. Prof. Ahmed"
                value={cTeacher}
                onChange={(e) => setCTeacher(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="course-classroom"
                className="block text-xs font-medium text-stone-700 dark:text-stone-300"
              >
                Default Classroom
              </label>
              <input
                id="course-classroom"
                type="text"
                placeholder="e.g. UB204"
                value={cClassroom}
                onChange={(e) => setCClassroom(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsCourseModalOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500"
            >
              {editingCourse ? 'Save Changes' : 'Save Course'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV IMPORT PREVIEW MODAL */}
      <Modal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="CSV Routine Import Preview"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Previewing classes parsed from your CSV file. Confirm below to import them into your routine.
          </p>

          {/* Counts Overview */}
          {csvPreview && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  Valid Classes
                </span>
                <p className="text-xl font-bold text-emerald-950 dark:text-emerald-100">
                  {csvPreview.validRows.length}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
                <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                  Overlap Warnings
                </span>
                <p className="text-xl font-bold text-amber-950 dark:text-amber-100">
                  {csvPreview.overlapWarnings.length}
                </p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900/60 dark:bg-rose-950/40">
                <span className="text-[11px] font-medium text-rose-800 dark:text-rose-300">
                  Rejected Rows
                </span>
                <p className="text-xl font-bold text-rose-950 dark:text-rose-100">
                  {csvPreview.rejectedRows.length}
                </p>
              </div>
            </div>
          )}

          {/* Overlap Warnings List */}
          {csvPreview && csvPreview.overlapWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 max-h-36 overflow-y-auto space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Overlap Warnings (will still be imported):</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {csvPreview.overlapWarnings.map((ow, idx) => (
                  <li key={idx}>{ow.warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Valid Rows List */}
          {csvPreview && csvPreview.validRows.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Valid Classes to Import
              </h4>
              <div className="mt-1.5 max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-stone-200 p-2 dark:border-stone-800">
                {csvPreview.validRows.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-xs dark:bg-stone-800/60"
                  >
                    <div>
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {r.subject}
                      </span>
                      {r.room && <span className="ml-1.5 text-stone-400">({r.room})</span>}
                    </div>
                    <div className="text-right text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                      <span>{WEEKDAY_NAMES_SHORT[r.dayOfWeek]}</span>{' '}
                      <span>
                        {r.startTime}–{r.endTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected Rows List */}
          {csvPreview && csvPreview.rejectedRows.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Rejected Rows (Will Not Be Imported)
              </h4>
              <div className="mt-1.5 max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-rose-200 bg-rose-50/40 p-2 dark:border-rose-900/60 dark:bg-rose-950/20">
                {csvPreview.rejectedRows.map((rej, idx) => (
                  <div key={idx} className="rounded-lg bg-white p-2 text-xs dark:bg-stone-900">
                    <span className="font-bold text-rose-700 dark:text-rose-400">
                      Row {rej.rowNumber}:
                    </span>{' '}
                    <span className="text-stone-700 dark:text-stone-300">{rej.reason}</span>
                    <p className="mt-0.5 font-mono text-[10px] text-stone-400 truncate">
                      {rej.rawText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-stone-100 pt-3 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setCsvModalOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmCsvImport}
              disabled={!csvPreview || csvPreview.validRows.length === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-40 dark:bg-indigo-500"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Import ({csvPreview ? csvPreview.validRows.length : 0} Classes)
            </button>
          </div>
        </div>
      </Modal>

      {/* CLASS DELETE CONFIRM MODAL */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Routine Class"
      >
        <p className="text-xs text-stone-600 dark:text-stone-400">
          Are you sure you want to delete <span className="font-semibold text-stone-900 dark:text-stone-100">&ldquo;{deleteTarget?.subject}&rdquo;</span> from your weekly schedule?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (deleteTarget) {
                deleteRoutineClass(deleteTarget.id);
                setDeleteTarget(null);
              }
            }}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* COURSE DELETE CONFIRM MODAL */}
      <Modal
        isOpen={courseDeleteTarget !== null}
        onClose={() => setCourseDeleteTarget(null)}
        title="Delete Course"
      >
        <p className="text-xs text-stone-600 dark:text-stone-400">
          Delete course <span className="font-semibold text-stone-900 dark:text-stone-100">&ldquo;{courseDeleteTarget?.name}&rdquo;</span>? Classes already created with this course will remain in your routine.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setCourseDeleteTarget(null)}
            className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (courseDeleteTarget) {
                deleteRoutineCourse(courseDeleteTarget.id);
                setCourseDeleteTarget(null);
              }
            }}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
};
