# CampusKit

**Live app: https://khalidhasan11.github.io/campuskit/** — open it in Chrome on Android and choose "Add to Home screen" to install.

Free, offline-first student productivity PWA for university students in Bangladesh. No account, no subscription, no premium locks, no ads, no backend, and no AI API required for any core feature.

## 📱 Download the Android APK

Prefer a real app instead of the browser? CampusKit is also published as an installable Android APK (built with Capacitor — the app is bundled inside the APK and works fully offline; it does not just open the website).

- **All releases:** https://github.com/khalidhasan11/campuskit/releases
- **Direct download (v1.0.0):** https://github.com/khalidhasan11/campuskit/releases/download/v1.0.0/CampusKit-v1.0.0-debug.apk
- Package: `com.khalidhasan11.campuskit` · Version 1.0.0 (versionCode 1) · Size: 4,240,000 bytes · Requires Android 6.0 (API 23) or newer. The download page is public — no GitHub account needed.

**How to install**

1. Open the direct download link above on your Android phone and download the APK.
2. Tap the downloaded file to install it.
3. Android will ask you to allow installation from that source (your browser or Files app) — allow it for this install. This prompt is normal for APKs installed outside the Play Store.
4. Open CampusKit from your app drawer. No account, no sign-in, no internet needed.

**Release notes — v1.0.0**

- First Android release: all seven tabs (Today, Routine, Attend, CGPA, Exams, Study, Notes) with local data storage, IndexedDB note attachments (images, audio, voice recording), backup export/restore, themes, and full offline use.
- Permissions: microphone only (for voice notes). The APK requests **no internet permission**.

> **⚠️ Debug signing — please read.** The v1.0.0 APK is a **debug-signed build for testing**, because production signing secrets are not configured on this repository yet. It installs and runs normally, but Android may show an extra warning, and when a differently-signed production build is released later you will need to **uninstall this build before installing the new one** (switching signatures cannot update in place). **Back up first:** Settings → Export backup, so your data can be restored after reinstalling. Always keep a recent backup of your CampusKit data.

### For production signed releases

