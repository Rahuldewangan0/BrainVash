# BrainVash — Project Implementation Progress & Architecture Tracker

## 1. System Overview
BrainVash is an online quiz, assessment, and performance analysis platform engineered for engineering students.
- **Frontend Stack**: React 18, Vite, Tailwind CSS / Vanilla CSS Variables, Vanilla Hash Routing (`#home`, `#dashboard`, `#admin`)
- **Backend Stack**: Supabase PostgreSQL, Supabase Auth (`auth.users`), Row Level Security (RLS), PL/pgSQL Stored Procedures

---

## 2. Implementation Status Checklist

### Phase 1: Authentication & Student Dashboard (100% Complete)
- [x] **Student Authentication**:
  - Full email/password registration with college, branch, and semester selection (`src/components/SignUpModal.jsx`).
  - Student login with persistent session restoration (`src/components/LoginModal.jsx`).
  - Logout and password recovery flow (`src/components/ResetPasswordModal.jsx`).
  - Auth context and decoupled hook (`src/contexts/AuthContext.jsx`, `src/contexts/useAuth.js`).
- [x] **Student Dashboard (`src/components/Dashboard.jsx`)**:
  - **Overview Tab**: Live statistics cards (Quizzes Attempted, Average Score, Accuracy, Total Points), recent attempts log, quick launch shortcuts (`OverviewTab.jsx`).
  - **Quizzes Tab**: Subject, category, and semester filters with live quiz cards (`QuizzesTab.jsx`).
  - **Results Tab**: Historical attempt logs, individual question marks, and completion status (`ResultsTab.jsx`).
  - **Analytics Tab**: Performance breakdown, accuracy charts, and mastery grading (`AnalyticsTab.jsx`).
  - **Leaderboard Tab**: Real-time global and weekly rankings queried via database RPC (`LeaderboardTab.jsx`).
  - **Settings Tab**: Account and profile update settings (`SettingsTab.jsx`).
  - **Study Hub Tab**: Curriculum roadmap and track previews (`StudyHubTab.jsx`).
- [x] **Quiz Taking & Grading Engine**:
  - Pre-quiz **Difficulty Selection Modal** (`src/components/DifficultySelectionModal.jsx`): Easy (Beginner), Medium (Standard), Hard (Advanced) selection before quiz start.
  - Interactive timer-driven runner (`src/components/dashboard/QuizRunnerModal.jsx`).
  - Server-side grading procedure (`submit_quiz_attempt` RPC).
  - Post-quiz review modal (`src/components/dashboard/QuizReviewModal.jsx`).

---

### Phase 2: Admin Management System (100% Frontend Implemented, Backend Staged)
- [x] **Admin Authentication & Access Control (`src/components/admin/AdminPanel.jsx`)**:
  - Dedicated admin workspace at `#admin`.
  - Database-backed admin role verification (`profile.is_admin === true` synced from `public.profiles`).
  - Non-admin / unauthenticated guard with "Access Denied" barrier.
  - Role indicator chip in Navbar and Student Dashboard for authorized admins.
- [x] **Admin Dashboard & KPIs (`src/components/admin/AdminOverview.jsx`)**:
  - Real-time statistics from Supabase: Total Quizzes (Published vs Draft), Total Questions (Easy, Medium, Hard breakdown), Enrolled Students, Total Attempts, and Average Accuracy.
  - Live Assessment Activity table showing student submissions, selected difficulty, scores, and status.
  - Management shortcuts and Security & Governance checklist.
- [x] **Subject Management (`src/components/admin/SubjectManagement.jsx`)**:
  - Full CRUD on `public.subjects` (Create, Edit, Delete, Toggle Active/Inactive).
  - Academic branch and semester (1-8) categorization.
  - Real-time search by name, code, or branch.
  - Pre-delete validation preventing accidental deletion of subjects with linked quizzes.
- [x] **Quiz Management (`src/components/admin/QuizManagement.jsx`)**:
  - Full CRUD on `public.quizzes` (Create, Edit, Delete).
  - Configuration for title, slug, subject, semester, branch, difficulty, duration, total questions, total marks, passing score, negative marks, max attempts, and daily challenge flag.
  - **Publishing Validation System**: Checks title, subject, duration, assigned questions count, 4 valid options per question, and answer keys before allowing a quiz to go live.
  - Confirmation modals for publishing and unpublishing.
  - Reusable Question Drawer: Links and unlinks questions via the `quiz_questions` junction table.
