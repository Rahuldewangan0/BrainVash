-- ==============================================================================
-- BrainVash Phase 2 Migration: Production Admin Panel, Question Bank & Difficulty
-- Migration File: supabase/migrations/20261116_phase2_admin_and_difficulty.sql
-- ==============================================================================

BEGIN;

-- 1. ENHANCE SUBJECTS TABLE (For semester, branch, and active status controls)
ALTER TABLE public.subjects 
    ADD COLUMN IF NOT EXISTS semester INTEGER CHECK (semester BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS branch TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_subjects_semester ON public.subjects (semester);
CREATE INDEX IF NOT EXISTS idx_subjects_is_active ON public.subjects (is_active);

-- 2. ENHANCE QUIZZES TABLE (For semester, branch, negative marking & attempt limits)
ALTER TABLE public.quizzes
    ADD COLUMN IF NOT EXISTS semester INTEGER CHECK (semester BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS branch TEXT,
    ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(4, 2) NOT NULL DEFAULT 0.00 CHECK (negative_marks >= 0.00),
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1);

CREATE INDEX IF NOT EXISTS idx_quizzes_semester ON public.quizzes (semester);

-- 3. ENHANCE QUESTIONS FOR REUSABLE QUESTION BANK & DIFFICULTY
-- Relax NOT NULL on quiz_id to support standalone question bank authoring
ALTER TABLE public.questions 
    ALTER COLUMN quiz_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS topic TEXT,
    ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard'));

CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions (difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions (subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions (topic);

-- 4. REUSABLE QUESTION BANK MAPPING (JUNCTION TABLE FOR MANY-TO-MANY QUIZ QUESTIONS)
-- Two independent origin flags:
-- 1. is_direct: Question is mapped via questions.quiz_id (direct legacy/primary link)
-- 2. is_manual: Question is intentionally mapped via the Question Bank (many-to-many link)
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_direct BOOLEAN NOT NULL DEFAULT FALSE,
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (quiz_id, question_id)
);

-- Safely add both columns if quiz_questions already exists
ALTER TABLE public.quiz_questions
    ADD COLUMN IF NOT EXISTS is_direct BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- For existing mappings, accurately classify origins based on questions.quiz_id:
-- 1. Any mapping matching questions.quiz_id is a direct assignment
UPDATE public.quiz_questions qq
SET is_direct = TRUE
FROM public.questions q
WHERE q.id = qq.question_id AND q.quiz_id = qq.quiz_id;

-- 2. Any mapping NOT matching questions.quiz_id is an intentional manual Question Bank assignment
UPDATE public.quiz_questions qq
SET is_manual = TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = qq.question_id AND q.quiz_id = qq.quiz_id
);

-- 3. In the rare case of any remaining unflagged rows, default safely to manual
UPDATE public.quiz_questions
SET is_manual = TRUE
WHERE is_direct = FALSE AND is_manual = FALSE;

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON public.quiz_questions (question_id);

-- Backfill quiz_questions from existing questions that have a quiz_id assigned.
-- Sets is_direct = TRUE while preserving any existing is_manual value.
INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, is_direct, is_manual)
SELECT quiz_id, id, order_index, TRUE, FALSE
FROM public.questions
WHERE quiz_id IS NOT NULL
ON CONFLICT (quiz_id, question_id) DO UPDATE
SET is_direct = TRUE;

-- 5. ENHANCE QUIZ ATTEMPTS & STUDENT ANSWERS FOR DIFFICULTY & NEGATIVE MARKING
ALTER TABLE public.quiz_attempts
    ADD COLUMN IF NOT EXISTS selected_difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (selected_difficulty IN ('easy', 'medium', 'hard'));

-- Support decimal negative scoring and precise accuracy calculation
ALTER TABLE public.quiz_attempts
    ALTER COLUMN score TYPE NUMERIC(8, 2),
    ALTER COLUMN total_marks TYPE NUMERIC(8, 2);

