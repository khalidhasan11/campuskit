/**
 * Transcript CGPA Calculator (IUB style) — pure calculation module.
 *
 * Behaviour verified against the reference calculator
 * (shouravbr.github.io/iub-cgpa-calculator, source inspected):
 *   totalPoints  = prevCgpa * prevCredits + Σ(gradePoint * credit)
 *   totalCredits = prevCredits + Σ(credit)   — credits of EVERY counted row,
 *                  including F rows (0 points, credits still in denominator)
 *   updatedCgpa  = totalPoints / totalCredits, rounded half-up to 2 dp
 *   merit %      = tiers applied to the ROUNDED CGPA (see meritForCgpa)
 *
 * Arithmetic approach (scaled integers, to avoid binary floating-point error):
 *   - grade points are exact tenths      -> stored as integer tenths (A- = 37)
 *   - the previous CGPA is kept in hundredths (3.50 -> 350)
 *   - credits are kept in hundredths of a credit (1.5 -> 150)
 *   - grade points therefore accumulate in units of 1/10000 exactly, and the
 *     final CGPA is rounded half-up with integer-safe math. This intentionally
 *     resolves exact-half cases (e.g. an exact 2.675 -> 2.68) the way the
 *     decimal math says, where the reference's float Math.round can drop to
 *     2.67 because 2.675 is not exactly representable in binary.
 *
 * Differences from the reference, all deliberate:
 *   - totalCredits = 0 returns updatedCgpa = null (the reference shows NaN).
 *   - a row counts only when its credit is a valid number > 0; blank /
 *     zero-credit / invalid rows are reported in skippedRows (numerically the
 *     reference also contributes 0 for such rows, so results match).
 */

export interface GradeOption {
  letter: string;
  points: number;
}

/** Ordered grade dropdown options, exactly as in the reference (no "Z"). */
export const GRADE_OPTIONS: GradeOption[] = [
  { letter: 'A', points: 4.0 },
  { letter: 'A-', points: 3.7 },
  { letter: 'B+', points: 3.3 },
  { letter: 'B', points: 3.0 },
  { letter: 'B-', points: 2.7 },
  { letter: 'C+', points: 2.3 },
  { letter: 'C', points: 2.0 },
  { letter: 'C-', points: 1.7 },
  { letter: 'D+', points: 1.3 },
  { letter: 'D', points: 1.0 },
  { letter: 'F', points: 0.0 },
];

/** Grade points in exact integer tenths, keyed by letter grade. */
export const GRADE_POINTS_TENTHS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(GRADE_OPTIONS.map((g) => [g.letter, Math.round(g.points * 10)]))
);

export interface TranscriptRow {
  /** Optional course name / code. Never affects the calculation. */
  name: string;
  /** Letter grade; must be one of GRADE_OPTIONS (UI uses a dropdown, default "A"). */
  grade: string;
  /** Raw credit input as typed ("" = blank). */
  credit: string;
}

export interface TranscriptInput {
  /** Raw previous (transcript) CGPA input as typed ("" = blank, treated as 0). */
  prevCgpa: string;
  /** Raw previously earned credits input as typed ("" = blank, treated as 0). */
  prevCredits: string;
  rows: TranscriptRow[];
}

export interface TranscriptResult {
  countedRows: number;
  skippedRows: number;
  /** Total credits (previous + counted rows). */
  totalCredits: number;
  /** Total grade points (previous + counted rows). */
  totalPoints: number;
  /** Rounded to 2 dp (half-up); null when totalCredits is 0 or inputs are invalid. */
  updatedCgpa: number | null;
  /** Merit scholarship % for the rounded CGPA; null when updatedCgpa is null. */
  meritPercent: number | null;
  /** Specific validation messages (empty when everything is valid). */
  errors: string[];
}

export const MAX_ROW_CREDIT = 9;

/** Number of course rows the calculator starts with and resets to. */
export const INITIAL_ROW_COUNT = 5;

/** One blank course row (grade defaults to "A", as in the reference). */
export function createBlankRow(): TranscriptRow {
  return { name: '', grade: 'A', credit: '' };
}

export function createBlankRows(count: number): TranscriptRow[] {
  return Array.from({ length: count }, () => createBlankRow());
}

/** The reference's "Add 5 rows" behaviour: append exactly `count` blank rows. */
export function addTranscriptRows(rows: TranscriptRow[], count = 5): TranscriptRow[] {
  return [...rows, ...createBlankRows(count)];
}

/**
 * The reference's Reset behaviour for rows: discard all course rows and start
 * again with 5 blank ones. (The transcript inputs are NOT part of the rows and
 * are kept — see the component, which only replaces its rows state.)
 */
export function resetTranscriptRows(): TranscriptRow[] {
  return createBlankRows(INITIAL_ROW_COUNT);
}

/**
 * Merit scholarship tiers, applied to the ROUNDED CGPA (verified from the
 * reference's getMerit; its 3.26 -> 20% tier is commented out and excluded).
 */
