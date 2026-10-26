/**
 * Ported QA-harness cases (~/workspace/campuskit-pwa, src/__tests__/calc.test.ts,
 * 26 cases) against the canonical CampusKit math in dateAndMath.ts.
 *
 * Adaptations, all deliberate and documented here rather than hidden:
 * - Harness function names (attendancePercent, safeAbsences, recoveryClasses,
 *   cumulativeCGPA, whatIf, calendarDayDiff, studyStreak, last7Days,
 *   timerShouldSave) map to the canonical API (computeAttendanceMetrics,
 *   computeCompletedCgpa, computeWhatIfGpa, calendarDaysFromToday,
 *   computeStudyAnalytics, shouldSaveCompletedTimerSession).
 * - Harness cumulativeCGPA([]).cgpa === 0, but the canonical
 *   computeCompletedCgpa returns cgpa === null for zero credits (the UI
 *   renders '--'). The ported cases assert the canonical null.
 * - Harness whatIf statuses 'secured' / 'no-remaining' are the canonical
 *   kinds 'already-secured' / 'zero-remaining' (with alreadyMet).
 * - The timer-dedupe case uses the extracted pure predicate
 *   shouldSaveCompletedTimerSession, which CampusKitContext calls at
 *   timer completion (previously inline there).
 */
import { describe, expect, it } from 'vitest';
import {
  calendarDaysFromToday,
  computeAttendanceMetrics,
  computeCompletedCgpa,
  computeStudyAnalytics,
  computeWhatIfGpa,
  shouldSaveCompletedTimerSession,
} from '../dateAndMath';
import type { CompletedSemester, StudySession } from '../../types/campuskit';

const att = (attended: number, total: number, requiredPercentage: number) =>
  computeAttendanceMetrics({ attended, total, requiredPercentage });

const sem = (gpa: number, credits: number): CompletedSemester => ({
  id: `sem-${gpa}-${credits}`,
  name: 'Test Semester',
  credits,
  gpa,
  createdAt: 0,
  updatedAt: 0,
});

const session = (date: string, minutes: number): StudySession => ({
  id: `sess-${date}`,
  date,
  minutes,
  source: 'manual',
  label: 'Test session',
  createdAt: 0,
  updatedAt: 0,
});

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('attendance (ported)', () => {
  it('zero classes', () => {
    const r = att(0, 0, 80);
    expect(r.hasClasses).toBe(false);
    expect(r.percentage).toBeNull();
  });
  it('pct', () => {
    expect(att(8, 10, 80).percentage).toBe(80);
  });
  it('exact threshold safe 0', () => {
    expect(att(8, 10, 80).safeMisses).toBe(0);
  });
  it('safe absences', () => {
    expect(att(9, 10, 80).safeMisses).toBe(1);
    expect(att(10, 10, 80).safeMisses).toBe(2);
  });
  it('recovery', () => {
    // (8-7)/0.2 = 5; check 12/15 = 80
    expect(att(7, 10, 80).recoveryClasses).toBe(5);
  });
  it('100% below impossible', () => {
    const r = att(9, 10, 100);
    expect(r.recoveryClasses).toBeNull();
    expect(r.isImpossible100).toBe(true);
    expect(r.summaryText).toContain('100%');
  });
  it('100% at threshold', () => {
    expect(att(10, 10, 100).recoveryClasses).toBe(0);
  });
  it('invalid-ish low', () => {
    expect(att(0, 10, 80).safeMisses).toBe(0);
  });
});

describe('cgpa (ported)', () => {
  it('weighted not simple average', () => {
    const r = computeCompletedCgpa([sem(4.0, 3), sem(3.0, 1)]);
    expect(r.cgpa).toBeCloseTo(3.75);
    expect(r.totalCredits).toBe(4);
  });
  it('zero credits', () => {
    // Canonical semantics: cgpa is null (not 0) when nothing counts.
    expect(computeCompletedCgpa([]).cgpa).toBeNull();
    expect(computeCompletedCgpa([sem(3.0, 0)]).cgpa).toBeNull();
  });
});