ALTER TABLE public.student_answers
    ALTER COLUMN marks_awarded TYPE NUMERIC(6, 2);

-- Drop old check constraint on student_answers that prevented negative marks
ALTER TABLE public.student_answers
    DROP CONSTRAINT IF EXISTS student_answers_marks_awarded_check;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_difficulty ON public.quiz_attempts (selected_difficulty);

-- Pre-migration check: verify no duplicate in-progress attempts exist before creating the unique index.
-- Does NOT delete or modify existing records automatically.
DO $$
DECLARE
    v_dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT user_id, quiz_id
        FROM public.quiz_attempts
        WHERE status = 'in_progress'
        GROUP BY user_id, quiz_id
        HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'Pre-migration check failed: Found % student-quiz pair(s) with duplicate active in-progress attempts. Resolve duplicates manually before creating idx_quiz_attempts_active_unique.', v_dup_count;
    END IF;
END $$;

-- Enforce at most one active attempt per student per quiz at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_active_unique 
    ON public.quiz_attempts (user_id, quiz_id) 
    WHERE status = 'in_progress';

-- 6. IMMUTABILITY TRIGGER ON QUIZ ATTEMPTS
-- Protects selected_difficulty, quiz_id, user_id, started_at and result fields from student tampering.
-- Uses NULL-safe IS DISTINCT FROM comparisons.
-- Trusted server-side grading procedures use transaction-local 'app.trusted_grading_token' for result finalization.
CREATE OR REPLACE FUNCTION public.guard_quiz_attempt_update()
RETURNS TRIGGER AS $$
DECLARE
    v_is_trusted_grading BOOLEAN;