export function meritForCgpa(roundedCgpa: number): number {
  if (roundedCgpa >= 3.85) return 100;
  if (roundedCgpa >= 3.8) return 75;
  if (roundedCgpa >= 3.7) return 50;
  if (roundedCgpa >= 3.51) return 30;
  return 0;
}

/** Parse a raw numeric input; "" (blank) parses to 0, non-numeric to NaN. */
function parseRawNumber(raw: string): number {
  const t = raw.trim();
  if (t === '') return 0;
  return Number(t);
}

function toHundredths(value: number): number {
  return Math.round(value * 100);
}

/**
 * Validate a transcript input and return specific, user-facing messages.
 * Blank previous CGPA / credits are allowed (they mean 0, as in the reference
 * where both default to 0). Blank / zero-credit rows are not errors — they are
 * skipped — but a non-blank row credit that is negative, above the per-course
 * maximum, or not a number IS an error, as is an unknown grade letter.
 */
export function validateTranscriptInput(input: TranscriptInput): string[] {
  const errors: string[] = [];

  const prevCgpa = parseRawNumber(input.prevCgpa);
  if (!Number.isFinite(prevCgpa)) {
    errors.push('Previous CGPA must be a valid number.');
  } else if (prevCgpa < 0 || prevCgpa > 4) {
    errors.push('Previous CGPA must be between 0.00 and 4.00.');
  }

  const prevCredits = parseRawNumber(input.prevCredits);
  if (!Number.isFinite(prevCredits)) {
    errors.push('Previously earned credits must be a valid number.');
  } else if (prevCredits < 0) {
    errors.push('Previously earned credits cannot be negative.');
  }

  input.rows.forEach((row, i) => {
    const label = `Row ${i + 1}`;
    if (!(row.grade in GRADE_POINTS_TENTHS)) {
      errors.push(`${label}: "${row.grade}" is not a recognised grade.`);
    }
    const creditRaw = row.credit.trim();
    if (creditRaw === '') return; // blank row -> skipped, not an error
    const credit = Number(creditRaw);
    if (!Number.isFinite(credit)) {
      errors.push(`${label}: credit must be a valid number.`);
    } else if (credit < 0) {
      errors.push(`${label}: credit cannot be negative.`);
    } else if (credit > MAX_ROW_CREDIT) {
      errors.push(`${label}: credit cannot exceed ${MAX_ROW_CREDIT} for a single course.`);
    }
  });

  return errors;
}

/**
 * Compute the updated cumulative CGPA from a transcript (previous) record plus
 * a list of new course rows, following the verified reference rules.
 */
export function computeTranscript(input: TranscriptInput): TranscriptResult {
  const errors = validateTranscriptInput(input);

  const prevCgpa = parseRawNumber(input.prevCgpa);
  const prevCredits = parseRawNumber(input.prevCredits);
  const prevValid =
    Number.isFinite(prevCgpa) &&
    prevCgpa >= 0 &&
    prevCgpa <= 4 &&
    Number.isFinite(prevCredits) &&
    prevCredits >= 0;

  // Accumulate in scaled integers: points in 1/10000 units, credits in 1/100.
  let pointsE4 = 0;
  let creditsH = 0;
  if (prevValid) {
    pointsE4 += toHundredths(prevCgpa) * toHundredths(prevCredits);
    creditsH += toHundredths(prevCredits);
  }

  let countedRows = 0;
  let skippedRows = 0;
  for (const row of input.rows) {
    const creditRaw = row.credit.trim();
    const credit = creditRaw === '' ? NaN : Number(creditRaw);
    const gradeTenths = GRADE_POINTS_TENTHS[row.grade];
    if (
      gradeTenths === undefined ||
      !Number.isFinite(credit) ||
      credit <= 0 ||
      credit > MAX_ROW_CREDIT
    ) {
      skippedRows += 1;
      continue;
    }
    countedRows += 1;
    const creditH = toHundredths(credit);
    pointsE4 += gradeTenths * creditH * 10;
    creditsH += creditH;
  }

  const totalCredits = creditsH / 100;
  const totalPoints = pointsE4 / 10000;

  let updatedCgpa: number | null = null;
  let meritPercent: number | null = null;
  if (errors.length === 0 && creditsH > 0) {
    // cgpa = pointsE4 / (creditsH * 100); round half-up to hundredths using
    // integer operands (exact halves are representable, so floor(x + 0.5) is
    // a true decimal half-up here).
    const cgpaHundredths = Math.floor((pointsE4 * 100) / (creditsH * 100) + 0.5);
    updatedCgpa = cgpaHundredths / 100;
    meritPercent = meritForCgpa(updatedCgpa);
  }

  return {
    countedRows,
    skippedRows,
    totalCredits,
    totalPoints,
    updatedCgpa,
    meritPercent,
    errors,
  };
}
