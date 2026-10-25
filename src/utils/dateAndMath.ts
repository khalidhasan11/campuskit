import type {
  AttendanceSubject,
  ClockFormat,
  CompletedSemester,
  CurrentCourse,
  RoutineClass,
  StudySession,
  WeekStart,
} from '../types/campuskit';

export const WEEKDAY_NAMES_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function getOrderedWeekdays(weekStart: WeekStart): number[] {
  const startIdx = weekStart === 'saturday' ? 6 : weekStart === 'sunday' ? 0 : 1;
  const result: number[] = [];
  for (let i = 0; i < 7; i++) {
    result.push((startIdx + i) % 7);
  }
  return result;
}

export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDateParts(
  dateStr: string
): { year: number; month: number; day: number } | null {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function calendarDaysFromToday(dueDateStr: string, now: Date = new Date()): number {
  const parts = parseLocalDateParts(dueDateStr);
  if (!parts) return 0;
  const todayUtcMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueUtcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.round((dueUtcMidnight - todayUtcMidnight) / 86_400_000);
}

export function formatDeadlineCountdown(
  dueDateStr: string,
  completed: boolean,
  now: Date = new Date()
): {
  diffDays: number;
  state: 'completed' | 'overdue' | 'today' | 'upcoming';
  label: string;
} {
  const diffDays = calendarDaysFromToday(dueDateStr, now);
  if (completed) {
    return { diffDays, state: 'completed', label: 'Completed' };
  }
  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return {
      diffDays,
      state: 'overdue',
      label: abs === 1 ? 'Overdue by 1 day' : `Overdue by ${abs} days`,
    };
  }
  if (diffDays === 0) {
    return { diffDays: 0, state: 'today', label: 'Due Today' };
  }
  if (diffDays === 1) {
    return { diffDays: 1, state: 'upcoming', label: 'Tomorrow · 1 day left' };
  }
  return { diffDays, state: 'upcoming', label: `${diffDays} days left` };
}

export function formatLocalDateReadable(dateStr: string): string {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return dateStr;
  const localDate = new Date(parts.year, parts.month - 1, parts.day);
  return localDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortMonthDay(dateStr: string): string {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return dateStr;
  const localDate = new Date(parts.year, parts.month - 1, parts.day);
  return localDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function getLocalDateOffset(base: Date, dayDelta: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayDelta);
  return toLocalDateString(d);
}

export function getLast7LocalDates(now: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    dates.push(getLocalDateOffset(now, offset));
  }
  return dates;
}

