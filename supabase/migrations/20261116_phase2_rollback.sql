-- ==============================================================================
-- BrainVash: Phase 2 Rollback & Disaster Recovery Script
-- Target Migration: supabase/migrations/20261116_phase2_admin_and_difficulty.sql
-- Status: Non-Destructive Reversion to Phase 1 Baseline with Data Archiving
--
-- CRITICAL DATA SAFETY NOTICE:
-- 1. Dropping Phase 2 columns (e.g. difficulty, topic, branch, semester, negative_marks)
--    from active tables permanently removes that metadata from the active schema.
-- 2. To PREVENT DATA LOSS, Step 0 creates standalone backup snapshot tables
--    (_backup_phase2_*) capturing every row, column, mapping, and decimal mark.
-- 3. Newly created standalone questions are NOT deleted. quiz_id remains nullable.
-- 4. Negative marks in active student_answers are clamped to 0 to satisfy Phase 1
--    constraints, but exact negative decimal marks are fully preserved in _backup_phase2_student_answers.
-- ==============================================================================

BEGIN;

-- 0. NON-DESTRUCTIVE ARCHIVED BACKUP SNAPSHOT
-- Safely archives any existing backup tables with an archive timestamp rather than dropping them destructively
DO $$
DECLARE
    v_ts TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD_HH24MISS');
    v_tbl RECORD;
BEGIN
    FOR v_tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
              '_backup_phase2_student_answers',
              '_backup_phase2_quiz_attempts',
              '_backup_phase2_quiz_questions',
              '_backup_phase2_questions',
              '_backup_phase2_quizzes',
              '_backup_phase2_subjects'
          )
    LOOP
        EXECUTE format('ALTER TABLE public.%I RENAME TO %I', v_tbl.tablename, v_tbl.tablename || '_archive_' || v_ts);
    END LOOP;
END $$;

CREATE TABLE public._backup_phase2_subjects AS 
    SELECT * FROM public.subjects;

CREATE TABLE public._backup_phase2_quizzes AS 
    SELECT * FROM public.quizzes;

CREATE TABLE public._backup_phase2_questions AS 
    SELECT * FROM public.questions;

CREATE TABLE public._backup_phase2_quiz_questions AS 
    SELECT * FROM public.quiz_questions;

CREATE TABLE public._backup_phase2_quiz_attempts AS 
    SELECT * FROM public.quiz_attempts;

CREATE TABLE public._backup_phase2_student_answers AS 
    SELECT * FROM public.student_answers;

-- Restrict backup tables to administrators only
ALTER TABLE public._backup_phase2_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_phase2_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_phase2_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_phase2_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_phase2_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_phase2_student_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_subjects_admin" ON public._backup_phase2_subjects FOR ALL USING (public.is_admin());
CREATE POLICY "backup_quizzes_admin" ON public._backup_phase2_quizzes FOR ALL USING (public.is_admin());
CREATE POLICY "backup_questions_admin" ON public._backup_phase2_questions FOR ALL USING (public.is_admin());
CREATE POLICY "backup_quiz_questions_admin" ON public._backup_phase2_quiz_questions FOR ALL USING (public.is_admin());
CREATE POLICY "backup_quiz_attempts_admin" ON public._backup_phase2_quiz_attempts FOR ALL USING (public.is_admin());
CREATE POLICY "backup_student_answers_admin" ON public._backup_phase2_student_answers FOR ALL USING (public.is_admin());

