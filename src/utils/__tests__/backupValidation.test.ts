import { describe, expect, it } from 'vitest';
import { parseAndValidateBackupJson } from '../../storage/localStore';

const counts = {
  routine: 0,
  attendance: 0,
  semesters: 0,
  courses: 0,
  deadlines: 0,
  studySessions: 0,
  notes: 0,
  attachments: 0,
};

const baseArchive = () => ({
  manifest: {
    app: 'CampusKit',
    schemaVersion: 1,
    exportedAt: '2026-10-26T00:00:00.000Z',
    counts: { ...counts },
  },
  data: {
    settings: {},
    routine: [],
    attendance: [],
    semesters: [],
    courses: [],
    deadlines: [],
    studySessions: [],
    notes: [],
    attachments: [],
  },
});

describe('backup validation', () => {
  it('accepts a minimal valid archive', () => {
    const payload = parseAndValidateBackupJson(JSON.stringify(baseArchive()));
    expect(payload.notes).toEqual([]);
    expect(payload.attachmentBlobs).toEqual([]);
    expect(payload.transcript.rows.length).toBe(5);
    expect(payload.transcript.prevCgpa).toBe('');
  });

  it('rejects non-JSON, wrong app, and wrong schema version', () => {
    expect(() => parseAndValidateBackupJson('not json')).toThrow('not valid JSON');
    const wrongApp = baseArchive() as Record<string, unknown>;
    (wrongApp.manifest as Record<string, unknown>).app = 'OtherApp';
    expect(() => parseAndValidateBackupJson(JSON.stringify(wrongApp))).toThrow(
      'manifest.app'
    );
    const wrongSchema = baseArchive() as Record<string, unknown>;
    (wrongSchema.manifest as Record<string, unknown>).schemaVersion = 2;
    expect(() => parseAndValidateBackupJson(JSON.stringify(wrongSchema))).toThrow(
      'Unsupported backup schema version'
    );
  });

  it('rejects a manifest count that disagrees with the data', () => {
    const archive = baseArchive();
    archive.manifest.counts.routine = 1;
    expect(() => parseAndValidateBackupJson(JSON.stringify(archive))).toThrow(
      'count mismatch for "routine"'
    );
  });

  it('rejects duplicate IDs and broken attachment references', () => {
    const dup = baseArchive();
    const note = {
      id: 'n1',
      title: 'Note',
      body: '',
      attachments: [],
      createdAt: 0,
      updatedAt: 0,
    };
    (dup.data.notes as unknown[]).push(note, { ...note });
    expect(() => parseAndValidateBackupJson(JSON.stringify(dup))).toThrow('Duplicate ID');

    const broken = baseArchive();
    (broken.data.notes as unknown[]).push({
      ...note,
      attachments: [
        {
          id: 'a-missing',
          noteId: 'n1',
          kind: 'image',
          filename: 'x.png',
          mimeType: 'image/png',
          sizeBytes: 5,
          durationSec: null,
          createdAt: 0,
        },
      ],
    });
    expect(() => parseAndValidateBackupJson(JSON.stringify(broken))).toThrow(
      'binary data is missing'
    );
  });

  it('round-trips one attachment with its note', () => {
    const archive = baseArchive();
    archive.manifest.counts.notes = 1;
    archive.manifest.counts.attachments = 1;
    (archive.data.notes as unknown[]).push({
      id: 'n1',
      title: 'Note',
      body: '',
      attachments: [
        {
          id: 'a1',
          noteId: 'n1',
          kind: 'image',
          filename: 'x.png',
          mimeType: 'image/png',
          sizeBytes: 5,
          durationSec: null,
          createdAt: 0,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    });
    (archive.data.attachments as unknown[]).push({
      id: 'a1',
      noteId: 'n1',
      kind: 'image',
      filename: 'x.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      durationSec: null,
      createdAt: 0,
      base64: 'aGVsbG8=',
    });
    const payload = parseAndValidateBackupJson(JSON.stringify(archive));
    expect(payload.attachmentBlobs.length).toBe(1);
    expect(payload.attachmentBlobs[0].blob.size).toBe(5);
  });

  it('round-trips transcript state and enforces its manifest count', () => {
    const archive = baseArchive() as Record<string, unknown>;
    const data = archive.data as Record<string, unknown>;
    data.transcript = {
      prevCgpa: '3.50',
      prevCredits: '60',
      rows: [{ name: 'CSE101', grade: 'A', credit: '3' }],
    };
    const manifest = archive.manifest as Record<string, unknown>;
    (manifest.counts as Record<string, unknown>).transcriptRows = 1;
    const payload = parseAndValidateBackupJson(JSON.stringify(archive));
    expect(payload.transcript.prevCgpa).toBe('3.50');
    expect(payload.transcript.rows.length).toBe(1);
    expect(payload.transcript.rows[0].name).toBe('CSE101');

    (manifest.counts as Record<string, unknown>).transcriptRows = 2;
    expect(() => parseAndValidateBackupJson(JSON.stringify(archive))).toThrow(
      'count mismatch for "transcriptRows"'
    );
  });

  it('treats a pre-v1.1.0 archive without transcript counts as blank transcript', () => {
    // No transcript section and no transcriptRows count: must still import.
    const payload = parseAndValidateBackupJson(JSON.stringify(baseArchive()));
    expect(payload.transcript.prevCgpa).toBe('');
    expect(payload.transcript.rows.length).toBe(5);
  });
});
