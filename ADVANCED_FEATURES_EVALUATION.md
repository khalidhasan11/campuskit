# CampusKit — Phase F: Advanced Features Evaluation

Evaluation only (per the upgrade instruction: assess after Phases A–E are stable; build nothing here).
Criteria: student value, offline feasibility, internet/external-service requirement, privacy impact, fit with CampusKit's core promise (free, no account, no backend, no ads).

## 1. Course-based study materials
- **What:** attach files/links to a course and organise notes by course.
- **Value:** Medium-high — students already keep screenshots/PDFs per course; Notes attachments exist but are not course-linked.
- **Offline:** Fully feasible offline — files already store as IndexedDB blobs; a course link on notes/materials is a small additive field.
- **Internet/external service:** None required.
- **Privacy:** None — all on-device.
- **Recommendation:** ADOPT LATER (offline-only variant). Small, natural extension of Notes + Courses; no new infrastructure. Best sequenced after the Courses catalog (Phase B) has real usage.

## 2. Performance insights
- **What:** trends from existing data — attendance trajectory per course, study-time patterns, CGPA trend across semesters.
- **Value:** Medium — motivating when honest; dangerous if it invents predictions.
- **Offline:** Fully feasible — pure computation over local data already collected (attendance, study sessions, semesters).
- **Internet/external service:** None.
- **Privacy:** None — on-device aggregates only.
- **Recommendation:** ADOPT LATER (offline-only, descriptive only). Show trends and facts ("you study most on Thursdays"), never fabricated forecasts or scores. Needs enough real usage data to be meaningful, so it should follow, not precede, core reliability work.

## 3. Flashcards
- **What:** user-created decks (question/answer cards) with a review mode, optionally simple spaced repetition.
- **Value:** High for exam revision — the strongest candidate in this list.
- **Offline:** Fully feasible — cards are small structured records in localStorage/IndexedDB; review logic and a basic SM-2-style scheduler are pure local computation.
- **Internet/external service:** None required. (Auto-generating cards from notes with AI *would* need a service — that variant is excluded here; manual + paste-to-create is enough for v1.)
- **Privacy:** None for the offline variant.
- **Recommendation:** ADOPT LATER as the first Phase F feature — offline-only, manual card creation, simple spaced repetition, exportable with the existing backup system. Fits the free/no-account promise exactly.

## 4. Revision quizzes
- **What:** self-tests — either user-authored MCQs or quizzes generated from flashcards/notes.
- **Value:** Medium — real revision value, but authoring burden is high; generated quizzes need either heavy local templating (low quality) or AI (external service).
- **Offline:** User-authored MCQs are feasible offline (same storage pattern as flashcards); quality auto-generation is not.
- **Internet/external service:** Not required for the manual variant; required for AI-generated questions.
- **Privacy:** None for the manual variant.
- **Recommendation:** DEFER — only as a manual-MCQ companion to flashcards, and only if flashcards see actual use. Do not build an AI-generated quiz feature under the current product promise.

## 5. AI study assistant
- **What:** chat/explanations/summaries powered by a large language model.
- **Value:** Potentially high, but generic — every general AI app already does this, and it is not CampusKit's differentiator (offline academic organisation is).
- **Offline:** Not feasible — no on-device model of useful quality fits a lightweight PWA/APK for typical Bangladeshi student phones.
- **Internet/external service:** REQUIRES INTERNET AND AN EXTERNAL AI SERVICE (API keys, per-use cost, or a paid tier) — directly conflicts with CampusKit's locked promise: completely free, no account, no backend, no AI API for core functionality, zero budget.
- **Privacy:** Significant — student notes/questions would leave the device to a third-party service; would require new consent, a privacy-policy change, and data-handling guarantees CampusKit currently does not need.
- **Recommendation:** REJECT for CampusKit under its current promise. Revisit only if Khalid explicitly changes the product promise (paid budget, accounts, privacy policy) — and even then as an optional, clearly-labelled online add-on, never a core feature.

## Summary
| Feature | Verdict | Internet needed | Privacy impact |
|---|---|---|---|
| Course study materials | Adopt later (offline variant) | No | None |
| Performance insights | Adopt later (descriptive, offline) | No | None |
| Flashcards | Adopt later — first Phase F feature | No | None |
| Revision quizzes | Defer (manual-MCQ only, after flashcards) | No (manual) | None |
| AI study assistant | Reject under current promise | **Yes + paid external service** | **High** |