describe('whatIf (ported)', () => {
  it('achievable', () => {
    const r = computeWhatIfGpa('3.5', '60', '3.6', '30');
    expect(r.kind).toBe('achievable');
    if (r.kind === 'achievable') expect(r.requiredGpa).toBeCloseTo(3.8);
  });
  it('secured', () => {
    expect(computeWhatIfGpa('3.9', '90', '3.0', '10').kind).toBe('already-secured');
  });
  it('impossible', () => {
    expect(computeWhatIfGpa('2.0', '90', '3.9', '10').kind).toBe('impossible');
  });
  it('zero remaining secured', () => {
    const r = computeWhatIfGpa('3.5', '60', '3.4', '0');
    expect(r.kind).toBe('zero-remaining');
    if (r.kind === 'zero-remaining') expect(r.alreadyMet).toBe(true);
  });
  it('zero remaining not secured', () => {
    const r = computeWhatIfGpa('3.0', '60', '3.5', '0');
    expect(r.kind).toBe('zero-remaining');
    if (r.kind === 'zero-remaining') expect(r.alreadyMet).toBe(false);
  });
  it('zero completed', () => {
    const r = computeWhatIfGpa('0', '0', '3.5', '30');
    expect(r.kind).toBe('achievable');
    if (r.kind === 'achievable') expect(r.requiredGpa).toBeCloseTo(3.5);
  });
  it('invalid', () => {
    expect(computeWhatIfGpa('5', '10', '3', '10').kind).toBe('error');
  });
});

describe('date diff local calendar (ported)', () => {
  it('today/tomorrow/yesterday', () => {
    expect(calendarDaysFromToday('2026-10-26', day(2026, 10, 25))).toBe(1);
    expect(calendarDaysFromToday('2026-10-25', day(2026, 10, 25))).toBe(0);
    expect(calendarDaysFromToday('2026-10-24', day(2026, 10, 25))).toBe(-1);
  });
  it('month boundary', () => {
    expect(calendarDaysFromToday('2026-11-01', day(2026, 10, 31))).toBe(1);
  });
  it('year boundary', () => {
    expect(calendarDaysFromToday('2027-01-01', day(2026, 12, 31))).toBe(1);
  });
  it('leap day', () => {
    expect(calendarDaysFromToday('2024-03-01', day(2024, 2, 28))).toBe(2);
    expect(calendarDaysFromToday('2024-02-29', day(2024, 2, 28))).toBe(1);
  });
});

describe('streak & weekly (ported)', () => {
  it('streak today', () => {
    const r = computeStudyAnalytics(
      [session('2026-10-25', 25), session('2026-10-24', 10)],
      day(2026, 10, 25)
    );
    expect(r.currentStreak).toBe(2);
  });
  it('streak yesterday fallback', () => {
    const r = computeStudyAnalytics([session('2026-10-24', 10)], day(2026, 10, 25));
    expect(r.currentStreak).toBe(1);
  });
  it('streak zero', () => {
    const r = computeStudyAnalytics([session('2026-10-20', 10)], day(2026, 10, 25));
    expect(r.currentStreak).toBe(0);
  });
  it('last7', () => {
    const r = computeStudyAnalytics([session('2026-10-25', 30)], day(2026, 10, 25));
    expect(r.bars.length).toBe(7);
    expect(r.bars[6].minutes).toBe(30);
    expect(r.totalLast7Days).toBe(30);
  });
  it('timer dedupe', () => {
    expect(shouldSaveCompletedTimerSession('focus', false)).toBe(true);
    expect(shouldSaveCompletedTimerSession('focus', true)).toBe(false);
    expect(shouldSaveCompletedTimerSession('break', false)).toBe(false);
  });
});
