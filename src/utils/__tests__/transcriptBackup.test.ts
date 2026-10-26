import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEYS,
  loadInitialSnapshot,
  readTranscriptStateFromStorage,
  validateTranscriptState,
} from '../../storage/localStore';

describe('transcript backup plumbing', () => {
  it('uses the same storage key as the calculator component', () => {
    expect(STORAGE_KEYS.transcript).toBe('campuskit_v1_transcript_calculator');
  });

  it('sanitizes transcript state the way the calculator does', () => {
    const r = validateTranscriptState({
      prevCgpa: '3.50',
      prevCredits: '60',
      rows: [
        { name: 'A very long course name', grade: 'Z', credit: '3' },
        { name: 'CSE101', grade: 'A-', credit: '3' },
      ],
    });
    expect(r.prevCgpa).toBe('3.50');
    expect(r.rows.length).toBe(2);
    // Unknown grades fall back to 'A'; names cap at 12 chars.
    expect(r.rows[0].grade).toBe('A');
    expect(r.rows[0].name).toBe('A very long ');
    expect(r.rows[1].grade).toBe('A-');
  });

  it('defaults corrupt or missing transcript state to 5 blank rows', () => {
    expect(validateTranscriptState(null).rows.length).toBe(5);
    expect(validateTranscriptState({ rows: [] }).rows.length).toBe(5);
    expect(validateTranscriptState({ prevCgpa: 'x', prevCredits: 'y' }).prevCgpa).toBe('x');
  });

  it('reads transcript state from localStorage via the snapshot', () => {
    // Minimal in-memory localStorage stub (vitest runs in node, where
    // localStorage does not exist). localStore only touches it at call
    // time, so stubbing here is safe.
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    };
    store.set(
      STORAGE_KEYS.transcript,
      JSON.stringify({
        prevCgpa: '3.25',
        prevCredits: '45',
        rows: [
          { name: 'MAT101', grade: 'B+', credit: '3' },
          { name: 'ENG102', grade: 'A', credit: '3' },
        ],
      })
    );
    expect(readTranscriptStateFromStorage().prevCgpa).toBe('3.25');
    const snapshot = loadInitialSnapshot();
    expect(snapshot.transcript.rows.length).toBe(2);
    expect(snapshot.transcript.rows[0].grade).toBe('B+');

    // Clearing the key (what clear-all does) reads back as blank.
    store.delete(STORAGE_KEYS.transcript);
    expect(readTranscriptStateFromStorage().rows.length).toBe(5);
  });
});
