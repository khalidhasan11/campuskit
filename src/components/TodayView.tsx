import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Clock,
  FilePlus2,
  Flame,
  PartyPopper,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import {
  WEEKDAY_NAMES_FULL,
  computeAttendanceMetrics,
  computeStudyAnalytics,
  formatClockTime,
  formatDeadlineCountdown,
  formatLocalDateReadable,
  getClassLiveState,
  getSemesterProgress,
  getTodayHoliday,
  getTodayNextClassStatus,
} from '../utils/dateAndMath';

export const TodayView: React.FC = () => {
  const {
    now,
    settings,
    routine,
    semesterSettings,
    attendance,
    deadlines,
    studySessions,
    setActiveTab,
    setQuickModal,
    openNewNoteImmediately,
  } = useCampusKit();

  const todayWeekday = now.getDay();
  const todayReadable = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const todaysClasses = useMemo(() => {
    return routine
      .filter((c) => c.dayOfWeek === todayWeekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [routine, todayWeekday]);

  const nearestDeadline = useMemo(() => {
    const unfinished = deadlines.filter((d) => !d.completed);
    if (unfinished.length === 0) return null;
    const sorted = [...unfinished].sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt
    );
    const item = sorted[0];
    return {
      item,
      countdown: formatDeadlineCountdown(item.dueDate, false, now),
    };
  }, [deadlines, now]);

  const studyAnalytics = useMemo(
    () => computeStudyAnalytics(studySessions, now),
    [studySessions, now]
  );

  const attendanceWarnings = useMemo(() => {
    return attendance
      .map((subj) => ({
        subject: subj,
        metrics: computeAttendanceMetrics(subj),
      }))
      .filter((x) => x.metrics.status === 'Below' || x.metrics.status === 'Warning')
      .sort((a, b) => (a.metrics.percentage ?? 0) - (b.metrics.percentage ?? 0));
  }, [attendance]);

  const handleRecordAttendanceQuick = () => {
    if (attendance.length === 0) {
      setActiveTab('attend');
      setQuickModal('record-attendance');
    } else {
      setQuickModal('record-attendance');
    }
  };

  const nextClassStatus = useMemo(
    () => getTodayNextClassStatus(routine, now),
    [routine, now]
  );

  const todayHoliday = useMemo(
    () => getTodayHoliday(semesterSettings, now),
    [semesterSettings, now]
  );

  const semesterProgress = useMemo(
    () => getSemesterProgress(semesterSettings, now),
    [semesterSettings, now]
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {todayReadable}
            </p>
            {semesterProgress && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <CalendarDays className="h-3 w-3" />
                Day {semesterProgress.dayX} of {semesterProgress.totalY}
                {semesterProgress.semesterName ? ` · ${semesterProgress.semesterName}` : ''}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 mt-0.5 text-balance">
            Today on Campus
          </h1>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
          {todaysClasses.length === 1
            ? '1 class scheduled today'
            : `${todaysClasses.length} classes scheduled today`}
        </p>
      </section>

      {/* Holiday Announcement Banner if today matches a holiday */}
      {todayHoliday && (
        <section
          aria-label="Holiday alert"
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 shadow-2xs dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            <PartyPopper className="h-5 w-5" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              University Holiday
            </span>
            <p className="text-sm font-bold">{todayHoliday.label}</p>
          </div>
        </section>
      )}

      {/* Compact Next Class Line */}
      <section
        aria-label="Next class status"
        className="flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-2xs dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              nextClassStatus.state === 'ongoing'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
            }`}
          >
            <Clock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Next Class
            </span>
            <div className="truncate text-xs font-semibold text-stone-900 dark:text-stone-100 mt-0.5">
              {nextClassStatus.classItem ? (
                <>
                  <span className="font-bold text-stone-900 dark:text-stone-50">
                    {nextClassStatus.classItem.subject}
                  </span>
                  {nextClassStatus.classItem.room && (
                    <span className="text-stone-500 dark:text-stone-400 font-normal ml-1">
                      (Room {nextClassStatus.classItem.room})
                    </span>
                  )}
                  <span className="mx-1.5 text-stone-300 dark:text-stone-700">·</span>
                  <span
                    className={
                      nextClassStatus.state === 'ongoing'
                        ? 'font-bold text-emerald-600 dark:text-emerald-400'
                        : 'text-indigo-600 dark:text-indigo-400'
                    }
                  >
                    {nextClassStatus.text}
                  </span>
                </>
              ) : (
                <span className="text-stone-500 dark:text-stone-400 font-medium">
                  {nextClassStatus.text}
                </span>
              )}
            </div>
          </div>
        </div>

        {nextClassStatus.classItem && (
          <button
            type="button"
            onClick={() => setActiveTab('routine')}
            className="min-h-[40px] px-2 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400 shrink-0 ml-2"
          >
            Routine
          </button>
        )}
      </section>

      <section aria-label="Quick actions">
        <h2 className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2.5">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <button
            type="button"
            onClick={openNewNoteImmediately}
            className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4 shrink-0" />
            <span>New Note</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('routine');
              setQuickModal('add-class');
            }}
            className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:bg-stone-100/70 dark:hover:bg-stone-800/70 text-stone-800 dark:text-stone-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Add Class</span>
          </button>

          <button
            type="button"
            onClick={handleRecordAttendanceQuick}
            className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:bg-stone-100/70 dark:hover:bg-stone-800/70 text-stone-800 dark:text-stone-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('exams');
              setQuickModal('add-deadline');
            }}
            className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:bg-stone-100/70 dark:hover:bg-stone-800/70 text-stone-800 dark:text-stone-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Add Deadline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('study')}
            className="col-span-2 sm:col-span-1 min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:bg-stone-100/70 dark:hover:bg-stone-800/70 text-stone-800 dark:text-stone-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Start Study</span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section
          aria-labelledby="today-study-heading"
          className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="today-study-heading"
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
            >
              Study Progress
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('study')}
              className="min-h-[44px] px-2 -mr-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              <span>Open Timer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-100 dark:border-stone-800/80 mt-2">
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400">Today&apos;s Focus</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                {studyAnalytics.minutesToday}{' '}
                <span className="text-sm font-normal text-stone-500 dark:text-stone-400">min</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400">Current Streak</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-1 inline-flex items-baseline gap-1.5">
                <Flame
                  className={`w-4 h-4 self-center ${
                    studyAnalytics.currentStreak > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-stone-400 dark:text-stone-600'
                  }`}
                  aria-hidden="true"
                />
                <span>{studyAnalytics.currentStreak}</span>
                <span className="text-sm font-normal text-stone-500 dark:text-stone-400">
                  {studyAnalytics.currentStreak === 1 ? 'day' : 'days'}
                </span>
              </p>
            </div>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400 mt-3 tabular-nums">
            {studyAnalytics.summarySentence}
          </p>
        </section>

        <section
          aria-labelledby="today-deadline-heading"
          className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="today-deadline-heading"
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
            >
              Nearest Unfinished Deadline
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('exams')}
              className="min-h-[44px] px-2 -mr-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              <span>All Deadlines</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {nearestDeadline ? (
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 mt-2">
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span className="font-medium text-stone-700 dark:text-stone-300">
                  {nearestDeadline.item.type}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatLocalDateReadable(nearestDeadline.item.dueDate)}</span>
              </div>
              <p className="text-base font-semibold text-stone-900 dark:text-stone-100 mt-1 break-words">
                {nearestDeadline.item.title}
              </p>
              <p
                className={`text-sm font-semibold tabular-nums mt-2 ${
                  nearestDeadline.countdown.state === 'overdue'
                    ? 'text-rose-600 dark:text-rose-400'
                    : nearestDeadline.countdown.state === 'today'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {nearestDeadline.countdown.label}
              </p>
            </div>
          ) : (
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 mt-2">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                No unfinished exams, assignments, or quizzes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('exams');
                  setQuickModal('add-deadline');
                }}
                className="mt-2 min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add an exam or assignment</span>
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <section
          aria-labelledby="today-classes-heading"
          className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-5"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2
                id="today-classes-heading"
                className="text-sm font-semibold text-stone-900 dark:text-stone-100"
              >
                {WEEKDAY_NAMES_FULL[todayWeekday]}&apos;s Classes
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('routine')}
              className="min-h-[44px] px-2 -mr-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              <span>Full Routine</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todaysClasses.length === 0 ? (
            <div className="py-6 text-center border-t border-stone-100 dark:border-stone-800/80">
              <Clock className="w-6 h-6 text-stone-400 dark:text-stone-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                No classes scheduled for {WEEKDAY_NAMES_FULL[todayWeekday]}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Add your weekly routine to see your daily class times and rooms here.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('routine');
                  setQuickModal('add-class');
                }}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/80 dark:hover:bg-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 transition-colors"
              >
                Add Class to Routine
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800/80 border-t border-stone-100 dark:border-stone-800/80">
              {todaysClasses.map((cls) => {
                const state = getClassLiveState(cls, now);
                return (
                  <li key={cls.id} className="py-3.5 first:pt-3.5 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 break-words">
                          {cls.subject}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums mt-0.5">
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
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 whitespace-nowrap ${
                          state === 'ongoing'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : state === 'upcoming'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-stone-400 dark:text-stone-500'
                        }`}
                      >
                        {state === 'ongoing'
                          ? 'Ongoing now'
                          : state === 'upcoming'
                            ? 'Upcoming'
                            : 'Ended'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="today-attend-heading"
          className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-5"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2
              id="today-attend-heading"
              className="text-sm font-semibold text-stone-900 dark:text-stone-100"
            >
              Attendance Alerts
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('attend')}
              className="min-h-[44px] px-2 -mr-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              <span>Manage Attendance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {attendance.length === 0 ? (
            <div className="py-6 text-center border-t border-stone-100 dark:border-stone-800/80">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                No subjects tracked yet
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Track university attendance requirements (e.g. 75% or 80%) and see safe misses.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('attend')}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/80 dark:hover:bg-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-200 transition-colors"
              >
                Add Subject
              </button>
            </div>
          ) : attendanceWarnings.length === 0 ? (
            <div className="py-5 border-t border-stone-100 dark:border-stone-800/80">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                All tracked subjects are safely above required attendance.
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 tabular-nums">
                Tracking {attendance.length}{' '}
                {attendance.length === 1 ? 'subject' : 'subjects'}.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800/80 border-t border-stone-100 dark:border-stone-800/80">
              {attendanceWarnings.map(({ subject, metrics }) => (
                <li key={subject.id} className="py-3.5 first:pt-3.5 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          className={`w-4 h-4 shrink-0 ${
                            metrics.status === 'Below'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {subject.name}
                        </p>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                        {metrics.summaryText}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p
                        className={`text-sm font-bold ${
                          metrics.status === 'Below'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {metrics.percentage !== null ? `${metrics.percentage.toFixed(1)}%` : '—'}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {subject.attended}/{subject.total} · req {subject.requiredPercentage}%
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
