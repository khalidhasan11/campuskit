# CampusKit Audit — Oct 25, 2026 (pre-upgrade, v1.0.0)

Method: full read of `src/` (App, all 9 components, context, hooks, storage, utils,
types), both GitHub workflows, `android/` config, README, QA_REPORT.md and
APK_REPORT.md. Labels: **CONFIRMED** = seen in code/evidence; **PROPOSED** = suggestion,
not a verified defect. Runtime behaviours that can only be exercised on a device or in
a live browser session are marked UNVERIFIED rather than assumed broken or working.

## What already exists and works (verified in code — do NOT rebuild)

- **Backup validation is already strict.** `parseAndValidateBackupJson`
  (`src/storage/localStore.ts`) validates manifest app/schemaVersion, every collection
  with per-record validators (`validateStrictArray`, duplicate-ID detection), and
  attachment reference integrity in BOTH directions (attachment → note, note →
  attachment binary present). `executeValidatedRestore` snapshots existing
  localStorage + blobs first and rolls back on write failure ("Restore failed and
  existing data was kept intact"). Replace mode requires picking the mode and clicking
  an explicit Confirm button with a counts preview (`SettingsModal.tsx`).
- **Math is correct and integer-verified.** `computeAttendanceMetrics`,
  `computeCompletedCgpa` (credit-weighted), `computeWhatIfGpa` (all branches),
  `calendarDaysFromToday` (UTC-midnight of local components), streak in
  `computeStudyAnalytics` — all traced against the 26-case QA harness (see QA_REPORT.md).
- **Per-subject attendance threshold already exists** (`AttendanceSubject.requiredPercentage`,
  default 80, validated >0–100). Phase C's "configurable thresholds" is DONE.
- **Delete confirmations exist** for: routine class (modal), attendance subject (modal),
  note delete (`window.confirm`), clear-all-data (type "CLEAR").
- **Service worker** is registered (`App.tsx` calls `useServiceWorkerStatus`), precache
  is base-relative, and SW + install prompt are guarded off under Capacitor native
  (`src/hooks/usePWA.ts`).
- **Android**: Capacitor 7.6.9, package `com.khalidhasan11.campuskit`, INTERNET
  permission removed, RECORD_AUDIO + MODIFY_AUDIO_SETTINGS present, debug-signed
  v1.0.0 release published; CI workflow has conditional signed-release path.

## Prioritized issues

### P1 — Reliability / data loss

1. **CONFIRMED — No automated tests in the repo.** `package.json` has no test script
   and no test files; both workflows only run `tsc`. The 26 verified cases live in a
   separate harness repo (`~/workspace/campuskit-pwa`) that CI never runs, so a future
   edit can silently break attendance/CGPA math. → Phase A: add vitest + ported tests,
   wire into both workflows.
2. **CONFIRMED — Instant, unconfirmed deletes in three views.** `CgpaView.tsx`
   (semester L343, course L435), `ExamsView.tsx` (deadline L324) and `StudyView.tsx`
   (session L417) call delete directly on click — one mis-tap permanently deletes a
   semester's GPA record. Inconsistent with Routine/Attend/Notes, which confirm.
   → Phase A: add confirmations.
3. **CONFIRMED (minor) — Backup import size is only checked after reading the file**
   (`parseAndValidateBackupJson` checks text length); `SettingsModal.handleFileChosen`
   never checks `file.size` first, so an oversized file is fully read into memory
   before rejection. → Phase A: pre-check with a specific message.
4. **CONFIRMED (minor) — Manifest counts are not cross-checked** against the actual
   arrays during import. Record-level validation still catches corrupt data, so this
   is defence-in-depth, not a hole. → Noted; not blocking.
5. **UNVERIFIED (runtime)** — Persistence across app restarts, offline/airplane-mode
   start, IndexedDB attachment survival, mic recording in the APK WebView, and backup
   export inside the APK (Blob anchor download — known WebView risk, see APK_REPORT.md)
   can only be tested on a real device/browser. Code paths are present and reviewed;
   they are listed as device checks in the upgrade report, not claimed as tested.

### P2 — Missing features from the upgrade brief

6. **CONFIRMED — Attendance has only Present/Absent.** No Late/Excused concepts in
   `AttendanceSubject`, `markAttendance`, or the undo state (`CampusKitContext.tsx`
   `AttendanceUndoState.actionLabel: 'Present' | 'Absent'`). Undo IS snapshot-based
   (prevAttended/prevTotal), so extending it is safe. → Phase C.
7. **CONFIRMED — Grading scale is hardcoded to 4.00** in `computeWhatIfGpa`
   (validation + impossibility), `computeCompletedCgpa`/`computeProjectedCgpa`
   (gpa ≤ 4 filters) and CGPA form validation. No university-agnostic setting exists.
   → Phase C: configurable scale in Settings, default 4.00 = identical behaviour.
8. **CONFIRMED — No course catalog.** Routine classes, attendance subjects and CGPA
   courses are three unlinked concepts; no course code/teacher/classroom record, and
   no CSV timetable import anywhere. → Phase B (additive catalog + optional link +
   CSV import with preview).
9. **CONFIRMED — No semester configuration** (name, start/end dates, holidays) in
   `AppSettings` or Settings (tabs are only Preferences/Backup/Storage/About).
   → Phase B.
10. **CONFIRMED — No reminders.** Nothing reads `Notification` API; Today dashboard
    (TodayView.tsx) shows classes/deadlines but has no compact "next class" line
    (only an 'Ongoing now' badge at L362). → Phase D (in-app-only reminders with
    honest copy; next-class line).

### P3 — Android / UI polish

11. **CONFIRMED — Android ships the Capacitor template launcher/splash assets.**
    `android/app/src/main/res/mipmap-*` and `drawable/splash.png` are the files
    generated by `cap add android`; no custom icon step exists in git history. The
    app's own PWA art (`public/pwa-512x512.png`, `pwa-maskable-512x512.png`) was never
    converted. → Phase E.
12. **CONFIRMED — No Android hardware back-button handling.** `@capacitor/app` is not
    a dependency; back behaviour is the WebView default. → Phase E.
13. **CONFIRMED (minor) — No microphone-purpose explanation** near the Record button
    in `NotesView.tsx` (errors are handled, purpose is never stated). → Phase E.
14. **Checked, mostly OK — accessibility/responsiveness:** icon buttons in the views
    audited carry `aria-label`s (header, delete buttons, undo dismiss), touch targets
    use `min-h-[44px]` in header/settings, layout is a single max-w-2xl column from
    320px. No confirmed a11y defect beyond item 13 was found in this pass; small
    icon-only buttons inside cards vary and are a PROPOSED tidy-up, not a defect claim.

### P4 — Maintainability / performance (PROPOSED only)

15. **PROPOSED** — `tsconfig` does not enable `strict`; enabling it repo-wide is a
    large, risky change for this upgrade and is NOT attempted.
16. **PROPOSED** — Very large components (Context 1148 lines, localStore 849) work and
    are validated; splitting them is refactoring risk without user benefit this round.
17. **CONFIRMED (cosmetic)** — `package.json` name is still the AI Studio boilerplate
    `react-example`; harmless, noted only.

## Phase F note

Course materials, insights, flashcards, quizzes and an AI assistant would be evaluated
in a separate document — none are implemented in this audit step.

## Local fixes that an AI Studio re-export would lose

**Read this before merging any new AI Studio export.** The canonical repo is NOT a raw
AI Studio export — the following fixes were applied locally on top of the original
export (Oct 25, 2026) and exist only in this git history. A fresh "Download as .zip"
from AI Studio contains NONE of them; merging an export naively would silently regress
every item below. (Hashes: the QA/base-path commits were originally `1b57d7e`/`930aee7`;
in this repo's current history, after an author rewrite, they are `0500b84`/`0b4891a`.)

1. **Service worker actually registering** (`0b4891a`, `src/App.tsx`): the AI Studio
   code defined the registration hook but never called it, so the SW never registered
   and offline/install could not work anywhere. `App.tsx` now calls
   `useServiceWorkerStatus()` for its registration side effect.
2. **Fully base-relative PWA** (`0b4891a`): `vite.config.ts` sets `base: './'` and its
   SW plugin injects `./assets/…` (not `/assets/…`); `public/manifest.webmanifest` uses
   `id`/`start_url`/`scope` of `"."` and bare icon filenames; `public/sw.js` precache
   entries are `./…` resolved against `self.registration.scope`; `index.html` and
   `public/offline.html` use relative references; SW registration in
   `src/hooks/usePWA.ts` registers `` `${import.meta.env.BASE_URL}sw.js` `` with no
   hard-coded scope. Without this, install/offline break under
   `khalidhasan11.github.io/campuskit/`. Proven: 13/13 URLs 200 served under
   `/campuskit/`, and the same checks pass on the live site.
3. **esbuild pin fix** (`0500b84`, `package.json`): devDependency `esbuild: ^0.28.0`.
   AI Studio pinned `^0.25.0`, which makes a fresh `npm install` FAIL (ERESOLVE against
   Vite 8's peer range `^0.27 || ^0.28`). Any re-export regresses this and will not
   install until re-bumped.
4. **Boilerplate removal** (`0b4891a`): `@google/genai`, `express`, `dotenv` and
   `@types/express` dependencies deleted (118 packages — verified unused in `src/`);
   `metadata.json` `majorCapabilities` emptied (it falsely declared a server-side
   Gemini capability); `.env.example` rewritten to state no API key is needed. A
   re-export restores all of this, including a README that wrongly tells users to set
   a Gemini key.
5. **Repo scaffolding from QA** (`0500b84`): the accurate `README.md` (replaces the AI
   Studio boilerplate), MIT `LICENSE`, extended `.gitignore`, and
   `.github/workflows/deploy.yml` (Pages via Actions: npm ci → tsc → build →
   deploy-pages). `package-lock.json` in this repo is the npm lockfile the workflows'
   `npm ci` depends on.
6. **The entire Capacitor/Android layer** (`50f6f4c`): `@capacitor/core` +
   `@capacitor/android` dependencies and `@capacitor/cli` devDependency;
   **`capacitor.config.json`** — deliberately JSON, not TypeScript: the Capacitor CLI's
   TS-config loader crashes against this project's TypeScript 7, so a re-export (or a
   well-meaning "cleanup") that switches to `capacitor.config.ts` breaks `cap sync`;
   the whole **`android/` folder** (app `build.gradle` with versionName 1.0.0 /
   versionCode 1 and the env-driven release signing config, `AndroidManifest.xml` with
   `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` and INTERNET deliberately removed,
   `MainActivity.java`, all `res/` assets); Android entries in `.gitignore`; and
   **`.github/workflows/android.yml`** (JDK 21 + cap sync + assembleDebug, conditional
   signed `assembleRelease` when the 4 `ANDROID_*` secrets exist, APK artifact upload,
   tag → public GitHub Release).
7. **Android CI fix** (`b1916fb`): `android.yml` requests an explicit Android SDK
   package list for `setup-android` — its default list includes the retired legacy
   `tools` package and the workflow fails without this.
8. **Service worker / install-prompt native guard** (`50f6f4c`, `src/hooks/usePWA.ts`):
   `isNativeShell()` (`Capacitor.isNativePlatform()`) skips SW registration and the
   PWA install-prompt wiring inside the Android app, where the Capacitor bridge serves
   bundled assets. A re-export restores the unguarded web-only behaviour inside the
   native shell.
9. **README APK section** (`ccfd6e3`): the "Download the Android APK" section (v1.0.0
   debug release link, install steps, debug-signing explanation, production-secret
   steps).
10. **Social preview / Open Graph image** (`9f8d0cc`, Oct 26, 2026): `index.html`
    carries `og:url`, `og:image` (absolute URL
    `https://khalidhasan11.github.io/campuskit/og-image.png`, 1200x627, with
    width/height/alt) and `twitter:image`; `public/og-image.png` is the CampusKit
    cover artwork (same file as the LinkedIn project cover in
    `~/workspace/goals/linkedin-growth-plan/files/profile-assets/`). Added because
    LinkedIn showed "Image unavailable" for the live-app link: the site had
    og:title/og:description but NO og:image, so no crawler could build a preview.
    An AI Studio re-export loses both the meta tags and the image file; re-apply
    them or LinkedIn/Facebook link previews break again.

**Merge rule for the AI Studio upgrade:** after exporting the upgraded app, diff it
against this repo and re-apply items 1–10 (or cherry-pick the feature changes into this
repo instead of replacing files wholesale). In particular, never let an export
overwrite `vite.config.ts`, `public/sw.js`, `public/manifest.webmanifest`,
`src/hooks/usePWA.ts`, `src/App.tsx` (SW call), `package.json` (esbuild + Capacitor
deps), `capacitor.config.json`, `android/`, or either workflow without checking it
against the list above.