export function parseMinutesFromMidnight(hhmm: string): number | null {
  if (typeof hhmm !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClockTime(hhmm: string, format: ClockFormat): string {
  const mins = parseMinutesFromMidnight(hhmm);
  if (mins === null) return hhmm;
  const h24 = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, '0');
  if (format === '24h') {
    return `${String(h24).padStart(2, '0')}:${m}`;
  }
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m} ${period}`;
}

export function getClassLiveState(
  cls: RoutineClass,
  now: Date = new Date()
): 'ongoing' | 'upcoming' | 'ended' | 'other-day' {
  if (cls.dayOfWeek !== now.getDay()) return 'other-day';
  const start = parseMinutesFromMidnight(cls.startTime);
  const end = parseMinutesFromMidnight(cls.endTime);
  if (start === null || end === null) return 'other-day';
  const currentMins = now.getHours() * 60 + now.getMinutes();
  if (currentMins >= start && currentMins < end) return 'ongoing';
  if (currentMins < start) return 'upcoming';
  return 'ended';
}

export function findOverlappingClasses(
  candidate: { id?: string; dayOfWeek: number; startTime: string; endTime: string },
  allClasses: RoutineClass[]
): RoutineClass[] {
  const startA = parseMinutesFromMidnight(candidate.startTime);
  const endA = parseMinutesFromMidnight(candidate.endTime);
  if (startA === null || endA === null || endA <= startA) return [];

  return allClasses.filter((existing) => {
    if (candidate.id && existing.id === candidate.id) return false;
    if (existing.dayOfWeek !== candidate.dayOfWeek) return false;
    const startB = parseMinutesFromMidnight(existing.startTime);
    const endB = parseMinutesFromMidnight(existing.endTime);
    if (startB === null || endB === null) return false;
    return startA < endB && startB < endA;
  });
}

export interface AttendanceMetrics {
  hasClasses: boolean;
  percentage: number | null;
  status: 'NoData' | 'Safe' | 'Warning' | 'Below';
  safeMisses: number;
  recoveryClasses: number | null;
  isImpossible100: boolean;
  summaryText: string;
}

export function computeAttendanceMetrics(subject: Pick<
  AttendanceSubject,
  'attended' | 'total' | 'requiredPercentage'
>): AttendanceMetrics {
  const A = Math.max(0, Math.trunc(subject.attended));
  const T = Math.max(0, Math.trunc(subject.total));
  const reqPct = Math.min(100, Math.max(0.01, subject.requiredPercentage));
  const pScaled = Math.round(reqPct * 100);
  const r = pScaled / 10000;

  const meetsRequirement = (att: number, tot: number): boolean => {
    return att * 10000 >= pScaled * tot;
  };

  if (T === 0) {
    return {
      hasClasses: false,
      percentage: null,
      status: 'NoData',
      safeMisses: 0,
      recoveryClasses: 0,
      isImpossible100: false,
      summaryText: 'No classes recorded.',
    };
  }

  const percentage = (100 * A) / T;

  if (meetsRequirement(A, T)) {
    let safeMisses = Math.max(0, Math.floor(A / r - T));
    while (meetsRequirement(A, T + safeMisses + 1)) {
      safeMisses += 1;
    }
    while (safeMisses > 0 && !meetsRequirement(A, T + safeMisses)) {
      safeMisses -= 1;
    }

    const isWarning = pScaled < 10000 && safeMisses === 0;
    const status = isWarning ? 'Warning' : 'Safe';
    const summaryText =
      pScaled === 10000
        ? 'At 100% requirement · 0 absences permitted'
        : safeMisses === 0
          ? 'On threshold · Missing next class drops below target'
          : safeMisses === 1
            ? 'Can safely miss 1 upcoming class'
            : `Can safely miss ${safeMisses} upcoming classes`;

    return {
      hasClasses: true,
      percentage,
      status,
      safeMisses,
      recoveryClasses: 0,
      isImpossible100: false,
      summaryText,
    };
  }

  if (pScaled >= 10000) {
    return {
      hasClasses: true,
      percentage,
      status: 'Below',
      safeMisses: 0,
      recoveryClasses: null,
      isImpossible100: true,
      summaryText:
        'No finite number of attended classes can restore 100% attendance while past absences remain.',
    };
  }

  let recovery = Math.max(1, Math.ceil((r * T - A) / (1 - r)));
  while (!meetsRequirement(A + recovery, T + recovery)) {
    recovery += 1;
  }
  while (recovery > 1 && meetsRequirement(A + recovery - 1, T + recovery - 1)) {
    recovery -= 1;
  }

  return {
    hasClasses: true,
    percentage,
    status: 'Below',
    safeMisses: 0,
    recoveryClasses: recovery,
    isImpossible100: false,
    summaryText:
      recovery === 1
        ? 'Attend the next 1 class to reach required attendance'
        : `Attend next ${recovery} classes consecutively to recover`,
  };
}

export function computeCompletedCgpa(semesters: CompletedSemester[]): {
  totalCredits: number;
  totalQualityPoints: number;
  cgpa: number | null;
} {
  let totalCredits = 0;
  let totalQualityPoints = 0;
  for (const sem of semesters) {
    if (sem.credits > 0 && sem.gpa >= 0 && sem.gpa <= 4) {
      totalCredits += sem.credits;
      totalQualityPoints += sem.credits * sem.gpa;
    }
  }
  if (totalCredits <= 0) {
    return { totalCredits: 0, totalQualityPoints: 0, cgpa: null };
  }
  return {
    totalCredits,
    totalQualityPoints,
    cgpa: totalQualityPoints / totalCredits,
  };
}

export function computeProjectedCgpa(
  semesters: CompletedSemester[],
  courses: CurrentCourse[]
): {
  currentCredits: number;
  currentQualityPoints: number;
  projectedSemesterGpa: number | null;
  combinedCredits: number;
  projectedCumulativeCgpa: number | null;
} {
  const completed = computeCompletedCgpa(semesters);
  let currentCredits = 0;
  let currentQualityPoints = 0;
  for (const c of courses) {
    if (c.credits > 0 && c.expectedGradePoints >= 0 && c.expectedGradePoints <= 4) {
      currentCredits += c.credits;
      currentQualityPoints += c.credits * c.expectedGradePoints;
    }
  }
  const projectedSemesterGpa = currentCredits > 0 ? currentQualityPoints / currentCredits : null;
  const combinedCredits = completed.totalCredits + currentCredits;
  const combinedQualityPoints = completed.totalQualityPoints + currentQualityPoints;
  const projectedCumulativeCgpa =
    combinedCredits > 0 ? combinedQualityPoints / combinedCredits : null;

  return {
    currentCredits,
    currentQualityPoints,
    projectedSemesterGpa,
    combinedCredits,
    projectedCumulativeCgpa,
  };
}

export type WhatIfResult =
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | {
      kind: 'zero-remaining';
      alreadyMet: boolean;
      currentCgpa: number;
      targetCgpa: number;
      message: string;
    }
  | {
      kind: 'already-secured';
      minimumProjectedCgpa: number;
      remainingCredits: number;
      targetCgpa: number;
      message: string;
    }
  | {
      kind: 'impossible';
      requiredGpa: number;
      maxPossibleCgpa: number;
      remainingCredits: number;
      message: string;
    }
  | {
      kind: 'achievable';
      requiredGpa: number;
      remainingCredits: number;
      targetCgpa: number;
      message: string;
    };

export function computeWhatIfGpa(
  rawCurrentCgpa: string,
  rawCompletedCredits: string,
  rawTargetCgpa: string,
  rawRemainingCredits: string
): WhatIfResult {
  const curStr = rawCurrentCgpa.trim();
  const compStr = rawCompletedCredits.trim();
  const tgtStr = rawTargetCgpa.trim();
  const remStr = rawRemainingCredits.trim();

  if (!curStr && !compStr && !tgtStr && !remStr) {
    return { kind: 'empty' };
  }
  if (!curStr || !compStr || !tgtStr || !remStr) {
    return { kind: 'error', message: 'Enter all four fields to calculate your required GPA.' };
  }

  const currentCgpa = Number(curStr);
  const completedCredits = Number(compStr);
  const targetCgpa = Number(tgtStr);
  const remainingCredits = Number(remStr);

  if (
    !Number.isFinite(currentCgpa) ||
    !Number.isFinite(completedCredits) ||
    !Number.isFinite(targetCgpa) ||
    !Number.isFinite(remainingCredits)
  ) {
    return { kind: 'error', message: 'All inputs must be valid numbers.' };
  }

  if (completedCredits < 0 || remainingCredits < 0) {
    return { kind: 'error', message: 'Credits cannot be negative.' };
  }

  if (currentCgpa < 0 || currentCgpa > 4) {
    return { kind: 'error', message: 'Current cumulative CGPA must be between 0.00 and 4.00.' };
  }

  if (targetCgpa < 0 || targetCgpa > 4) {
    return { kind: 'error', message: 'Target CGPA must be between 0.00 and 4.00.' };
  }

  if (completedCredits === 0 && currentCgpa > 0) {
    return {
      kind: 'error',
      message: 'When completed credits is 0, current cumulative CGPA must be 0.00.',
    };
  }

  if (remainingCredits === 0) {
    if (completedCredits === 0) {
      return {
        kind: 'error',
        message: 'Enter remaining credits greater than 0 to calculate a required GPA.',
      };
    }
    const alreadyMet = currentCgpa + 1e-9 >= targetCgpa;
    return {
      kind: 'zero-remaining',
      alreadyMet,
      currentCgpa,
      targetCgpa,
      message: alreadyMet
        ? `With 0 remaining credits, your final CGPA stays ${currentCgpa.toFixed(2)}, which already meets your ${targetCgpa.toFixed(2)} target.`
        : `With 0 remaining credits left, your CGPA stays ${currentCgpa.toFixed(2)} and cannot reach ${targetCgpa.toFixed(2)}.`,
    };
  }

  const totalCredits = completedCredits + remainingCredits;
  const requiredQualityPoints = targetCgpa * totalCredits - currentCgpa * completedCredits;
  const requiredGpa = requiredQualityPoints / remainingCredits;

  if (requiredGpa <= 1e-9) {
    const minimumProjectedCgpa = (currentCgpa * completedCredits) / totalCredits;
    return {
      kind: 'already-secured',
      minimumProjectedCgpa,
      remainingCredits,
      targetCgpa,
      message: `Target already secured. Even earning 0.00 GPA across your remaining ${remainingCredits} credits keeps your cumulative CGPA at ${minimumProjectedCgpa.toFixed(2)} (at or above ${targetCgpa.toFixed(2)}).`,
    };
  }

  if (requiredGpa > 4.0 + 1e-9) {
    const maxPossibleCgpa = (currentCgpa * completedCredits + 4.0 * remainingCredits) / totalCredits;
    return {
      kind: 'impossible',
      requiredGpa,
      maxPossibleCgpa,
      remainingCredits,
      message: `Reaching ${targetCgpa.toFixed(2)} would require a ${requiredGpa.toFixed(2)} GPA across ${remainingCredits} credits, which exceeds the 4.00 maximum. Scoring 4.00 in all remaining credits yields a maximum CGPA of ${maxPossibleCgpa.toFixed(2)}.`,
    };
  }

  const clampedRequired = Math.min(4.0, Math.max(0, requiredGpa));
  return {
    kind: 'achievable',
    requiredGpa: clampedRequired,
    remainingCredits,
    targetCgpa,
    message:
      completedCredits === 0
        ? `Starting with 0 completed credits, you need an average GPA of ${clampedRequired.toFixed(2)} across your ${remainingCredits} credits.`
        : `You need an average GPA of ${clampedRequired.toFixed(2)} across your remaining ${remainingCredits} credits to reach ${targetCgpa.toFixed(2)}.`,
  };
}

export interface DayStudyBar {
  date: string;
  shortDay: string;
  shortDate: string;
  minutes: number;
  isToday: boolean;
}

export function computeStudyAnalytics(
  sessions: StudySession[],
  now: Date = new Date()
): {
  minutesToday: number;
  totalLast7Days: number;
  studyDaysLast7: number;
  currentStreak: number;
  bars: DayStudyBar[];
  summarySentence: string;
} {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    if (s.minutes >= 1 && parseLocalDateParts(s.date)) {
      byDate.set(s.date, (byDate.get(s.date) ?? 0) + Math.trunc(s.minutes));
    }
  }

  const todayStr = toLocalDateString(now);
  const yesterdayStr = getLocalDateOffset(now, -1);
  const minutesToday = byDate.get(todayStr) ?? 0;

  let currentStreak = 0;
  let cursorOffset: number | null = null;
  if ((byDate.get(todayStr) ?? 0) >= 1) {
    cursorOffset = 0;
  } else if ((byDate.get(yesterdayStr) ?? 0) >= 1) {
    cursorOffset = -1;
  }

  if (cursorOffset !== null) {
    while (true) {
      const dStr = getLocalDateOffset(now, cursorOffset);
      if ((byDate.get(dStr) ?? 0) >= 1) {
        currentStreak += 1;
        cursorOffset -= 1;
      } else {
        break;
      }
    }
  }

  const last7Dates = getLast7LocalDates(now);
  let totalLast7Days = 0;
  let studyDaysLast7 = 0;
  let peakBar: DayStudyBar | null = null;

  const bars: DayStudyBar[] = last7Dates.map((dateStr) => {
    const parts = parseLocalDateParts(dateStr)!;
    const dObj = new Date(parts.year, parts.month - 1, parts.day);
    const mins = byDate.get(dateStr) ?? 0;
    totalLast7Days += mins;
    if (mins >= 1) studyDaysLast7 += 1;
    const bar: DayStudyBar = {
      date: dateStr,
      shortDay: WEEKDAY_NAMES_SHORT[dObj.getDay()],
      shortDate: `${parts.day}/${parts.month}`,
      minutes: mins,
      isToday: dateStr === todayStr,
    };
    if (!peakBar || bar.minutes > peakBar.minutes) {
      peakBar = bar;
    }
    return bar;
  });

  const summarySentence =
    totalLast7Days === 0
      ? 'No focus minutes logged in the last 7 calendar days.'
      : `${totalLast7Days} focus min across ${studyDaysLast7} of the last 7 days${
          peakBar && (peakBar as DayStudyBar).minutes > 0
            ? ` · Peak: ${(peakBar as DayStudyBar).shortDay} (${(peakBar as DayStudyBar).minutes} min)`
            : ''
        }.`;

  return {
    minutesToday,
    totalLast7Days,
    studyDaysLast7,
    currentStreak,
    bars,
    summarySentence,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDurationSeconds(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) return '';
  const total = Math.round(sec);
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}