-- ==============================================================================
-- SAFE RECOVERY PROCEDURE (To restore Phase 2 data from backup snapshots if needed):
-- 1. Re-run Phase 2 migration: supabase/migrations/20261116_phase2_admin_and_difficulty.sql
-- 2. Restore questions metadata:
--    UPDATE public.questions q SET
--      difficulty = b.difficulty, topic = b.topic, subject_id = b.subject_id
--    FROM public._backup_phase2_questions b WHERE q.id = b.id;
-- 3. Restore quiz configurations:
--    UPDATE public.quizzes q SET
--      max_attempts = b.max_attempts, negative_marks = b.negative_marks,
--      branch = b.branch, semester = b.semester
--    FROM public._backup_phase2_quizzes b WHERE q.id = b.id;
-- 4. Restore attempt difficulty & decimal marks:
--    UPDATE public.quiz_attempts a SET
--      selected_difficulty = b.selected_difficulty, score = b.score, total_marks = b.total_marks
--    FROM public._backup_phase2_quiz_attempts b WHERE a.id = b.id;
--    UPDATE public.student_answers sa SET
--      marks_awarded = b.marks_awarded
--    FROM public._backup_phase2_student_answers b
--    WHERE sa.attempt_id = b.attempt_id AND sa.question_id = b.question_id;
-- 5. Restore junction mapping:
--    INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, is_direct, is_manual)
--    SELECT quiz_id, question_id, order_index, is_direct, is_manual
--    FROM public._backup_phase2_quiz_questions
--    ON CONFLICT (quiz_id, question_id) DO NOTHING;
-- ==============================================================================

