import { describe, expect, it } from 'vitest';
import {
  GRADE_OPTIONS,
  addTranscriptRows,
  computeTranscript,
  createBlankRows,
  meritForCgpa,
  resetTranscriptRows,
  validateTranscriptInput,
  type TranscriptInput,
  type TranscriptRow,
} from '../transcriptCgpa';
import { computeCompletedCgpa, computeWhatIfGpa } from '../dateAndMath';
import type { CompletedSemester } from '../../types/campuskit';

const row = (grade: string, credit: string, name = ''): TranscriptRow => ({ name, grade, credit });
const input = (
  prevCgpa: string,
  prevCredits: string,
  rows: TranscriptRow[]
): TranscriptInput => ({ prevCgpa, prevCredits, rows });

describe('grade scale (verified from the reference source)', () => {
  it('has exactly the 11 dropdown grades with the reference points, and no Z', () => {
    expect(GRADE_OPTIONS.map((g) => [g.letter, g.points])).toEqual([
      ['A', 4.0],
      ['A-', 3.7],
      ['B+', 3.3],
      ['B', 3.0],
      ['B-', 2.7],
      ['C+', 2.3],
      ['C', 2.0],
      ['C-', 1.7],
      ['D+', 1.3],
      ['D', 1.0],
      ['F', 0.0],
    ]);
  });
});

describe('computeTranscript — named reference cases', () => {
  it('(a) one new course: 3.50 x 60 + A x 3 = 222 pts / 63 cr = 3.52, merit 30', () => {
    const r = computeTranscript(input('3.50', '60', [row('A', '3')]));
    expect(r.errors).toEqual([]);
    expect(r.countedRows).toBe(1);
    expect(r.skippedRows).toBe(0);
    expect(r.totalCredits).toBe(63);
    expect(r.totalPoints).toBeCloseTo(222, 6);
    expect(r.updatedCgpa).toBe(3.52);
    expect(r.meritPercent).toBe(30);
  });

  it("(b) multiple courses incl. an F whose credits count: 3.80 x 90 + A- x3 + B+ x3 + F x1 = 363 / 97 = 3.74, merit 50", () => {
    const r = computeTranscript(
      input('3.80', '90', [row('A-', '3'), row('B+', '3'), row('F', '1')])
    );
    expect(r.errors).toEqual([]);
    expect(r.countedRows).toBe(3);
    expect(r.totalCredits).toBe(97); // 90 + 3 + 3 + 1 (F credits included)
    expect(r.totalPoints).toBeCloseTo(363, 6);
    expect(r.updatedCgpa).toBe(3.74);
    expect(r.meritPercent).toBe(50);
  });

  it('(c) no new courses: 3.90 x 120 with all rows blank stays 3.90, merit 100, all rows skipped', () => {
    const rows = createBlankRows(5);
    const r = computeTranscript(input('3.90', '120', rows));
    expect(r.errors).toEqual([]);
    expect(r.countedRows).toBe(0);
    expect(r.skippedRows).toBe(5);
    expect(r.totalCredits).toBe(120);
    expect(r.updatedCgpa).toBe(3.9);
    expect(r.meritPercent).toBe(100);
  });

  it('(d) zero previous record: A x4 + B x3 = 25 / 7 = 3.57, merit 30', () => {
    const r = computeTranscript(input('0', '0', [row('A', '4'), row('B', '3')]));
    expect(r.errors).toEqual([]);
    expect(r.totalCredits).toBe(7);
    expect(r.totalPoints).toBeCloseTo(25, 6);
    expect(r.updatedCgpa).toBe(3.57);
    expect(r.meritPercent).toBe(30);
  });

  it('(e) invalid inputs produce specific errors and never NaN', () => {
    const r = computeTranscript(input('4.50', '-5', [row('A', '10')]));
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
    expect(r.errors.join(' ')).toMatch(/Previous CGPA must be between 0\.00 and 4\.00/);
    expect(r.errors.join(' ')).toMatch(/cannot be negative/);
    expect(r.errors.join(' ')).toMatch(/cannot exceed 9/);
    expect(r.updatedCgpa).toBeNull();
    expect(r.meritPercent).toBeNull();
    expect(Number.isNaN(r.totalPoints)).toBe(false);
    expect(Number.isNaN(r.totalCredits)).toBe(false);
  });

  it('(f) blank and zero-credit rows are skipped without errors', () => {
    const r = computeTranscript(
      input('3.00', '30', [row('A', ''), row('B', '0'), row('A', '3')])
    );
    expect(r.errors).toEqual([]);
    expect(r.countedRows).toBe(1);
    expect(r.skippedRows).toBe(2);
    expect(r.totalCredits).toBe(33);
    expect(r.updatedCgpa).toBe(3.09); // (90 + 12) / 33 = 3.0909...
  });

  it('(g) decimal precision: 3.33 x 30 + C+ x 3 = 106.8 / 33 = 3.24', () => {
    const r = computeTranscript(input('3.33', '30', [row('C+', '3')]));
    expect(r.totalPoints).toBeCloseTo(106.8, 6);
    expect(r.totalCredits).toBe(33);
    expect(r.updatedCgpa).toBe(3.24);
  });

  it('(g2) exact-half rounding is half-up and matches the reference: 25 / 8 = 3.125 -> 3.13', () => {
    const r = computeTranscript(
      input('0', '0', [row('A', '3'), row('B', '3'), row('C', '2')])
    );
    expect(r.totalPoints).toBeCloseTo(25, 6);
    expect(r.totalCredits).toBe(8);
    expect(r.updatedCgpa).toBe(3.13);
  });

  it('(g3) documented deviation: exact 2.675 rounds to 2.68 (integer math), where the reference float Math.round gives 2.67', () => {
    // prev 3.35 x 20 = 67 pts; C x9 + C x9 + C x2 = 40 pts; total 107 / 40 = 2.675 exactly.
    const r = computeTranscript(
      input('3.35', '20', [row('C', '9'), row('C', '9'), row('C', '2')])
    );
    expect(r.totalPoints).toBeCloseTo(107, 6);
    expect(r.totalCredits).toBe(40);
    expect(r.updatedCgpa).toBe(2.68);
  });

  it('zero total credits yields updatedCgpa null (never NaN like the reference)', () => {
    const r = computeTranscript(input('0', '0', createBlankRows(5)));
    expect(r.errors).toEqual([]);
    expect(r.totalCredits).toBe(0);
    expect(r.updatedCgpa).toBeNull();
    expect(r.meritPercent).toBeNull();
  });

  it('an F-only record gives CGPA 0.00 and merit 0 (credits still counted)', () => {
    const r = computeTranscript(input('0', '0', [row('F', '3')]));
    expect(r.totalCredits).toBe(3);
    expect(r.updatedCgpa).toBe(0);
    expect(r.meritPercent).toBe(0);
  });
});

