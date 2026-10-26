export type TabId = 'today' | 'routine' | 'attend' | 'cgpa' | 'exams' | 'study' | 'notes';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ClockFormat = '12h' | '24h';
export type WeekStart = 'saturday' | 'sunday' | 'monday';

export interface ReminderSettings {
  classReminders: boolean; // within 60 mins
  deadlineReminders: boolean; // due tomorrow
  attendanceRiskReminders: boolean; // below required %
}

export interface AppSettings {
  theme: ThemePreference;
  clockFormat: ClockFormat;
  weekStart: WeekStart;
  soundEnabled: boolean;
  gradingScaleMax: number; // default 4.00, allows 4.00, 5.00, or custom 2.00 to 10.00
  reminders: ReminderSettings;
}

export interface RoutineCourse {
  id: string;
  name: string;
  courseCode: string;
  credits: number;
  teacher: string;
  classroom: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineClass {
  id: string;
  subject: string;
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // HH:MM (24h local)
  endTime: string; // HH:MM (24h local)
  room: string;
  courseId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttendanceSubject {
  id: string;
  name: string;
  requiredPercentage: number; // > 0 and <= 100, default 80
  total: number; // integer >= 0
  attended: number; // integer >= 0, <= total
  lateCount?: number; // integer >= 0, counts as attended
  excusedCount?: number; // integer >= 0, excluded from total & attended
  createdAt: number;
  updatedAt: number;
}

export type AttendanceActionType = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceUndoState {
  subjectId: string;
  subjectName: string;
  actionLabel: 'Present' | 'Absent' | 'Late' | 'Excused';
  prevAttended: number;
  prevTotal: number;
  prevLateCount: number;
  prevExcusedCount: number;
  timestamp: number;
}

export interface SemesterHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
}

export interface SemesterSettings {
  semesterName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  holidays: SemesterHoliday[];
}

export interface CompletedSemester {
  id: string;
  name: string;
  credits: number; // > 0
  gpa: number; // 0.00 to gradingScaleMax
  createdAt: number;
  updatedAt: number;
}

export interface CurrentCourse {
  id: string;
  name: string;
  credits: number; // > 0
  expectedGradePoints: number; // 0.00 to gradingScaleMax
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
    routineCourses?: number;
    holidays?: number;
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
    routineCourses?: RoutineCourse[];
    semesterSettings?: SemesterSettings;
  };
}
