import { describe, expect, it } from 'vitest';
import { parseRoutineCsv } from '../dateAndMath';
import type { RoutineClass } from '../../types/campuskit';

const cls = (
  subject: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string
): RoutineClass => ({
  id: `cls-${subject}-${dayOfWeek}-${startTime}`,
  subject,
  dayOfWeek,
  startTime,
  endTime,
  room: 'R1',
  createdAt: 0,
  updatedAt: 0,
});

const HEADER = 'subject,day,start,end,room,courseCode';

describe('parseRoutineCsv', () => {
  it('accepts valid rows with optional course code', () => {
    const r = parseRoutineCsv(
      `${HEADER}\nMath,Monday,09:00,10:30,Room 101,MAT101\nPhysics,Tuesday,11:00,12:00,Room 102,`,
      []
    );
    expect(r.validRows.length).toBe(2);
    expect(r.rejectedRows.length).toBe(0);
    expect(r.overlapWarnings.length).toBe(0);
    expect(r.validRows[0]).toMatchObject({
      subject: 'Math',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      room: 'Room 101',
      courseCode: 'MAT101',
    });
    expect(r.validRows[1].courseCode).toBeUndefined();
  });

  it('rejects unknown weekday, bad times, end before start, missing subject', () => {
    const r = parseRoutineCsv(
      [
        HEADER,
        'Math,Funday,09:00,10:00,R1,',
        'Math,Monday,25:00,26:00,R1,',
        'Math,Monday,11:00,10:00,R1,',
        ',Monday,09:00,10:00,R1,',
      ].join('\n'),
      []
    );
    expect(r.validRows.length).toBe(0);
    expect(r.rejectedRows.length).toBe(4);
    expect(r.rejectedRows.map((x) => x.rowNumber)).toEqual([2, 3, 4, 5]);
    expect(r.rejectedRows[0].reason).toContain('weekday');
    expect(r.rejectedRows[3].reason).toContain('Subject');
  });

  it('warns on overlap with an existing class, never silently drops', () => {
    const r = parseRoutineCsv(`${HEADER}\nMath,Monday,09:30,10:30,R2,`, [
      cls('English', 1, '09:00', '10:00'),
    ]);
    expect(r.validRows.length).toBe(1);
    expect(r.overlapWarnings.length).toBe(1);
    expect(r.overlapWarnings[0].warning).toContain('English');
  });

  it('warns on overlap between two CSV rows', () => {
    const r = parseRoutineCsv(
      `${HEADER}\nMath,Monday,09:00,10:00,R1,\nPhysics,Monday,09:30,10:30,R2,`,
      []
    );
    expect(r.validRows.length).toBe(2);
    expect(r.overlapWarnings.length).toBe(1);
    expect(r.overlapWarnings[0].warning).toContain('Math');
  });

  it('accepts numeric weekday and non-overlapping rows without warnings', () => {
    const r = parseRoutineCsv(`${HEADER}\nMath,1,09:00,10:00,R1,\nBio,1,10:00,11:00,R1,`, []);
    expect(r.validRows.length).toBe(2);
    expect(r.validRows[0].dayOfWeek).toBe(1);
    expect(r.overlapWarnings.length).toBe(0);
  });

  it('returns empty result for empty input', () => {
    const r = parseRoutineCsv('', []);
    expect(r.validRows).toEqual([]);
    expect(r.rejectedRows).toEqual([]);
    expect(r.overlapWarnings).toEqual([]);
  });
});