describe('meritForCgpa — boundaries on the rounded CGPA', () => {
  const cases: Array<[number, number]> = [
    [4.0, 100],
    [3.85, 100],
    [3.84, 75],
    [3.8, 75],
    [3.79, 50],
    [3.7, 50],
    [3.69, 30],
    [3.51, 30],
    [3.5, 0],
    [3.26, 0], // the reference's 20% tier at 3.26 is commented out — excluded
    [0, 0],
  ];
  for (const [cgpa, expected] of cases) {
    it(`${cgpa.toFixed(2)} -> ${expected}%`, () => {
      expect(meritForCgpa(cgpa)).toBe(expected);
    });
  }
});

describe('row helpers — add 5 rows and reset semantics', () => {
  it('starts with 5 blank rows whose grade defaults to A', () => {
    const rows = createBlankRows(5);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.grade === 'A' && r.credit === '' && r.name === '')).toBe(true);
  });

  it('addTranscriptRows appends exactly 5 rows and keeps existing ones', () => {
    const start = createBlankRows(5);
    start[0] = row('B', '3', 'CSE115');
    const next = addTranscriptRows(start);
    expect(next).toHaveLength(10);
    expect(next[0]).toEqual(row('B', '3', 'CSE115'));
    expect(next.slice(5).every((r) => r.credit === '')).toBe(true);
    expect(start).toHaveLength(5); // original untouched
  });

  it('resetTranscriptRows returns 5 fresh blank rows', () => {
    const rows = resetTranscriptRows();
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.credit === '' && r.name === '')).toBe(true);
  });
});

describe('validateTranscriptInput', () => {
  it('accepts blank previous inputs (they mean 0, as in the reference)', () => {
    expect(validateTranscriptInput(input('', '', createBlankRows(5)))).toEqual([]);
  });

  it('rejects an unknown grade letter with a row-specific message', () => {
    const errors = validateTranscriptInput(input('3.00', '30', [row('Z', '3')]));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Row 1/);
  });
});

/**
 * Oracle comparison: the reference calculator's own arithmetic, transcribed
 * from its inline JS (updateResult + getMerit, plain float version). The
 * cases below were run against BOTH implementations; inputs and results are
 * recorded in the project report.
 */
const REF_GPA: Record<string, number> = {
  A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0,
  'C-': 1.7, 'D+': 1.3, D: 1.0, F: 0.0,
};
function refMerit(cgpa: number): number {
  if (cgpa >= 3.85) return 100;
  if (cgpa >= 3.8) return 75;
  if (cgpa >= 3.7) return 50;
  if (cgpa >= 3.51) return 30;
  return 0;
}
function refCompute(
  prevCgpa: number,
  prevCredits: number,
  rows: Array<{ grade: string; credit: number }>
): { totalPoints: number; totalCredits: number; cgpa: number; merit: number } {
  let totalPoints = prevCgpa * prevCredits;
  let totalCredits = prevCredits;
  for (const r of rows) {
    totalPoints += REF_GPA[r.grade] * r.credit;
    totalCredits += r.credit;
  }
  const cgpa = Math.round((totalPoints / totalCredits) * 100) / 100;
  return { totalPoints, totalCredits, cgpa, merit: refMerit(cgpa) };
}