Properly signed release APKs are produced automatically by the same workflow as soon as these four repository secrets exist (Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_BASE64` (base64 of your release keystore), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. With them set, pushing a new `v*` tag builds `CampusKit-v<version>.apk` signed with that keystore and publishes it on the release instead of the debug build. The keystore file itself must never be committed to this repository.

> This repository contains the CampusKit build produced in Google AI Studio (app `d9c57795-f6db-4e7f-8c63-887a9d150bca`) and QA-checked locally on Oct 25, 2026. See `QA_REPORT.md` in the project archive for the full verification record, including known pre-publish fixes.

## Features

Exactly seven bottom tabs:

- **Today** dashboard from real stored data only: today's classes, nearest upcoming deadline with a local-calendar-day countdown, today's study minutes, current streak, attendance warnings, quick actions
- **Routine**: add/edit/delete weekly classes, end-after-start validation, overlap warning (entries are never silently discarded), grouped by weekday, sorted by start time, current day highlighted, ongoing vs upcoming classes distinguished
- **Attend**: subjects with a required percentage (default 80%), one-tap Present/Absent, correction workflow. Exact math in `src/utils/dateAndMath.ts`: percentage `100 × A / T`, safe absences `floor(A/r − T)` and recovery `ceil((rT − A)/(1 − r))`, each verified afterwards against the original inequalities using integer arithmetic, with the 100%-requirement special case and "No classes recorded" for zero classes
- **CGPA**: credit-weighted cumulative CGPA (never a simple average of semester GPAs), current-semester projection clearly labelled as an estimate, What-If simulator handling achievable / already-secured / impossible (> 4.00) / zero-remaining / zero-completed / invalid inputs
- **Exams**: Exam / Assignment / Quiz deadlines, add/edit/delete, complete/reopen, filter by type and status, sorted by nearest due date, local-calendar-day countdowns (Due Today and overdue states; completed items never show as active overdue)
- **Study**: Focus 25 / Focus 50 / Break 5 / Break 15 presets, circular progress ring, timestamp-based timer persisted across refreshes, a completed focus session is saved exactly once (session-token guard), breaks never count as study minutes, last-7-calendar-days bar chart plus text summary, streak ending today or yesterday, manual study-minute entries
- **Notes**: "+ New Note" opens the editor immediately, without waiting on storage or network. Title/body/search, save status, image and audio attachments stored as Blobs in IndexedDB (`src/storage/blobDb.ts`), voice recording with MediaRecorder (permission requested only after tapping Record, microphone tracks released afterwards), deleting a note also deletes its attachments

**Settings** (header gear icon, not an eighth tab): light/dark/system theme, clock format, week-start preference, backup export/restore, clear all local data, privacy information, About and storage status.

## Screenshots

To be added from the live deployment. No fabricated screenshots are included.

## Installation (users)

Open https://khalidhasan11.github.io/campuskit/ in Chrome on Android (or any modern browser) and choose "Add to Home screen" / Install. After the first successful load the app shell is cached and core features work offline.

## Local development

Prerequisites: Node.js 20+.

```bash
npm install     # or: npm ci
npm run dev     # vite dev server on port 3000
npm run lint    # tsc --noEmit (typecheck)
npm run build   # vite build -> dist/
npm run preview
```

No `.env` file or API key is needed to run this app; no app code in `src/` calls any AI or network API. (The unused Google AI Studio boilerplate from the export — the `@google/genai` / `express` / `dotenv` dependencies and the Gemini capability declaration in `metadata.json` — has been removed.)

This project has no unit-test suite of its own. Its calculation functions in `src/utils/dateAndMath.ts` were cross-checked locally against an independent 26-case QA harness covering attendance, CGPA, What-If, calendar-day differences, streaks, weekly totals, and timer save-once behaviour; all areas matched (see the QA report).

## Deployment (GitHub Pages, free)

1. Create a public GitHub repository named `campuskit` and push this project to `main`.
2. In the repo: Settings → Pages → Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` runs on every push to `main`: `npm ci` → `npm run lint` → `npm run build` → deploy via `actions/deploy-pages`. No `--base` flag is needed.
4. **Base path:** the app is base-relative throughout, so the same build works at a domain root and under the `/campuskit/` project-site subpath. `vite.config.ts` sets `base: './'` (valid because this is a single-page app with no path-based routing); the manifest's `start_url`/`scope`/`id`/icon `src`s are relative (resolved against the manifest URL); the service worker is registered via `import.meta.env.BASE_URL` with its default scope (the directory containing `sw.js`); and the SW precache list and build-asset injection are scope-relative, resolved against the SW's registration scope at runtime. This was verified locally by serving `dist/` under a `/campuskit/` prefix (see the QA report addendum).
5. After deployment, verify the live URL in a mobile browser, reload while offline, and test install/"Add to Home screen" before adding screenshots above.

## Privacy

All student records stay on the device: small structured data and settings in localStorage (versioned keys `campuskit_v1_*`), attachment binaries only in IndexedDB. Note text is never stored as base64 in localStorage. The app includes no analytics, advertising SDKs, tracking pixels, or third-party requests for core features, and embeds no API secrets. The microphone is used only for voice notes, only after you tap Record. Browser storage can be cleared or evicted by the browser/OS, so export a backup regularly; the app does not claim browser data is permanently guaranteed.

## Offline behaviour

A versioned service worker (`campuskit-shell-v1.0.0-<build hash>`, hash injected at build time by `vite.config.ts`) precaches the app shell, cleans up old caches on activation, serves an offline fallback page, and explicitly refuses to cache private/blob/attachment requests. Note attachments are never placed in the shared service-worker asset cache.

## Backup and restore

Settings → Backup exports a versioned archive containing routine, attendance, semesters and courses, deadlines, study sessions and timer state, notes, settings, and attachments (attachments are base64-encoded only inside the backup file). Import validates the file (maximum 80 MB, schema, IDs, and attachment references) and offers Merge (deduplicated by ID) and Replace modes with explicit confirmation; a failed restore preserves existing data.

## Troubleshooting

- **Voice recording fails:** it needs a secure context (HTTPS or localhost), microphone permission, and MediaRecorder support. The app shows the specific reason.
- **App shows an old version:** a service-worker update prompt appears when a new worker is waiting; otherwise close/reopen the app, or clear site data (export a backup first).
- **Data missing after a browser cleanup:** evicted browser storage cannot be recovered; restore from a backup export.
- **Assets 404 on GitHub Pages:** the build is base-relative (see step 4 under Deployment), so assets resolve under any deployment path; if assets still 404, check that Pages is serving the `dist/` artifact built by the workflow, not the repository root.

## Contributing

Issues and pull requests are welcome. Run `npm run lint && npm run build` before submitting. Keep calculations in `src/utils/dateAndMath.ts` pure and covered by the QA harness cases; never store binary data in localStorage.

## License

**MIT License** (see `LICENSE`). The dependencies used (React, Vite, Tailwind CSS, lucide-react, motion) are distributed under permissive MIT/ISC-style licences.

## Tech

React 19 + TypeScript + Vite 8, Tailwind CSS 4, lucide-react icons, hand-rolled IndexedDB wrapper and custom service worker (no Workbox), localStorage + IndexedDB storage only.
