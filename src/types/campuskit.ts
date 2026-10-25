export type TabId = 'today' | 'routine' | 'attend' | 'cgpa' | 'exams' | 'study' | 'notes';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ClockFormat = '12h' | '24h';
export type WeekStart = 'saturday' | 'sunday' | 'monday';

export interface AppSettings {
  theme: ThemePreference;
  clockFormat: ClockFormat;
  weekStart: WeekStart;
  soundEnabled: boolean;
}

export interface RoutineClass {
  id: string;
  subject: string;
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // HH:MM (24h local)
  endTime: string; // HH:MM (24h local)
  room: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttendanceSubject {
  id: string;
  name: string;
  requiredPercentage: number; // > 0 and <= 100, default 80
  total: number; // integer >= 0
  attended: number; // integer >= 0, <= total
  createdAt: number;
  updatedAt: number;
}

export interface CompletedSemester {
  id: string;
  name: string;
  credits: number; // > 0
  gpa: number; // 0.00 to 4.00
  createdAt: number;
  updatedAt: number;
}

export interface CurrentCourse {
  id: string;
  name: string;
  credits: number; // > 0
  expectedGradePoints: number; // 0.00 to 4.00
  createdAt: number;
  updatedAt: number;
}

export type DeadlineType = 'Exam' | 'Assignment' | 'Quiz';

export interface DeadlineItem {
  id: string;
  title: string;
  type: DeadlineType;
  dueDate: string; // YYYY-MM-DD local calendar date
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export type StudyPresetId = 'focus-25' | 'focus-50' | 'break-5' | 'break-15';

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD local calendar date
  minutes: number; // integer >= 1
  source: 'timer' | 'manual';
  label: string;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedTimerState {
  presetId: StudyPresetId;
  mode: 'focus' | 'break';
  durationMs: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
  startedAtMs: number | null;
  accumulatedElapsedMs: number;
  sessionToken: string;
  savedSessionToken: string | null;
}

export type AttachmentKind = 'image' | 'audio' | 'voice';

export interface NoteAttachmentMeta {
  id: string;
  noteId: string;
  kind: AttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  createdAt: number;
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  attachments: NoteAttachmentMeta[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredAttachmentBlob extends NoteAttachmentMeta {
  blob: Blob;
}

export interface SerializedBackupAttachment extends NoteAttachmentMeta {
  base64: string;
}

export interface BackupManifest {
  app: 'CampusKit';
  schemaVersion: 1;
  exportedAt: string;
  counts: {
    routine: number;
    attendance: number;
    semesters: number;
    courses: number;
    deadlines: number;
    studySessions: number;
    notes: number;
    attachments: number;
  };
}

export interface BackupArchive {
  manifest: BackupManifest;
  data: {
    settings: AppSettings;
    routine: RoutineClass[];
    attendance: AttendanceSubject[];
    semesters: CompletedSemester[];
    courses: CurrentCourse[];
    deadlines: DeadlineItem[];
    studySessions: StudySession[];
    notes: NoteItem[];
    attachments: SerializedBackupAttachment[];
  };
}