describe('oracle: computeTranscript matches the reference arithmetic', () => {
  const oracleCases: Array<{
    label: string;
    prevCgpa: number;
    prevCredits: number;
    rows: Array<{ grade: string; credit: number }>;
  }> = [
    { label: 'single A', prevCgpa: 3.5, prevCredits: 60, rows: [{ grade: 'A', credit: 3 }] },
    {
      label: 'A-, B+ and F',
      prevCgpa: 3.8, prevCredits: 90,
      rows: [
        { grade: 'A-', credit: 3 },
        { grade: 'B+', credit: 3 },
        { grade: 'F', credit: 1 },
      ],
    },
    { label: 'no new courses', prevCgpa: 3.9, prevCredits: 120, rows: [] },
    {
      label: 'from zero',
      prevCgpa: 0, prevCredits: 0,
      rows: [
        { grade: 'A', credit: 4 },
        { grade: 'B', credit: 3 },
      ],
    },
    { label: 'decimal-heavy C+', prevCgpa: 3.33, prevCredits: 30, rows: [{ grade: 'C+', credit: 3 }] },
    {
      label: 'half-credit course',
      prevCgpa: 2.75, prevCredits: 45,
      rows: [
        { grade: 'A', credit: 3 },
        { grade: 'A', credit: 3 },
        { grade: 'B-', credit: 1.5 },
      ],
    },
    {
      label: 'mixed low grades',
      prevCgpa: 3.6, prevCredits: 75,
      rows: [
        { grade: 'B', credit: 3 },
        { grade: 'C+', credit: 3 },
        { grade: 'D', credit: 1 },
      ],
    },
    {
      label: 'two Fs drag down',
      prevCgpa: 3.95, prevCredits: 100,
      rows: [
        { grade: 'F', credit: 3 },
        { grade: 'F', credit: 3 },
      ],
    },
    {
      label: 'fractional credits',
      prevCgpa: 3.1, prevCredits: 33,
      rows: [
        { grade: 'A-', credit: 0.5 },
        { grade: 'C-', credit: 2.5 },
        { grade: 'D+', credit: 1 },
      ],
    },
    { label: 'F only', prevCgpa: 0, prevCredits: 0, rows: [{ grade: 'F', credit: 3 }] },
    {
      label: 'four-course semester',
      prevCgpa: 3.51, prevCredits: 57,
      rows: [
        { grade: 'B+', credit: 4 },
        { grade: 'A-', credit: 4 },
        { grade: 'C', credit: 2 },
        { grade: 'A', credit: 1 },
      ],
    },
    {
      label: 'big-credit recovery',
      prevCgpa: 2.4, prevCredits: 15,
      rows: [
        { grade: 'A', credit: 9 },
        { grade: 'B+', credit: 9 },
      ],
    },
    {
      label: 'zero-credit row ignored numerically',
      prevCgpa: 3.0, prevCredits: 30,
      rows: [
        { grade: 'A', credit: 0 },
        { grade: 'B', credit: 3 },
      ],
    },
  ];

  for (const c of oracleCases) {
    it(`matches reference: ${c.label}`, () => {
      const expected = refCompute(c.prevCgpa, c.prevCredits, c.rows);
      const actual = computeTranscript(
        input(
          String(c.prevCgpa),
          String(c.prevCredits),
          c.rows.map((r) => row(r.grade, String(r.credit)))
        )
      );
      expect(actual.errors).toEqual([]);
      expect(actual.totalCredits).toBeCloseTo(expected.totalCredits, 6);
      expect(actual.totalPoints).toBeCloseTo(expected.totalPoints, 4);
      expect(actual.updatedCgpa).toBe(expected.cgpa);
      expect(actual.meritPercent).toBe(expected.merit);
    });
  }
});

describe('regression: existing dateAndMath CGPA / What-If behaviour intact', () => {
  const sem = (credits: number, gpa: number): CompletedSemester => ({
    id: `sem-${credits}-${gpa}`,
    name: 'Sem',
    credits,
    gpa,
    createdAt: 0,
    updatedAt: 0,
  });

  it('completed CGPA is credit-weighted (3.75), not a simple average (3.50)', () => {
    const r = computeCompletedCgpa([sem(10, 3.0), sem(30, 4.0)]);
    expect(r.totalCredits).toBe(40);
    expect(r.totalQualityPoints).toBeCloseTo(150, 6);
    expect(r.cgpa).toBeCloseTo(3.75, 9);
  });

  it('What-If achievable: 3.50/60, target 3.60, 36 remaining needs ~3.77', () => {
    const r = computeWhatIfGpa('3.50', '60', '3.60', '36');
    expect(r.kind).toBe('achievable');
    if (r.kind === 'achievable') expect(r.requiredGpa).toBeCloseTo(3.7667, 3);
  });

  it('What-If already secured: 3.90/100, target 3.00, 20 remaining', () => {
    const r = computeWhatIfGpa('3.90', '100', '3.00', '20');
    expect(r.kind).toBe('already-secured');
  });

  it('What-If impossible: 2.00/100, target 3.90, 10 remaining', () => {
    const r = computeWhatIfGpa('2.00', '100', '3.90', '10');
    expect(r.kind).toBe('impossible');
  });
});