-- 1. DROP PHASE 2 ADMIN RPCs AND HELPER FUNCTIONS
DROP FUNCTION IF EXISTS public.admin_remove_question_from_quiz(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_remove_question_from_quiz(UUID, UUID);
DROP FUNCTION IF EXISTS public.admin_assign_question_to_quiz(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.admin_save_question(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, INTEGER, TEXT);

-- Drop Phase 2 trusted grading context helper (does not exist in Phase 1)
DROP FUNCTION IF EXISTS public.is_trusted_grading_context();

-- 2. RESTORE PHASE 1 get_quiz_review (INTEGER MARKS)
DROP FUNCTION IF EXISTS public.get_quiz_review(UUID);

CREATE OR REPLACE FUNCTION public.get_quiz_review(p_attempt_id UUID)
RETURNS TABLE (
    question_id UUID,
    question_text TEXT,
    code_snippet TEXT,
    options JSONB,
    selected_option_index INTEGER,
    correct_option_index INTEGER,
    is_correct BOOLEAN,
    marks_awarded INTEGER,
    explanation TEXT
) AS $$
DECLARE
    v_user_id UUID;
    v_status TEXT;
BEGIN
    SELECT user_id, status INTO v_user_id, v_status
    FROM public.quiz_attempts
    WHERE id = p_attempt_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Attempt not found.';
    END IF;

    IF v_user_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only review your own attempts.';
    END IF;

    IF v_status != 'completed' THEN
        RAISE EXCEPTION 'Review is only available after completing the quiz.';
    END IF;

    RETURN QUERY
    SELECT
        q.id AS question_id,
        q.question_text,
        q.code_snippet,
        q.options,
        sa.selected_option_index,
        k.correct_option_index,
        sa.is_correct,
        ROUND(sa.marks_awarded)::INTEGER,
        k.explanation
    FROM public.student_answers sa
    JOIN public.questions q ON q.id = sa.question_id
    JOIN public.question_answer_keys k ON k.question_id = q.id
    WHERE sa.attempt_id = p_attempt_id
    ORDER BY q.order_index ASC, q.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.get_quiz_review(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_review(UUID) TO authenticated;

-- 3. RESTORE PHASE 1 submit_quiz_attempt (WITHOUT DIFFICULTY FILTER & NEGATIVE MARKING)
DROP FUNCTION IF EXISTS public.submit_quiz_attempt(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
    p_attempt_id UUID,
    p_answers JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_quiz_id UUID;
    v_attempt_status TEXT;
    v_started_at TIMESTAMPTZ;
    v_time_limit_minutes INTEGER;
    v_is_published BOOLEAN;
    v_server_elapsed_seconds INTEGER;
    v_max_allowed_seconds INTEGER;
    v_item JSONB;
    v_question_id UUID;
    v_selected_index INTEGER;
    v_correct_index INTEGER;
    v_marks INTEGER;
    v_options JSONB;
    v_total_score INTEGER := 0;
    v_total_marks INTEGER := 0;
    v_is_correct BOOLEAN;
    v_correct_answers_count INTEGER := 0;
    v_accuracy NUMERIC(5, 2) := 0.00;
    v_marks_awarded INTEGER;
    v_submitted_count INTEGER;
    v_seen_questions UUID[] := ARRAY[]::UUID[];
    v_grading_token TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT a.user_id, a.quiz_id, a.status, a.started_at,
           q.time_limit_minutes, q.is_published
    INTO v_user_id, v_quiz_id, v_attempt_status, v_started_at,
         v_time_limit_minutes, v_is_published
    FROM public.quiz_attempts a
    JOIN public.quizzes q ON q.id = a.quiz_id
    WHERE a.id = p_attempt_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Quiz attempt not found.';
    END IF;

    IF v_user_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    IF v_attempt_status != 'in_progress' THEN
        RAISE EXCEPTION 'Attempt is already closed.';
    END IF;

    IF NOT v_is_published AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Quiz is unpublished.';
    END IF;

    v_server_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;
    v_max_allowed_seconds := (v_time_limit_minutes * 60) + 120;

    IF v_server_elapsed_seconds > v_max_allowed_seconds THEN
        -- Authorize the server-side abandonment update using the Phase 1 trusted token.
        v_grading_token := encode(gen_random_bytes(16), 'hex');

        PERFORM set_config(
            'app.trusted_grading_token',
            v_grading_token,
            true
        );

        UPDATE public.quiz_attempts
        SET status = 'abandoned',
            time_taken_seconds = v_server_elapsed_seconds,
            completed_at = NOW()
        WHERE id = p_attempt_id;

        PERFORM set_config('app.trusted_grading_token', '', true);

        RETURN jsonb_build_object(
            'attempt_id', p_attempt_id,
            'status', 'abandoned',
            'error', 'time_limit_exceeded'
        );
    END IF;

    v_submitted_count := jsonb_array_length(p_answers);

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        v_question_id := (v_item->>'question_id')::UUID;
        v_selected_index := (v_item->>'selected_option_index')::INTEGER;

        IF v_question_id = ANY(v_seen_questions) THEN
            RAISE EXCEPTION 'Duplicate question.';
        END IF;
        v_seen_questions := array_append(v_seen_questions, v_question_id);

        SELECT q.marks, q.options, k.correct_option_index
        INTO v_marks, v_options, v_correct_index
        FROM public.questions q
        JOIN public.question_answer_keys k ON k.question_id = q.id
        WHERE q.id = v_question_id AND q.quiz_id = v_quiz_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Question does not belong to quiz.';
        END IF;

        v_total_marks := v_total_marks + v_marks;
        v_is_correct := (v_selected_index IS NOT NULL AND v_selected_index = v_correct_index);

        IF v_is_correct THEN
            v_correct_answers_count := v_correct_answers_count + 1;
            v_marks_awarded := v_marks;
            v_total_score := v_total_score + v_marks;
        ELSE
            v_marks_awarded := 0;
        END IF;

        INSERT INTO public.student_answers (attempt_id, question_id, selected_option_index, is_correct, marks_awarded, time_spent_seconds)
        VALUES (p_attempt_id, v_question_id, v_selected_index, v_is_correct, v_marks_awarded, GREATEST(0, COALESCE((v_item->>'time_spent_seconds')::INTEGER, 0)))
        ON CONFLICT (attempt_id, question_id) DO UPDATE
        SET selected_option_index = EXCLUDED.selected_option_index,
            is_correct = EXCLUDED.is_correct,
            marks_awarded = EXCLUDED.marks_awarded,
            time_spent_seconds = EXCLUDED.time_spent_seconds;
    END LOOP;

    IF v_submitted_count > 0 THEN
        v_accuracy := ROUND((v_correct_answers_count::NUMERIC / v_submitted_count::NUMERIC) * 100.0, 2);
    END IF;

    -- Authorize both result finalization and profile metric updates in this transaction.
    v_grading_token := encode(gen_random_bytes(16), 'hex');

    PERFORM set_config(
        'app.trusted_grading_token',
        v_grading_token,
        true
    );

    UPDATE public.quiz_attempts
    SET status = 'completed',
        score = v_total_score,
        total_marks = v_total_marks,
        accuracy_percentage = v_accuracy,
        time_taken_seconds = GREATEST(1, v_server_elapsed_seconds),
        completed_at = NOW()
    WHERE id = p_attempt_id;

    UPDATE public.profiles
    SET total_score = total_score + v_total_score,
        weekly_score = weekly_score + v_total_score,
        quizzes_attempted = quizzes_attempted + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Clear authorization only after both protected updates have completed.
    PERFORM set_config('app.trusted_grading_token', '', true);

    RETURN jsonb_build_object(
        'attempt_id', p_attempt_id,
        'status', 'completed',
        'score', v_total_score,
        'total_marks', v_total_marks,
        'accuracy_percentage', v_accuracy,
        'correct_count', v_correct_answers_count,
        'total_questions', v_submitted_count,
        'time_taken_seconds', GREATEST(1, v_server_elapsed_seconds)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) TO authenticated;

-- 4. RESTORE PHASE 1 start_quiz_attempt(UUID)
DROP FUNCTION IF EXISTS public.start_quiz_attempt(UUID, TEXT);
DROP FUNCTION IF EXISTS public.start_quiz_attempt(UUID);

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_quiz public.quizzes%ROWTYPE;
    v_existing_id UUID;
    v_attempt_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_quiz
    FROM public.quizzes
    WHERE id = p_quiz_id AND (is_published = TRUE OR public.is_admin());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz not found or is currently unpublished.';
    END IF;

    SELECT id INTO v_existing_id
    FROM public.quiz_attempts
    WHERE quiz_id = p_quiz_id AND user_id = auth.uid() AND status = 'in_progress'
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('attempt_id', v_existing_id, 'quiz_id', p_quiz_id, 'status', 'in_progress', 'resumed', true);
    END IF;

    INSERT INTO public.quiz_attempts (quiz_id, user_id, status)
    VALUES (p_quiz_id, auth.uid(), 'in_progress')
    RETURNING id INTO v_attempt_id;

    RETURN jsonb_build_object('attempt_id', v_attempt_id, 'quiz_id', p_quiz_id, 'status', 'in_progress', 'resumed', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.start_quiz_attempt(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(UUID) TO authenticated;

-- 5. REVERT RLS POLICIES TO EXACT PHASE 1 DEFINITIONS
-- ── SUBJECTS RLS ──
DROP POLICY IF EXISTS "subjects_select_public" ON public.subjects;
DROP POLICY IF EXISTS "subjects_admin_all" ON public.subjects;

CREATE POLICY "subjects_select_public" ON public.subjects
    FOR SELECT USING (true);
CREATE POLICY "subjects_admin_all" ON public.subjects
    FOR ALL USING (public.is_admin());

-- ── QUIZZES RLS ──
DROP POLICY IF EXISTS "quizzes_select_published" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_admin_all" ON public.quizzes;

CREATE POLICY "quizzes_select_published" ON public.quizzes
    FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "quizzes_admin_all" ON public.quizzes
    FOR ALL USING (public.is_admin());

-- ── QUESTIONS RLS ──
DROP POLICY IF EXISTS "questions_select_published" ON public.questions;
DROP POLICY IF EXISTS "questions_admin_all" ON public.questions;

CREATE POLICY "questions_select_published" ON public.questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = questions.quiz_id
              AND (q.is_published = true OR public.is_admin())
        )
    );
CREATE POLICY "questions_admin_all" ON public.questions
    FOR ALL USING (public.is_admin());

-- ── QUESTION ANSWER KEYS RLS ──
DROP POLICY IF EXISTS "answer_keys_admin_only" ON public.question_answer_keys;

CREATE POLICY "answer_keys_admin_only" ON public.question_answer_keys
    FOR ALL USING (public.is_admin());

-- ── QUIZ QUESTIONS (DROP PHASE 2 POLICIES) ──
DROP POLICY IF EXISTS "quiz_questions_select_published" ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_admin_all" ON public.quiz_questions;

-- 6. REVOKE PHASE 2 TABLE GRANTS
REVOKE INSERT, UPDATE, DELETE ON public.subjects FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.quizzes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.questions FROM authenticated;
REVOKE ALL ON public.question_answer_keys FROM authenticated;

-- 7. DROP JUNCTION TABLE
DROP TABLE IF EXISTS public.quiz_questions;

-- 8. REVERT COLUMNS ADDED IN PHASE 2 & RESTORE PHASE 1 IMMUTABILITY TRIGGER
DROP INDEX IF EXISTS public.idx_quiz_attempts_active_unique;

ALTER TABLE public.quiz_attempts DROP COLUMN IF EXISTS selected_difficulty;

-- Drop immutability and score tampering triggers before data normalization
-- to prevent spurious security exceptions during rollback maintenance
DROP TRIGGER IF EXISTS trg_guard_quiz_attempt_update ON public.quiz_attempts;
DROP TRIGGER IF EXISTS trg_prevent_profile_score_tampering ON public.profiles;

-- Restore Phase 1 column types: score, total_marks, marks_awarded
-- Round decimal scores to non-negative integers before altering column types
UPDATE public.student_answers 
SET marks_awarded = GREATEST(0, ROUND(marks_awarded)::INTEGER);

UPDATE public.quiz_attempts
SET score = GREATEST(0, ROUND(score)::INTEGER),
    total_marks = GREATEST(0, ROUND(total_marks)::INTEGER);

-- Restore original Phase 1 INTEGER types
ALTER TABLE public.student_answers
    ALTER COLUMN marks_awarded TYPE INTEGER USING GREATEST(0, ROUND(marks_awarded)::INTEGER);

ALTER TABLE public.quiz_attempts
    ALTER COLUMN score TYPE INTEGER USING GREATEST(0, ROUND(score)::INTEGER),
    ALTER COLUMN total_marks TYPE INTEGER USING GREATEST(0, ROUND(total_marks)::INTEGER);

-- Re-apply Phase 1 check constraints
ALTER TABLE public.student_answers
    DROP CONSTRAINT IF EXISTS student_answers_marks_awarded_check;
ALTER TABLE public.student_answers
    ADD CONSTRAINT student_answers_marks_awarded_check CHECK (marks_awarded >= 0);

ALTER TABLE public.quiz_attempts
    DROP CONSTRAINT IF EXISTS quiz_attempts_score_check,
    DROP CONSTRAINT IF EXISTS quiz_attempts_total_marks_check;
ALTER TABLE public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_score_check CHECK (score >= 0),
    ADD CONSTRAINT quiz_attempts_total_marks_check CHECK (total_marks >= 0);

-- Restore Phase 1 guard_quiz_attempt_update trigger with NULL-safe comparisons and trusted grading check
CREATE OR REPLACE FUNCTION public.guard_quiz_attempt_update()
RETURNS TRIGGER AS $$
DECLARE
    v_context TEXT;
    v_token TEXT;
    v_is_trusted BOOLEAN := FALSE;
BEGIN
    -- 1. Inspect engine execution call stack
    GET DIAGNOSTICS v_context = PG_CONTEXT;
    v_token := current_setting('app.trusted_grading_token', true);

    -- Allow trusted server-side grading
    IF (v_context LIKE '%submit_quiz_attempt%' AND NULLIF(v_token, '') IS NOT NULL) OR
       (session_user = 'postgres' AND v_token = 'phase2_rollback_maintenance') THEN
        v_is_trusted := TRUE;
    END IF;

    IF NOT (public.is_admin() OR v_is_trusted) THEN
        -- Immutable creation fields cannot be altered (NULL-safe comparison)
        IF NEW.quiz_id IS DISTINCT FROM OLD.quiz_id OR
           NEW.user_id IS DISTINCT FROM OLD.user_id OR
           NEW.started_at IS DISTINCT FROM OLD.started_at THEN
            RAISE EXCEPTION 'Security Violation: Immutable fields (quiz_id, user_id, started_at) cannot be modified.';
        END IF;

        -- Result fields cannot be altered directly (NULL-safe comparison)
        IF NEW.score IS DISTINCT FROM OLD.score OR
           NEW.total_marks IS DISTINCT FROM OLD.total_marks OR
           NEW.accuracy_percentage IS DISTINCT FROM OLD.accuracy_percentage OR
           NEW.completed_at IS DISTINCT FROM OLD.completed_at OR
           NEW.time_taken_seconds IS DISTINCT FROM OLD.time_taken_seconds OR
           (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
            RAISE EXCEPTION 'Access Denied: Quiz results can only be recorded via the server-side grading procedure.';
        END IF;

        -- Direct student status updates can only transition to 'abandoned'
        IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'abandoned' THEN
            RAISE EXCEPTION 'Invalid status transition: Only abandonment is permitted directly.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_quiz_attempt_update ON public.quiz_attempts;
CREATE TRIGGER trg_guard_quiz_attempt_update
    BEFORE UPDATE ON public.quiz_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_quiz_attempt_update();

-- Restore Profile Score Protection Trigger with trusted grading support and NULL-safe comparisons
CREATE OR REPLACE FUNCTION public.prevent_profile_score_tampering()
RETURNS TRIGGER AS $$
DECLARE
    v_context TEXT;
    v_token TEXT;
    v_is_trusted BOOLEAN := FALSE;
BEGIN
    GET DIAGNOSTICS v_context = PG_CONTEXT;
    v_token := current_setting('app.trusted_grading_token', true);

    IF v_context LIKE '%submit_quiz_attempt%' AND NULLIF(v_token, '') IS NOT NULL THEN
        v_is_trusted := TRUE;
    END IF;

    IF NOT (public.is_admin() OR v_is_trusted) THEN
        IF NEW.total_score IS DISTINCT FROM OLD.total_score OR
           NEW.weekly_score IS DISTINCT FROM OLD.weekly_score OR
           NEW.quizzes_attempted IS DISTINCT FROM OLD.quizzes_attempted OR
           NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'Access Denied: Direct modification of scores, rankings, or admin privileges is forbidden.';
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_score_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_profile_score_tampering
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_score_tampering();

-- Drop Phase 2 columns from questions while preserving standalone questions
ALTER TABLE public.questions 
    DROP COLUMN IF EXISTS difficulty,
    DROP COLUMN IF EXISTS topic,
    DROP COLUMN IF EXISTS subject_id;

-- QUESTION PRESERVATION NOTE ON questions.quiz_id:
-- In Phase 1, questions.quiz_id had a NOT NULL constraint.
-- In Phase 2, quiz_id was made nullable to support standalone Question Bank questions.
-- To preserve standalone questions without data loss or foreign key deletion,
-- questions.quiz_id intentionally remains nullable on rollback.

ALTER TABLE public.quizzes 
    DROP COLUMN IF EXISTS max_attempts,
    DROP COLUMN IF EXISTS negative_marks,
    DROP COLUMN IF EXISTS branch,
    DROP COLUMN IF EXISTS semester;

ALTER TABLE public.subjects 
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS branch,
    DROP COLUMN IF EXISTS semester;

COMMIT;