BEGIN
    v_is_trusted_grading :=
    NULLIF(current_setting('app.trusted_grading_token', true), '') IS NOT NULL;

    -- Administrators and the trusted server-side grading procedure bypass these guards
    IF NOT (public.is_admin() OR v_is_trusted_grading) THEN
        -- 1. Immutable creation fields cannot be altered by students (NULL-safe comparison)
        IF NEW.quiz_id IS DISTINCT FROM OLD.quiz_id OR
           NEW.user_id IS DISTINCT FROM OLD.user_id OR
           NEW.started_at IS DISTINCT FROM OLD.started_at OR
           NEW.selected_difficulty IS DISTINCT FROM OLD.selected_difficulty THEN
            RAISE EXCEPTION 'Security Violation: Immutable fields (quiz_id, user_id, started_at, selected_difficulty) cannot be modified.';
        END IF;

        -- 2. Result fields cannot be altered directly via API by students (NULL-safe comparison)
        IF NEW.score IS DISTINCT FROM OLD.score OR
           NEW.total_marks IS DISTINCT FROM OLD.total_marks OR
           NEW.accuracy_percentage IS DISTINCT FROM OLD.accuracy_percentage OR
           NEW.completed_at IS DISTINCT FROM OLD.completed_at OR
           NEW.time_taken_seconds IS DISTINCT FROM OLD.time_taken_seconds OR
           (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
            RAISE EXCEPTION 'Access Denied: Quiz results can only be recorded via the server-side grading procedure.';
        END IF;

        -- 3. Direct student status updates can only transition to 'abandoned'
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

-- 7. CLEAN UP AMBIGUOUS OVERLOADS AND DEFINE SECURE start_quiz_attempt
-- Explicitly drop previous function signatures to prevent insecure legacy calls
DROP FUNCTION IF EXISTS public.start_quiz_attempt(UUID);
DROP FUNCTION IF EXISTS public.start_quiz_attempt(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(
    p_quiz_id UUID,
    p_difficulty TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_quiz public.quizzes%ROWTYPE;
    v_existing_id UUID;
    v_existing_diff TEXT;
    v_attempt_id UUID;
    v_diff TEXT;
    v_completed_attempts_count INTEGER;
    v_matching_question_count INTEGER;
BEGIN
    -- 1. Caller must be authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Validate difficulty strictly (no fallback bypass)
    IF p_difficulty IS NULL THEN
        RAISE EXCEPTION 'Validation Error: You must select a difficulty level (easy, medium, hard).';
    END IF;

    v_diff := LOWER(TRIM(p_difficulty));
    IF v_diff NOT IN ('easy', 'medium', 'hard') THEN
        RAISE EXCEPTION 'Validation Error: Invalid difficulty level (%). Must be easy, medium, or hard.', p_difficulty;
    END IF;

    -- 3. Verify quiz exists and is published (or caller is admin)
    SELECT * INTO v_quiz
    FROM public.quizzes
    WHERE id = p_quiz_id AND (is_published = TRUE OR public.is_admin());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz not found or is currently unpublished.';
    END IF;

    -- 4. Serialized Concurrency Guard: Advisory transaction lock per student and quiz
    -- Prevents concurrent requests from spawning duplicate active attempts or bypassing max_attempts
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_quiz_id::text));

    -- 5. Check for an active in_progress attempt
    SELECT id, selected_difficulty INTO v_existing_id, v_existing_diff
    FROM public.quiz_attempts
    WHERE quiz_id = p_quiz_id 
      AND user_id = auth.uid() 
      AND status = 'in_progress';

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'attempt_id', v_existing_id,
            'quiz_id', p_quiz_id,
            'selected_difficulty', v_existing_diff,
            'status', 'in_progress',
            'resumed', true
        );
    END IF;

    -- 6. Enforce max_attempts server-side
    SELECT COUNT(*) INTO v_completed_attempts_count
    FROM public.quiz_attempts
    WHERE quiz_id = p_quiz_id 
      AND user_id = auth.uid() 
      AND status IN ('completed', 'abandoned');

    IF v_completed_attempts_count >= v_quiz.max_attempts AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Maximum attempt limit (%) reached for this quiz.', v_quiz.max_attempts;
    END IF;

    -- 7. Empty Question Set Prevention: Ensure at least one question exists for this difficulty
    SELECT COUNT(*) INTO v_matching_question_count
    FROM public.questions q
    WHERE (
        EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = p_quiz_id AND qq.question_id = q.id)
        OR q.quiz_id = p_quiz_id
    )
    AND q.difficulty = v_diff;

    IF v_matching_question_count = 0 THEN
        RAISE EXCEPTION 'Cannot start assessment: No questions are currently configured for % difficulty in this quiz.', p_difficulty;
    END IF;

    -- 8. Insert new attempt with selected difficulty
    INSERT INTO public.quiz_attempts (quiz_id, user_id, status, selected_difficulty)
    VALUES (p_quiz_id, auth.uid(), 'in_progress', v_diff)
    RETURNING id INTO v_attempt_id;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt_id,
        'quiz_id', p_quiz_id,
        'selected_difficulty', v_diff,
        'status', 'in_progress',
        'resumed', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.start_quiz_attempt(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(UUID, TEXT) TO authenticated;

-- 8. REVISE submit_quiz_attempt: STRICT DIFFICULTY MATCHING & NEGATIVE MARKING
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
    v_attempt_diff TEXT;
    v_grading_token TEXT;
    v_started_at TIMESTAMPTZ;
    v_time_limit_minutes INTEGER;
    v_negative_marks NUMERIC(4, 2);
    v_is_published BOOLEAN;
    v_server_elapsed_seconds INTEGER;
    v_max_allowed_seconds INTEGER;
    v_expected_question_count INTEGER;
    v_submitted_question_count INTEGER;
    v_item JSONB;
    v_question_id UUID;
    v_selected_index INTEGER;
    v_correct_index INTEGER;
    v_marks NUMERIC(6, 2);
    v_q_diff TEXT;

    v_options JSONB;
    v_total_score NUMERIC(8, 2) := 0.00;
    v_total_marks NUMERIC(8, 2) := 0.00;
    v_is_correct BOOLEAN;
    v_correct_answers_count INTEGER := 0;
    v_accuracy NUMERIC(5, 2) := 0.00;
    v_marks_awarded NUMERIC(6, 2);
    v_seen_questions UUID[] := ARRAY[]::UUID[];
    
BEGIN
    -- 1. Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit quiz attempt.';
    END IF;

    -- 2. Lock attempt row against concurrent submissions
    SELECT a.user_id, a.quiz_id, a.status, a.started_at, a.selected_difficulty,
           q.time_limit_minutes, q.negative_marks, q.is_published
    INTO v_user_id, v_quiz_id, v_attempt_status, v_attempt_diff, v_started_at,
         v_time_limit_minutes, v_negative_marks, v_is_published
    FROM public.quiz_attempts a
    JOIN public.quizzes q ON q.id = a.quiz_id
    WHERE a.id = p_attempt_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Quiz attempt does not exist.';
    END IF;

    -- 3. Verify ownership
    IF v_user_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only submit your own quiz attempt.';
    END IF;

    -- 4. Verify attempt is still in progress
    IF v_attempt_status != 'in_progress' THEN
        RAISE EXCEPTION 'Quiz attempt is already closed (Status: %).', v_attempt_status;
    END IF;

    -- 5. Verify quiz is published
    IF NOT v_is_published AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Quiz is currently unpublished. Submission rejected.';
    END IF;

    -- 6. Enforce server-side timing
    v_server_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;
    v_max_allowed_seconds := (v_time_limit_minutes * 60) + 120;

    IF v_server_elapsed_seconds > v_max_allowed_seconds THEN
        -- Authorize updating time_taken_seconds, completed_at, and status via trusted procedure context
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
            'error', 'time_limit_exceeded',
            'message', 'Quiz allotted time has expired. Attempt closed.'
        );
    END IF;

    -- 7. Validate answers payload is a non-null JSON array
    IF p_answers IS NULL OR jsonb_typeof(p_answers) != 'array' THEN
        RAISE EXCEPTION 'Answers must be provided as a non-null JSON array.';
    END IF;

    v_submitted_question_count := jsonb_array_length(p_answers);

    -- 8. Verify expected question count for this difficulty tier
    SELECT COUNT(*) INTO v_expected_question_count
    FROM public.questions q
    WHERE (
        EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = v_quiz_id AND qq.question_id = q.id)
        OR q.quiz_id = v_quiz_id
    )
    AND q.difficulty = v_attempt_diff;

    IF v_expected_question_count = 0 THEN
        RAISE EXCEPTION 'Cannot submit quiz attempt: No questions are configured for % difficulty in this quiz.', v_attempt_diff;
    END IF;

    IF v_submitted_question_count != v_expected_question_count THEN
        RAISE EXCEPTION 'Invalid submission: Expected % answers for % difficulty, but received %.',
            v_expected_question_count, v_attempt_diff, v_submitted_question_count;
    END IF;

    -- 9. Grade each answer against canonical question_answer_keys with strict difficulty enforcement
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        v_question_id := (v_item->>'question_id')::UUID;
        v_selected_index := (v_item->>'selected_option_index')::INTEGER;

        IF v_question_id IS NULL THEN
            RAISE EXCEPTION 'Malformed answer entry: missing question_id.';
        END IF;

        IF v_question_id = ANY(v_seen_questions) THEN
            RAISE EXCEPTION 'Duplicate question submission detected for ID: %.', v_question_id;
        END IF;
        v_seen_questions := array_append(v_seen_questions, v_question_id);

        -- Fetch question and answer key, verifying assignment to this quiz
        SELECT q.marks, q.options, q.difficulty, k.correct_option_index
        INTO v_marks, v_options, v_q_diff, v_correct_index
        FROM public.questions q
        JOIN public.question_answer_keys k ON k.question_id = q.id
        WHERE q.id = v_question_id
          AND (
            EXISTS (SELECT 1 FROM public.quiz_questions qq WHERE qq.quiz_id = v_quiz_id AND qq.question_id = q.id)
            OR q.quiz_id = v_quiz_id
          );

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Security Violation: Question % does not belong to quiz %.', v_question_id, v_quiz_id;
        END IF;

        -- 1. STRICT DIFFICULTY VALIDATION: Enforce that every submitted question matches attempt difficulty
        IF v_q_diff != v_attempt_diff THEN
            RAISE EXCEPTION 'Security Violation: Question % difficulty (%) does not match attempt selected difficulty (%).',
                v_question_id, v_q_diff, v_attempt_diff;
        END IF;

        IF v_selected_index IS NOT NULL THEN
            IF v_selected_index < 0 OR v_selected_index >= jsonb_array_length(v_options) THEN
                RAISE EXCEPTION 'Option index % is out of bounds for question %.', v_selected_index, v_question_id;
            END IF;
        END IF;

        v_total_marks := v_total_marks + v_marks;
        v_is_correct := (v_selected_index IS NOT NULL AND v_selected_index = v_correct_index);

        -- 3. NEGATIVE MARKING LOGIC
        IF v_is_correct THEN
            v_correct_answers_count := v_correct_answers_count + 1;
            v_marks_awarded := v_marks;
            v_total_score := v_total_score + v_marks;
        ELSIF v_selected_index IS NOT NULL THEN
            -- Incorrect answer: apply negative marking deduction
            v_marks_awarded := -COALESCE(v_negative_marks, 0.00);
            v_total_score := v_total_score - COALESCE(v_negative_marks, 0.00);
        ELSE
            -- Unanswered question: 0 marks awarded, no deduction
            v_marks_awarded := 0.00;
        END IF;

        INSERT INTO public.student_answers (
            attempt_id,
            question_id,
            selected_option_index,
            is_correct,
            marks_awarded,
            time_spent_seconds
        )
        VALUES (
            p_attempt_id,
            v_question_id,
            v_selected_index,
            v_is_correct,
            v_marks_awarded,
            GREATEST(0, COALESCE((v_item->>'time_spent_seconds')::INTEGER, 0))
        )
        ON CONFLICT (attempt_id, question_id) DO UPDATE
        SET selected_option_index = EXCLUDED.selected_option_index,
            is_correct = EXCLUDED.is_correct,
            marks_awarded = EXCLUDED.marks_awarded,
            time_spent_seconds = EXCLUDED.time_spent_seconds;
    END LOOP;

    -- Ensure total score never drops below 0
    v_total_score := GREATEST(0.00, v_total_score);

    -- Calculate true accuracy percentage: (correct_answers / total_questions) * 100
    IF v_submitted_question_count > 0 THEN
        v_accuracy := ROUND((v_correct_answers_count::NUMERIC / v_submitted_question_count::NUMERIC) * 100.0, 2);
    END IF;

    -- 10. Authorize trusted grading for both attempt and profile updates.
    v_grading_token := encode(gen_random_bytes(16), 'hex');
    PERFORM set_config('app.trusted_grading_token', v_grading_token, true);

    UPDATE public.quiz_attempts
    SET status = 'completed',
        score = v_total_score,
        total_marks = v_total_marks,
        accuracy_percentage = v_accuracy,
        time_taken_seconds = GREATEST(1, v_server_elapsed_seconds),
        completed_at = NOW()
    WHERE id = p_attempt_id;

    -- 11. Atomically increment student profile metrics
    UPDATE public.profiles
    SET total_score = total_score + ROUND(v_total_score)::INTEGER,
        weekly_score = weekly_score + ROUND(v_total_score)::INTEGER,
        quizzes_attempted = quizzes_attempted + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Clear trusted grading only after both updates have completed.
    PERFORM set_config('app.trusted_grading_token', '', true);

    RETURN jsonb_build_object(
        'attempt_id', p_attempt_id,
        'selected_difficulty', v_attempt_diff,
        'status', 'completed',
        'score', v_total_score,
        'total_marks', v_total_marks,
        'accuracy_percentage', v_accuracy,
        'correct_count', v_correct_answers_count,
        'total_questions', v_submitted_question_count,
        'time_taken_seconds', GREATEST(1, v_server_elapsed_seconds)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) TO authenticated;