- [x] **Reusable Question Bank (`src/components/admin/QuestionBank.jsx`)**:
  - Central repository for MCQs with 4 options, correct answer index, explanation, code snippet, marks, and topic.
  - 3-tier difficulty categorization (Easy, Medium, Hard).
  - Reusable question linking to quizzes via `quiz_questions` junction table.
  - Atomic question and answer key creation/update via `admin_save_question` RPC with direct table fallback.
  - **Bulk CSV Import System**:
    - "Import Questions (CSV)" button with modal interface.
    - Full client-side CSV parsing supporting all 11 required columns (`question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option_index`, `explanation`, `marks`, `difficulty`, `topic`, `subject_name`).
    - Subject dropdown mapping with auto-resolution by subject name/code and fallback support.
    - Optional quiz assignment or standalone question-bank save (`quiz_id = null`).
    - Pre-import validation engine: missing fields, option count, `correct_option_index` (0-3 or A-D), difficulty (`easy`, `medium`, `hard`), and marks.
    - Duplicate detection (both intra-file and against existing Question Bank items) with skip toggle.
    - Live CSV preview table with row status, error tabs, and downloadable sample CSV template.
    - Sequential import via `admin_save_question` RPC with progress bar, success/failure tally, and exact row error reporting. Zero direct table inserts into `question_answer_keys`.
- [x] **Student Roster & Logs (`src/components/admin/StudentManagement.jsx`)**:
  - Overview of all student profiles, college representation, branch, semester, lifetime scores, and attempt counts.
  - Search by name, college, or branch with sorting options.

---

## 3. Database Migration Architecture

### Staged Migration File: `supabase/migrations/20261116_phase2_admin_and_difficulty.sql`
- **Deployment Status**: 🚀 **READY FOR DEPLOYMENT** (Zero syntax errors, full transactional wrapping, RLS hardened, NULL-safe comparisons, zero remote modifications pending approval)
- **Rollback File**: `supabase/migrations/20261116_phase2_rollback.sql` (Non-destructive timestamped archive snapshots, INTEGER column types restoration, question preservation, exact Phase 1 RLS restoration, trigger-safe data normalization without top-level PERFORM)
- **Grading & Scoring Security**: Unforgeable dual-factor verification (`is_trusted_grading_context` inspecting engine call stack `PG_CONTEXT` + dynamic transaction nonce) across both `quiz_attempts` and `profiles` score accumulation triggers, blocking all direct REST score/privilege tampering while permitting legitimate quiz grading.
- **Defense in Depth**: Direct table privileges on `question_answer_keys` revoked from `authenticated` and `anon`; authoring strictly mediated via `admin_save_question()` RPC.
- **Question Bank Mapping**: Intelligent unlinking in `admin_remove_question_from_quiz()` automatically unlinks direct-only questions from `questions.quiz_id` while preserving dual-origin and manual-only Question Bank assignments.
- **NULL Safety**: All trigger guard comparisons use `IS DISTINCT FROM` instead of `!=` to prevent NULL-bypass attacks across both migration and rollback.
- **Pre-Deployment Audit**: 5 findings resolved (Critical profile score trigger, High rollback deadlock, Medium direct unlinking, Low answer-key table grant, Critical top-level PERFORM syntax error). Phase 1 deployed baseline left pristine.

### Exact Deployment Steps (When Approved):
1. **Apply Phase 2 Migration**: In Supabase Dashboard > SQL Editor, run `supabase/migrations/20261116_phase2_admin_and_difficulty.sql`.
2. **Verify Schema**: Confirm `quiz_questions` junction table, difficulty columns, and `is_trusted_grading_context` function exist.
3. **Seed Controlled QA Dataset**: Insert the 10 verified C++ questions into the database.
4. **Execute End-to-End Tests**: Run Feature 2 & 3 student quiz runner, negative marking, and server-side grading tests.

