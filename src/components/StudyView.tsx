import React, { useState, useMemo } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Flame,
  BarChart3,
  Plus,
  Trash2,
  AlertCircle,
  Coffee,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';
import { useCampusKit, STUDY_PRESETS } from '../context/CampusKitContext';
import { Modal } from './Modal';
import {
  computeStudyAnalytics,
  formatDurationSeconds,
  toLocalDateString,
  parseLocalDateParts,
} from '../utils/dateAndMath';
import type { StudyPresetId, StudySession } from '../types/campuskit';

export const StudyView: React.FC = () => {
  const {
    studySessions,
    studyTimer,
    timerRemainingMs,
    timerJustCompletedMessage,
    dismissTimerCompletedMessage,
    selectStudyPreset,
    startOrResumeTimer,
    pauseTimer,
    resetTimer,
    saveManualStudySession,
    deleteStudySession,
    now,
  } = useCampusKit();

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logDate, setLogDate] = useState(toLocalDateString(now));
  const [logMinutes, setLogMinutes] = useState('25');
  const [logLabel, setLogLabel] = useState('');
  const [logError, setLogError] = useState<string | null>(null);

  // Analytics computation
  const analytics = useMemo(() => {
    return computeStudyAnalytics(studySessions, now);
  }, [studySessions, now]);

  // Timer calculations
  const totalDurationSec = (STUDY_PRESETS[studyTimer.presetId]?.minutes ?? 25) * 60;
  const remainingSec = Math.max(0, Math.ceil(timerRemainingMs / 1000));
  const elapsedSec = Math.max(0, totalDurationSec - remainingSec);
  const progressRatio = totalDurationSec > 0 ? elapsedSec / totalDurationSec : 0;

  // SVG Circular Ring parameters
  const ringRadius = 88;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - progressRatio);

  const currentPreset = STUDY_PRESETS[studyTimer.presetId];
  const isFocusMode = currentPreset.mode === 'focus';

  // Manual Log Submission
  const handleSaveManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logDate || !parseLocalDateParts(logDate)) {
      setLogError('Please enter a valid calendar date.');
      return;
    }
    const mins = Number(logMinutes);
    if (!Number.isFinite(mins) || mins < 1 || mins > 720) {
      setLogError('Study minutes must be between 1 and 720 (12 hours).');
      return;
    }
    saveManualStudySession({
      date: logDate,
      minutes: Math.round(mins),
      label: logLabel.trim() || 'Self-study session',
    });
    setLogModalOpen(false);
  };

  const openNewLogModal = () => {
    setLogDate(toLocalDateString(now));
    setLogMinutes('25');
    setLogLabel('');
    setLogError(null);
    setLogModalOpen(true);
  };

  // Find max minutes for 7-day bar chart scaling
  const maxBarMinutes = useMemo(() => {
    const maxVal = Math.max(...analytics.bars.map((b) => b.minutes), 60);
    return maxVal;
  }, [analytics.bars]);

  return (
    <div className="space-y-6 pb-12">
      {/* Timer Completed Notification Banner */}
      {timerJustCompletedMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Session Completed!
              </p>
              <p className="text-sm font-semibold">{timerJustCompletedMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissTimerCompletedMessage}
            className="min-h-[44px] rounded-xl px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 active:scale-95 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Pomodoro Timer Card */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            <Timer className="h-4 w-4" />
            Study Timer
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isFocusMode
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            }`}
          >
            {isFocusMode ? <Flame className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
            {currentPreset.label}
          </span>
        </div>

        {/* Preset Selector */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(Object.keys(STUDY_PRESETS) as StudyPresetId[]).map((pid) => {
            const p = STUDY_PRESETS[pid];
            const isSelected = studyTimer.presetId === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => selectStudyPreset(pid)}
                className={`min-h-[44px] rounded-xl px-2 py-2 text-center text-xs font-medium transition active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 font-semibold text-white shadow-xs dark:bg-indigo-500'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200/70 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Circular Countdown Ring */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg
              className="h-56 w-56 -rotate-90 transform"
              viewBox="0 0 200 200"
              aria-hidden="true"
            >
              {/* Background Track */}
              <circle
                cx="100"
                cy="100"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-stone-100 dark:text-stone-800"
              />
              {/* Progress Stroke */}
              <circle
                cx="100"
                cy="100"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`transition-all duration-500 ${
                  isFocusMode
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-emerald-500 dark:text-emerald-400'
                }`}
              />
            </svg>

            {/* Centered Time Display */}
            <div className="absolute flex flex-col items-center text-center">
              <span className="font-mono text-4xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
                {formatDurationSeconds(remainingSec)}
              </span>
              <span className="mt-1 text-xs font-medium text-stone-400 dark:text-stone-500">
                {studyTimer.status === 'running'
                  ? isFocusMode
                    ? 'Deep Focus in progress'
                    : 'Rest & Recharge'
                  : elapsedSec > 0
                    ? 'Timer Paused'
                    : 'Ready to start'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={resetTimer}
            aria-label="Reset Timer"
            className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          {studyTimer.status === 'running' ? (
            <button
              type="button"
              onClick={pauseTimer}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-amber-500 px-7 text-sm font-bold text-white shadow-xs hover:bg-amber-600 active:scale-95 dark:bg-amber-600 dark:hover:bg-amber-700"
            >
              <Pause className="h-5 w-5" />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={startOrResumeTimer}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-indigo-600 px-8 text-sm font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <Play className="h-5 w-5 fill-current" />
              Start Focus
            </button>
          )}
        </div>

        {/* Background Disclaimer */}
        <div className="mt-6 flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-[11px] text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
          <span>
            Mobile browsers pause background JavaScript when the phone is locked. CampusKit uses absolute timestamp synchronization, so when you return to the app, elapsed minutes and completions are accurately computed.
          </span>
        </div>
      </section>

      {/* Analytics & 7-Day Bar Chart */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <BarChart3 className="h-4 w-4" />
              Study Analytics
            </span>
            <h2 className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
              Last 7 Days Activity
            </h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              {analytics.summarySentence}
            </p>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-indigo-50/80 p-3.5 dark:bg-indigo-950/40">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              Today&apos;s Focus
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-indigo-950 dark:text-indigo-100">
                {analytics.minutesToday}
              </span>
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">mins</span>
            </div>
          </div>

          <div className="rounded-xl bg-stone-50 p-3.5 dark:bg-stone-800/60">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Current Streak
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-stone-900 dark:text-stone-100">
                {analytics.currentStreak}
              </span>
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                {analytics.currentStreak === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>

          <div className="col-span-2 rounded-xl bg-stone-50 p-3.5 sm:col-span-1 dark:bg-stone-800/60">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              7-Day Total
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-stone-900 dark:text-stone-100">
                {analytics.totalLast7Days}
              </span>
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">mins</span>
            </div>
          </div>
        </div>

        {/* 7-Day Bar Chart */}
        <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
          <div className="flex h-36 items-end justify-between gap-2 px-1">
            {analytics.bars.map((bar) => {
              const heightPercent =
                maxBarMinutes > 0 ? Math.min(100, Math.round((bar.minutes / maxBarMinutes) * 100)) : 0;
              return (
                <div key={bar.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500">
                    {bar.minutes > 0 ? bar.minutes : ''}
                  </span>
                  <div className="relative flex h-24 w-full max-w-[32px] items-end justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
                    <div
                      style={{ height: `${Math.max(bar.minutes > 0 ? 8 : 0, heightPercent)}%` }}
                      className={`w-full rounded-lg transition-all duration-300 ${
                        bar.isToday
                          ? 'bg-indigo-600 dark:bg-indigo-500'
                          : bar.minutes > 0
                            ? 'bg-indigo-300 dark:bg-indigo-800'
                            : 'bg-transparent'
                      }`}
                    />
                  </div>
                  <div className="text-center">
                    <span
                      className={`block text-[11px] font-semibold ${
                        bar.isToday
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {bar.shortDay}
                    </span>
                    <span className="block text-[9px] text-stone-400 dark:text-stone-500">
                      {bar.shortDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Manual Study Log Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Study History
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Timer sessions & manual offline study logs
            </p>
          </div>
          <button
            type="button"
            onClick={openNewLogModal}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-xs transition hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
          >
            <Plus className="h-4 w-4" />
            Log Study
          </button>
        </div>

        {studySessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center dark:border-stone-800">
            <Clock className="mx-auto h-8 w-8 text-stone-400 dark:text-stone-600" />
            <h3 className="mt-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
              No study sessions logged yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
              Start the focus timer above or manually log past library/study group sessions.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {studySessions.slice(0, 10).map((sess) => (
              <div
                key={sess.id}
                className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white p-3.5 shadow-2xs dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="min-w-0 pr-3">
                  <h4 className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {sess.label}
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {sess.date}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-indigo-700 dark:text-indigo-400">
                    +{sess.minutes} min
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteStudySession(sess.id)}
                    aria-label={`Delete study session ${sess.label}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manual Study Log Modal */}
      <Modal
        isOpen={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Log Study Session"
      >
        <form onSubmit={handleSaveManualLog} className="space-y-4">
          {logError && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {logError}
            </div>
          )}

          <div>
            <label htmlFor="log-label" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              Subject / Topic <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="log-label"
              type="text"
              placeholder="e.g. Calculus Problem Set 3, Algorithms Revision"
              value={logLabel}
              onChange={(e) => setLogLabel(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="log-minutes" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Duration (Minutes) <span className="text-rose-500">*</span>
              </label>
              <input
                id="log-minutes"
                type="number"
                min="1"
                max="720"
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>

            <div>
              <label htmlFor="log-date" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="log-date"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setLogModalOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              Save Session
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