-- 8.1. UPGRADE get_quiz_review: SUPPORT NUMERIC DECIMAL MARKS AWARDED
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
    marks_awarded NUMERIC(6, 2),
    explanation TEXT
) AS $$
DECLARE
    v_user_id UUID;
    v_status TEXT;
BEGIN
    -- Verify attempt exists
    SELECT user_id, status INTO v_user_id, v_status
    FROM public.quiz_attempts
    WHERE id = p_attempt_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Attempt not found.';
    END IF;

    -- Strict authorization check: Only the attempt owner or an administrator can review
    IF v_user_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only review your own attempts.';
    END IF;

    -- Anti-cheat barrier: Answer keys are NEVER revealed for attempts still in progress
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
        sa.marks_awarded,
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

-- 9. STRENGTHENED admin_save_question RPC
CREATE OR REPLACE FUNCTION public.admin_save_question(
    p_question_id UUID,
    p_quiz_id UUID,
    p_subject_id UUID,
    p_topic TEXT,
    p_difficulty TEXT,
    p_question_text TEXT,
    p_code_snippet TEXT,
    p_options JSONB,
    p_marks INTEGER,
    p_correct_option_index INTEGER,
    p_explanation TEXT
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_diff TEXT;
    v_i INTEGER;
    v_opt_val TEXT;
    v_old_quiz_id UUID;
BEGIN
    -- 1. Authorization: verify caller is an administrator
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can author or modify question bank items.';
    END IF;

    -- 2. Validate non-empty question statement
    IF p_question_text IS NULL OR char_length(trim(p_question_text)) = 0 THEN
        RAISE EXCEPTION 'Validation Error: Question statement cannot be empty.';
    END IF;

    -- 3. Validate options: non-null JSON array with exactly four non-empty strings
    IF p_options IS NULL OR jsonb_typeof(p_options) != 'array' THEN
        RAISE EXCEPTION 'Validation Error: Options must be a valid non-null JSON array.';
    END IF;

    IF jsonb_array_length(p_options) != 4 THEN
        RAISE EXCEPTION 'Validation Error: BrainVash MCQ questions require exactly four options (A, B, C, D). Received: %.', jsonb_array_length(p_options);
    END IF;

    FOR v_i IN 0..3 LOOP
        v_opt_val := trim(p_options->>v_i);
        IF v_opt_val IS NULL OR v_opt_val = '' THEN
            RAISE EXCEPTION 'Validation Error: Option % cannot be empty.', chr(65 + v_i);
        END IF;
    END LOOP;

    -- 4. Validate correct option index (0 = A, 1 = B, 2 = C, 3 = D)
    IF p_correct_option_index IS NULL OR p_correct_option_index < 0 OR p_correct_option_index > 3 THEN
        RAISE EXCEPTION 'Validation Error: Correct option index must be between 0 and 3. Received: %.', p_correct_option_index;
    END IF;

    -- 5. Validate positive marks
    IF p_marks IS NULL OR p_marks <= 0 THEN
        RAISE EXCEPTION 'Validation Error: Marks awarded must be a positive integer (greater than 0).';
    END IF;

    -- 6. Validate difficulty level
    v_diff := LOWER(TRIM(COALESCE(p_difficulty, 'medium')));
    IF v_diff NOT IN ('easy', 'medium', 'hard') THEN
        RAISE EXCEPTION 'Validation Error: Difficulty must be easy, medium, or hard. Received: %.', p_difficulty;
    END IF;

    -- 7. Validate foreign key relationships
    IF p_subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
        RAISE EXCEPTION 'Validation Error: Referenced subject % does not exist.', p_subject_id;
    END IF;

    IF p_quiz_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = p_quiz_id) THEN
        RAISE EXCEPTION 'Validation Error: Referenced quiz % does not exist.', p_quiz_id;
    END IF;

    -- 8. Verify question existence during updates
    IF p_question_id IS NOT NULL THEN
        SELECT quiz_id INTO v_old_quiz_id
        FROM public.questions
        WHERE id = p_question_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Not Found: Question with ID % does not exist.', p_question_id;
        END IF;

        -- Direct quiz reassignment handling:
        -- Clear only the old is_direct flag; delete the mapping only if is_manual is also false.
        IF v_old_quiz_id IS NOT NULL AND v_old_quiz_id IS DISTINCT FROM p_quiz_id THEN
            UPDATE public.quiz_questions
            SET is_direct = FALSE
            WHERE quiz_id = v_old_quiz_id AND question_id = p_question_id;

            DELETE FROM public.quiz_questions
            WHERE quiz_id = v_old_quiz_id 
              AND question_id = p_question_id 
              AND is_manual = FALSE 
              AND is_direct = FALSE;
        END IF;

        -- Update existing question
        UPDATE public.questions
        SET quiz_id = p_quiz_id,
            subject_id = p_subject_id,
            topic = NULLIF(trim(p_topic), ''),
            difficulty = v_diff,
            question_text = trim(p_question_text),
            code_snippet = NULLIF(trim(p_code_snippet), ''),
            options = p_options,
            marks = p_marks
        WHERE id = p_question_id;

        -- Update or insert answer key atomically
        INSERT INTO public.question_answer_keys (question_id, correct_option_index, explanation)
        VALUES (p_question_id, p_correct_option_index, NULLIF(trim(p_explanation), ''))
        ON CONFLICT (question_id) DO UPDATE
        SET correct_option_index = EXCLUDED.correct_option_index,
            explanation = EXCLUDED.explanation;

        v_id := p_question_id;
    ELSE
        -- Insert new question
        INSERT INTO public.questions (
            quiz_id,
            subject_id,
            topic,
            difficulty,
            question_text,
            code_snippet,
            options,
            marks
        )
        VALUES (
            p_quiz_id,
            p_subject_id,
            NULLIF(trim(p_topic), ''),
            v_diff,
            trim(p_question_text),
            NULLIF(trim(p_code_snippet), ''),
            p_options,
            p_marks
        )
        RETURNING id INTO v_id;

        -- Insert associated answer key atomically
        INSERT INTO public.question_answer_keys (question_id, correct_option_index, explanation)
        VALUES (v_id, p_correct_option_index, NULLIF(trim(p_explanation), ''));
    END IF;

    -- 9. If assigned to a quiz, maintain direct mapping in quiz_questions junction table
    -- Sets is_direct = TRUE without altering is_manual.
    IF p_quiz_id IS NOT NULL THEN
        INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, is_direct, is_manual)
        VALUES (p_quiz_id, v_id, 0, TRUE, FALSE)
        ON CONFLICT (quiz_id, question_id) DO UPDATE
        SET is_direct = TRUE;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.admin_save_question(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_question(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, INTEGER, INTEGER, TEXT) TO authenticated;

-- 10. REUSABLE QUESTION BANK ASSIGNMENT RPCs
CREATE OR REPLACE FUNCTION public.admin_assign_question_to_quiz(
    p_quiz_id UUID,
    p_question_id UUID,
    p_order_index INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can assign questions to quizzes.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = p_quiz_id) THEN
        RAISE EXCEPTION 'Quiz % not found.', p_quiz_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = p_question_id) THEN
        RAISE EXCEPTION 'Question % not found.', p_question_id;
    END IF;

    INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, is_direct, is_manual)
    VALUES (p_quiz_id, p_question_id, COALESCE(p_order_index, 0), FALSE, TRUE)
    ON CONFLICT (quiz_id, question_id) DO UPDATE
    SET order_index = EXCLUDED.order_index,
        is_manual = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.admin_assign_question_to_quiz(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_question_to_quiz(UUID, UUID, INTEGER) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_remove_question_from_quiz(UUID, UUID);
DROP FUNCTION IF EXISTS public.admin_remove_question_from_quiz(UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.admin_remove_question_from_quiz(
    p_quiz_id UUID,
    p_question_id UUID,
    p_remove_direct BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can remove questions from quizzes.';
    END IF;

    -- 1. Clear manual assignment flag, and optionally clear direct assignment if requested
    UPDATE public.quiz_questions
    SET is_manual = FALSE,
        is_direct = CASE WHEN p_remove_direct THEN FALSE ELSE is_direct END
    WHERE quiz_id = p_quiz_id AND question_id = p_question_id;

    -- 2. Delete the mapping row only when both flags are false
    DELETE FROM public.quiz_questions
    WHERE quiz_id = p_quiz_id 
      AND question_id = p_question_id 
      AND is_manual = FALSE 
      AND is_direct = FALSE;

    -- 3. Unlink questions.quiz_id only when the direct assignment is explicitly being removed
    IF p_remove_direct THEN
        UPDATE public.questions
        SET quiz_id = NULL
        WHERE id = p_question_id AND quiz_id = p_quiz_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.admin_remove_question_from_quiz(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_question_from_quiz(UUID, UUID, BOOLEAN) TO authenticated;

-- 11. GRANT TABLE LEVEL PERMISSIONS FOR AUTHENTICATED ROLE
-- Row Level Security (RLS) policies on these tables enforce public.is_admin()
GRANT INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.quiz_questions TO authenticated;
GRANT ALL ON public.question_answer_keys TO authenticated;

-- 12. ROW LEVEL SECURITY (RLS) POLICIES AUDIT & ENFORCEMENT

-- ── SUBJECTS RLS ──
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subjects_select_public" ON public.subjects;
DROP POLICY IF EXISTS "subjects_admin_all" ON public.subjects;

CREATE POLICY "subjects_select_public" ON public.subjects
    FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "subjects_admin_all" ON public.subjects
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── QUIZZES RLS ──
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quizzes_select_published" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_admin_all" ON public.quizzes;

CREATE POLICY "quizzes_select_published" ON public.quizzes
    FOR SELECT USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "quizzes_admin_all" ON public.quizzes
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── QUESTIONS RLS ──
-- Students can ONLY view questions that belong to published quizzes.
-- Admins can view and manage all questions, including unassigned items in the Question Bank.
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions_select_published" ON public.questions;
DROP POLICY IF EXISTS "questions_admin_all" ON public.questions;

CREATE POLICY "questions_select_published" ON public.questions
    FOR SELECT USING (
        public.is_admin() OR (
            EXISTS (
                SELECT 1 FROM public.quiz_questions qq
                JOIN public.quizzes q ON q.id = qq.quiz_id
                WHERE qq.question_id = questions.id AND q.is_published = TRUE
            )
            OR (
                quiz_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.quizzes q
                    WHERE q.id = questions.quiz_id AND q.is_published = TRUE
                )
            )
        )
    );

CREATE POLICY "questions_admin_all" ON public.questions
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── QUIZ QUESTIONS (JUNCTION TABLE) RLS ──
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz_questions_select_published" ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_admin_all" ON public.quiz_questions;

CREATE POLICY "quiz_questions_select_published" ON public.quiz_questions
    FOR SELECT USING (
        public.is_admin() OR EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_questions.quiz_id AND q.is_published = TRUE
        )
    );

CREATE POLICY "quiz_questions_admin_all" ON public.quiz_questions
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── QUESTION ANSWER KEYS RLS ──
-- Zero access for non-admin students. Fully restricted to administrators.
ALTER TABLE public.question_answer_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "answer_keys_admin_only" ON public.question_answer_keys;

CREATE POLICY "answer_keys_admin_only" ON public.question_answer_keys
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;