### Key Database Changes:
1. **Schema Enhancements**:
   - `public.subjects`: Adds `semester`, `branch`, `is_active`.
   - `public.quizzes`: Adds `semester`, `branch`, `negative_marks NUMERIC(4, 2)`, `max_attempts INTEGER`.
   - `public.questions`: Relaxes `quiz_id` NOT NULL constraint to allow standalone questions, adds `subject_id`, `topic`, and `difficulty CHECK (difficulty IN ('easy', 'medium', 'hard'))`.
   - `public.quiz_questions`: Junction table `(quiz_id, question_id, order_index, is_direct, is_manual)` for many-to-many question reusability with independent origin tracking.
   - `public.quiz_attempts`: Adds `selected_difficulty CHECK (selected_difficulty IN ('easy', 'medium', 'hard'))`, decimal negative scoring support.
2. **Server-Side Procedures (SECURITY DEFINER, `search_path = public, auth`)**:
   - `public.start_quiz_attempt(p_quiz_id UUID, p_difficulty TEXT)`: Validates difficulty strictly, enforces `max_attempts` server-side with concurrency-safe row locking.
   - `public.submit_quiz_attempt(p_attempt_id UUID, p_answers JSONB)`: Strictly validates that every submitted question matches the attempt's `selected_difficulty`, deducts negative marks for incorrect answers, calculates exact accuracy, and updates student points.
   - `public.admin_save_question(...)`: Atomically validates and synchronizes 4 options, correct option index (0-3), positive marks, and `question_answer_keys`.
   - `public.admin_assign_question_to_quiz(...)`: Junction mapping insert/update.
   - `public.admin_remove_question_from_quiz(...)`: Junction mapping delete.
3. **Row Level Security (RLS)**:
   - `question_answer_keys`: Completely restricted to administrators (`public.is_admin()`).
   - `quizzes`, `subjects`, `questions`, `quiz_questions`: `SELECT` allowed for active/published items, full mutation permissions strictly restricted to admins.

---

## 4. End-to-End QA Testing & Verification Log

### Feature 1: Admin Authentication, Access Control & Route Protection
- **Status**: ✅ PASS / VERIFIED
- **Completed Work**:
  - Hardened protected routing in `src/App.jsx` for `#admin` and `#dashboard` routes.
  - Added session restoration loading state in `App.jsx` during async Supabase session resolution to prevent unauthorized UI flash.
  - Fixed page refresh bug where active admin sessions on `#admin` were involuntarily redirected to `#dashboard`.
  - Enforced unauthenticated redirect: visiting `#admin` or `#dashboard` without an active session automatically resets URL hash to `#home` and opens the Login modal.
  - Verified role-based UI gating in `Navbar.jsx`, `DashboardHeader.jsx`, and `DashboardSidebar.jsx` (Admin Console links only appear if `profile.is_admin === true`).
  - Verified `AdminPanel.jsx` security guard renders "Access Denied" barrier with redirection options for non-admin students.
- **Actual Test Results (Live Supabase Evaluation)**:
  - Test 1 (Anonymous `profiles` access): **PASS** (Blocked by RLS: `permission denied for table profiles`)
  - Test 2 (Anonymous `quiz_attempts` access): **PASS** (Blocked by RLS: `permission denied for table quiz_attempts`)
  - Test 3 (Student authentication): **PASS** (Authenticated as `teststudent_1794778007640@gmail.com`)
  - Test 4 (Role detection from Supabase): **PASS** (Correctly identified as standard student, `is_admin: false`)
  - Test 5 (Privilege escalation prevention): **PASS** (Direct update `is_admin = true` blocked: `permission denied for table profiles`)
  - Test 6 (Answer key data privacy): **PASS** (Direct SELECT on `question_answer_keys` blocked: `permission denied for table question_answer_keys`)
  - Test 7 (Unauthorized quiz creation): **PASS** (Direct INSERT on `quizzes` blocked: `permission denied for table quizzes`)
  - Test 8 (Logout & session termination): **PASS** (Session invalidated cleanly)
  - Code Quality: `npm run lint` (0 errors, 0 warnings), `npm run build` (Clean production bundle build)
- **Bugs Fixed**:
  - `src/App.jsx`: Fixed route collision on page refresh where an admin refreshing on `#admin` was forcefully kicked to `#dashboard`.
  - `src/App.jsx`: Fixed unauthenticated `#admin` URL navigation to cleanly redirect hash to `#home` and prompt login.
  - `src/App.jsx`: Resolved ESLint `react-hooks/set-state-in-effect` rule compliance.
