import { describe, expect, it } from 'vitest';
import {
  computeCompletedCgpa,
  computeProjectedCgpa,
  computeWhatIfGpa,
} from '../dateAndMath';
import { validateSettings } from '../../storage/localStore';
import type { CompletedSemester, CurrentCourse } from '../../types/campuskit';

const sem = (gpa: number, credits: number): CompletedSemester => ({
  id: `sem-${gpa}-${credits}`,
  name: 'Test Semester',
  credits,
  gpa,
  createdAt: 0,
  updatedAt: 0,
});

const course = (expectedGradePoints: number, credits: number): CurrentCourse => ({
  id: `course-${expectedGradePoints}-${credits}`,
  name: 'Test Course',
  credits,
  expectedGradePoints,
  createdAt: 0,
  updatedAt: 0,
});

describe('configurable grading scale', () => {
  it('default 4.00 behaviour is unchanged', () => {
    expect(computeCompletedCgpa([sem(4.0, 3), sem(3.0, 1)]).cgpa).toBeCloseTo(3.75);
    // A 4.5 GPA is out of range on the default scale and is excluded.
    expect(computeCompletedCgpa([sem(4.5, 2)]).cgpa).toBeNull();
  });

  it('a 5.00 scale counts grade points above 4.00', () => {
    expect(computeCompletedCgpa([sem(4.5, 2)], 5.0).cgpa).toBeCloseTo(4.5);
    expect(computeProjectedCgpa([], [course(4.8, 3)], 5.0).projectedSemesterGpa).toBeCloseTo(
      4.8
    );
    expect(computeProjectedCgpa([], [course(4.8, 3)]).projectedSemesterGpa).toBeNull();
  });

  it('what-if uses the configured scale for the impossibility threshold', () => {
    // Required GPA is 4.40: impossible on 4.00, achievable on 5.00.
    expect(computeWhatIfGpa('3.5', '60', '3.8', '30').kind).toBe('impossible');
    const r = computeWhatIfGpa('3.5', '60', '3.8', '30', 5.0);
    expect(r.kind).toBe('achievable');
    if (r.kind === 'achievable') expect(r.requiredGpa).toBeCloseTo(4.4);
  });

  it('what-if validates entered GPAs against the configured scale', () => {
    expect(computeWhatIfGpa('4.5', '60', '4.5', '30').kind).toBe('error');
    expect(computeWhatIfGpa('4.5', '60', '4.5', '30', 5.0).kind).toBe('achievable');
  });

  it('settings validation keeps a valid scale and rejects out-of-range scales', () => {
    expect(validateSettings({ gradingScaleMax: 5.0 }).gradingScaleMax).toBe(5.0);
    expect(validateSettings({ gradingScaleMax: 4.33 }).gradingScaleMax).toBe(4.33);
    expect(validateSettings({ gradingScaleMax: 1.5 }).gradingScaleMax).toBe(4.0);
    expect(validateSettings({ gradingScaleMax: 12 }).gradingScaleMax).toBe(4.0);
    expect(validateSettings({}).gradingScaleMax).toBe(4.0);
  });
});