- **Remaining Issues**:
  - Phase 2 database migration (`supabase/migrations/20261116_phase2_admin_and_difficulty.sql`) remains staged locally and has NOT been executed on the remote Supabase database, per user instructions. Admin mutation operations on curriculum/quiz tables remain blocked by Phase 1 RLS until migration approval.
- **Exact Next Task**:
  - Proceed with Feature 2 testing (Available Quizzes & Quiz Runner).

### Feature 2: Available Quizzes & Quiz Runner (Student Flow)
- **Status**: ⚠️ BLOCKED (Database Empty: 0 published quizzes, 0 questions in remote Supabase instance)
- **Completed Work**:
  - Validated student query pipeline for published quizzes (`public.quizzes` with `is_published = true`) in `Dashboard.jsx`, `QuizzesTab.jsx`, and `OverviewTab.jsx`.
  - Hardened `QuizRunnerModal.jsx` question loading query with fallback mechanism: queries with `difficulty` column first (Phase 2), and automatically falls back to base columns (`id, quiz_id, question_text, question_type, code_snippet, options, marks, order_index`) when running against Phase 1 schema where `difficulty` column does not exist.
  - Implemented `sessionStorage` caching in `QuizRunnerModal.jsx` for student answers (`brainvash_answers_<quizId>`) and flagged questions (`brainvash_marked_<quizId>`) ensuring responses survive unexpected browser refreshes during an ongoing quiz, with clean cache invalidation on submission or modal exit.
  - Verified pre-quiz `DifficultySelectionModal.jsx` tier presentation (Easy, Medium, Hard) and parameter wiring to the runner.
  - Verified question runner UI controls: Previous/Next question navigation, option selection radio buttons, "Clear Response" button, "Mark for Review" flag toggle, 60s timer countdown, and the submission summary confirmation modal.
- **Actual Test Results (Live Supabase Evaluation)**:
  - Check 1 (Fetch published quizzes): **SUCCESS (0 rows returned)** — Query executed without errors; correctly returns empty array `[]`.
  - Check 2 (Total quizzes in database): **0 rows** (No published or draft quizzes exist in remote DB).
  - Check 3 (Total questions in database): **0 rows** (No questions exist in remote DB).
  - Check 4 (Total subjects in database): **0 rows** (No curriculum subjects exist in remote DB).
  - Check 5 (RPC `start_quiz_attempt` on unpublished/missing quiz): **PASS** (Correctly rejects with `Quiz not found or is currently unpublished.`).
  - Check 6 (RPC `start_quiz_attempt` signature detection): **PASS** (Detects that remote DB currently has 1-arg signature; runner fallback gracefully handles 1-arg).
  - Code Quality: `npm run lint` (0 errors, 0 warnings), `npm run build` (Clean production bundle build, 647.32 KB JS, 61.96 KB CSS).
- **Bugs Fixed**:
  - `src/components/dashboard/QuizRunnerModal.jsx`: Fixed crash where fetching questions directly by `quiz_id` unconditionally included the `difficulty` column in `.select()`, which caused Supabase to reject the query with `column questions.difficulty does not exist` on the Phase 1 schema. Added graceful fallback to base columns.
  - `src/components/dashboard/QuizRunnerModal.jsx`: Added `sessionStorage` answer and review-flag caching to safeguard students against accidental page reload during assessments.
- **Remaining Issues / Blockers**:
  - None within code or migration definitions. Phase 2 migration and rollback scripts are finalized, audited, and verified (timeout grading authorization, INTEGER column types restoration, question preservation, non-destructive timestamped archive backups, exact Phase 1 RLS restoration, transaction wrapping, advisory locking, NULL-safe guards, trigger restoration, empty question prevention, pre-migration duplicate check, exact 11-argument function permissions).
  - Status: **READY FOR DEPLOYMENT**. Awaiting user execution/approval.
  - End-to-end quiz runner and grading tests are held until the migration is applied and the controlled QA dataset is seeded.
- **Exact Next Task**:
  - Deploy finalized Phase 2 migration (`supabase/migrations/20261116_phase2_admin_and_difficulty.sql`) via Supabase SQL Editor upon user approval.
  - Verify remote schema and seed the controlled 10-question C++ QA dataset.
  - Execute live Feature 2 & 3 student quiz runner and server-side grading tests.
