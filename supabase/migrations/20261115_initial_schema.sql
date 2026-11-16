-- ==============================================================================
-- BrainVash — Hardened Production PostgreSQL Schema, Integrity Triggers & RLS
-- Migration: supabase/migrations/20261115_initial_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. COLLEGES (Master List)
CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    code TEXT UNIQUE,
    city TEXT NOT NULL CHECK (char_length(trim(city)) >= 2),
    state TEXT NOT NULL CHECK (char_length(trim(state)) >= 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colleges_name ON public.colleges (name);
CREATE INDEX IF NOT EXISTS idx_colleges_city ON public.colleges (city);

-- 3. PROFILES (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
    college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
    college_name TEXT,
    branch TEXT,
    semester INTEGER CHECK (semester BETWEEN 1 AND 12),
    avatar_url TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0),
    weekly_score INTEGER NOT NULL DEFAULT 0 CHECK (weekly_score >= 0),
    quizzes_attempted INTEGER NOT NULL DEFAULT 0 CHECK (quizzes_attempted >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_college_id ON public.profiles (college_id);
CREATE INDEX IF NOT EXISTS idx_profiles_total_score ON public.profiles (total_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_weekly_score ON public.profiles (weekly_score DESC);

-- 4. SUBJECTS (Categories & Curriculums)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    code TEXT,
    category TEXT NOT NULL CHECK (category IN ('programming', 'core_cs', 'college_syllabus', 'aptitude', 'contests')),
    icon TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_category ON public.subjects (category);

-- 5. QUIZZES
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    time_limit_minutes INTEGER NOT NULL DEFAULT 15 CHECK (time_limit_minutes BETWEEN 1 AND 180),
    total_questions INTEGER NOT NULL DEFAULT 15 CHECK (total_questions BETWEEN 1 AND 200),
    passing_score INTEGER NOT NULL DEFAULT 50 CHECK (passing_score BETWEEN 0 AND 100),
    is_daily_challenge BOOLEAN NOT NULL DEFAULT FALSE,
    daily_challenge_date DATE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON public.quizzes (subject_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_daily ON public.quizzes (is_daily_challenge, daily_challenge_date) WHERE is_daily_challenge = TRUE;
CREATE INDEX IF NOT EXISTS idx_quizzes_is_published ON public.quizzes (is_published);

-- 6. QUESTIONS (PUBLIC DATA: NO ANSWER KEYS OR EXPLANATIONS)
-- Safe for students to query while taking a quiz.
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL CHECK (char_length(trim(question_text)) > 0),
    question_type TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'code_output')),
    code_snippet TEXT,
    options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2),
    marks INTEGER NOT NULL DEFAULT 1 CHECK (marks > 0),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON public.questions (quiz_id, order_index);

-- 7. QUESTION ANSWER KEYS (PRIVATE DATA: COMPLETELY RESTRICTED FROM STUDENTS)
CREATE TABLE IF NOT EXISTS public.question_answer_keys (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    correct_option_index INTEGER NOT NULL CHECK (correct_option_index >= 0),
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. QUIZ ATTEMPTS
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    total_marks INTEGER NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
    accuracy_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (accuracy_percentage BETWEEN 0.00 AND 100.00),
    time_taken_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_taken_seconds >= 0),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON public.quiz_attempts (status);

-- 9. STUDENT ANSWERS (INSERTED EXCLUSIVELY VIA SERVER-SIDE GRADING)
CREATE TABLE IF NOT EXISTS public.student_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option_index INTEGER CHECK (selected_option_index >= 0),
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    marks_awarded INTEGER NOT NULL DEFAULT 0 CHECK (marks_awarded >= 0),
    time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_student_answers_attempt_id ON public.student_answers (attempt_id);

-- ==============================================================================
-- 10. VALIDATION & SECURITY TRIGGERS
-- ==============================================================================

-- A. Validate Answer Key Bounds (Ensures correct_option_index is valid for the options array)
CREATE OR REPLACE FUNCTION public.validate_question_answer_key()
RETURNS TRIGGER AS $$
DECLARE
    v_options_len INTEGER;
BEGIN
    SELECT jsonb_array_length(options) INTO v_options_len
    FROM public.questions
    WHERE id = NEW.question_id;

    IF v_options_len IS NULL THEN
        RAISE EXCEPTION 'Associated question % does not exist.', NEW.question_id;
    END IF;

    IF NEW.correct_option_index < 0 OR NEW.correct_option_index >= v_options_len THEN
        RAISE EXCEPTION 'Validation Error: correct_option_index % is out of bounds for question % (valid range: 0 to %).',
            NEW.correct_option_index, NEW.question_id, (v_options_len - 1);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_question_answer_key ON public.question_answer_keys;
CREATE TRIGGER trg_validate_question_answer_key
    BEFORE INSERT OR UPDATE ON public.question_answer_keys
    FOR EACH ROW EXECUTE FUNCTION public.validate_question_answer_key();

-- B. Validate Question Options Update (Prevents truncating options below existing answer key)
CREATE OR REPLACE FUNCTION public.validate_question_options_update()
RETURNS TRIGGER AS $$
DECLARE
    v_correct_index INTEGER;
    v_new_len INTEGER;
BEGIN
    SELECT correct_option_index INTO v_correct_index
    FROM public.question_answer_keys
    WHERE question_id = NEW.id;

    IF v_correct_index IS NOT NULL THEN
        v_new_len := jsonb_array_length(NEW.options);
        IF v_correct_index >= v_new_len THEN
            RAISE EXCEPTION 'Cannot update options: Existing answer key index % would exceed new options count %.',
                v_correct_index, v_new_len;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_question_options_update ON public.questions;
CREATE TRIGGER trg_validate_question_options_update
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    WHEN (NEW.options IS DISTINCT FROM OLD.options)
    EXECUTE FUNCTION public.validate_question_options_update();

-- C. Admin Check Helper (Fixed search_path)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- D. Handle New User Trigger (Fixed search_path; Strictly non-admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_college TEXT;
BEGIN
    v_full_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Student');
    v_college   := NULLIF(TRIM(NEW.raw_user_meta_data->>'college'), '');

    INSERT INTO public.profiles (
        id,
        full_name,
        college_name,
        is_admin,
        total_score,
        weekly_score,
        quizzes_attempted
    )
    VALUES (
        NEW.id,
        v_full_name,
        v_college,
        FALSE,
        0,
        0,
        0
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        college_name = COALESCE(EXCLUDED.college_name, profiles.college_name),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- E. Guard Profiles Score & Privilege Tampering
-- Defense-in-depth trigger: Only admins can alter score/ranking/privilege columns directly
CREATE OR REPLACE FUNCTION public.prevent_profile_score_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF NEW.total_score != OLD.total_score OR
           NEW.weekly_score != OLD.weekly_score OR
           NEW.quizzes_attempted != OLD.quizzes_attempted OR
           NEW.is_admin != OLD.is_admin THEN
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
    WHEN (pg_trigger_depth() < 2)
    EXECUTE FUNCTION public.prevent_profile_score_tampering();

-- F. Sanitize Quiz Attempt INSERT (Enforces unpublished quiz validation and server defaults)
CREATE OR REPLACE FUNCTION public.sanitize_quiz_attempt_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        -- Verify that the quiz exists and is published
        IF NOT EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = NEW.quiz_id
              AND (q.is_published = TRUE OR public.is_admin())
        ) THEN
            RAISE EXCEPTION 'Access Denied: Cannot start an attempt for an unpublished or non-existent quiz.';
        END IF;

        NEW.user_id := auth.uid();
        NEW.status := 'in_progress';
        NEW.score := 0;
        NEW.total_marks := 0;
        NEW.accuracy_percentage := 0.00;
        NEW.completed_at := NULL;
        NEW.time_taken_seconds := 0;
        NEW.started_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sanitize_quiz_attempt_insert ON public.quiz_attempts;
CREATE TRIGGER trg_sanitize_quiz_attempt_insert
    BEFORE INSERT ON public.quiz_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.sanitize_quiz_attempt_insert();

-- G. Guard Quiz Attempt UPDATE (Prevents modifying immutable & result fields outside trusted grading)
CREATE OR REPLACE FUNCTION public.guard_quiz_attempt_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        -- Immutable creation fields cannot be altered
        IF NEW.quiz_id != OLD.quiz_id OR
           NEW.user_id != OLD.user_id OR
           NEW.started_at != OLD.started_at THEN
            RAISE EXCEPTION 'Security Violation: Immutable fields (quiz_id, user_id, started_at) cannot be modified.';
        END IF;

        -- Result fields cannot be altered directly
        IF NEW.score != OLD.score OR
           NEW.total_marks != OLD.total_marks OR
           NEW.accuracy_percentage != OLD.accuracy_percentage OR
           NEW.completed_at != OLD.completed_at OR
           NEW.time_taken_seconds != OLD.time_taken_seconds OR
           (NEW.status = 'completed' AND OLD.status != 'completed') THEN
            RAISE EXCEPTION 'Access Denied: Quiz results can only be recorded via the server-side grading procedure.';
        END IF;

        -- Direct student status updates can only transition to 'abandoned'
        IF NEW.status != OLD.status AND NEW.status != 'abandoned' THEN
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
    WHEN (pg_trigger_depth() < 2)
    EXECUTE FUNCTION public.guard_quiz_attempt_update();

-- ==============================================================================
-- 11. SECURE PROCEDURES (ATTEMPT, GRADING & REVIEW)
-- ==============================================================================

-- A. Start Quiz Attempt
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

    -- Enforce published check: Unpublished quizzes cannot be started by standard students
    SELECT * INTO v_quiz
    FROM public.quizzes
    WHERE id = p_quiz_id AND (is_published = TRUE OR public.is_admin());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz not found or is currently unpublished.';
    END IF;

    -- Check for an existing in_progress attempt
    SELECT id INTO v_existing_id
    FROM public.quiz_attempts
    WHERE quiz_id = p_quiz_id AND user_id = auth.uid() AND status = 'in_progress';

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'attempt_id', v_existing_id,
            'quiz_id', p_quiz_id,
            'status', 'in_progress',
            'resumed', true
        );
    END IF;

    INSERT INTO public.quiz_attempts (quiz_id, user_id, status)
    VALUES (p_quiz_id, auth.uid(), 'in_progress')
    RETURNING id INTO v_attempt_id;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt_id,
        'quiz_id', p_quiz_id,
        'status', 'in_progress',
        'resumed', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- B. Submit Quiz Attempt (Server-Side Grading & Server-Side Timing)
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
    v_expected_question_count INTEGER;
    v_submitted_question_count INTEGER;
    v_item JSONB;
    v_question_id UUID;
    v_selected_index INTEGER;
    v_correct_index INTEGER;
    v_marks INTEGER;
    v_options JSONB;
    v_total_score INTEGER := 0;
    v_total_marks INTEGER := 0;
    v_is_correct BOOLEAN;
    v_accuracy NUMERIC(5, 2) := 0.00;
    v_seen_questions UUID[] := ARRAY[]::UUID[];
BEGIN
    -- 1. Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit quiz attempt.';
    END IF;

    -- 2. Lock the attempt row against concurrent submissions
    SELECT a.user_id, a.quiz_id, a.status, a.started_at, q.time_limit_minutes, q.is_published
    INTO v_user_id, v_quiz_id, v_attempt_status, v_started_at, v_time_limit_minutes, v_is_published
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

    -- 4. Verify status is in_progress
    IF v_attempt_status != 'in_progress' THEN
        RAISE EXCEPTION 'Quiz attempt is already closed (Status: %).', v_attempt_status;
    END IF;

    -- 5. Verify quiz is still published
    IF NOT v_is_published AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Quiz is currently unpublished. Submission rejected.';
    END IF;

    -- 6. Enforce server-side timing: Calculate actual elapsed time on server
    v_server_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;
    -- Max allowed duration: time_limit_minutes + 120 seconds (2-minute buffer for network roundtrip)
    v_max_allowed_seconds := (v_time_limit_minutes * 60) + 120;

    IF v_server_elapsed_seconds > v_max_allowed_seconds THEN
        -- Mark attempt as abandoned due to timeout and COMMIT changes (no exception rollback)
        UPDATE public.quiz_attempts
        SET status = 'abandoned',
            time_taken_seconds = v_server_elapsed_seconds,
            completed_at = NOW()
        WHERE id = p_attempt_id;

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

    -- 8. Verify exact question count
    SELECT COUNT(*) INTO v_expected_question_count
    FROM public.questions
    WHERE quiz_id = v_quiz_id;

    IF v_submitted_question_count != v_expected_question_count THEN
        RAISE EXCEPTION 'Invalid submission: Expected % answers, but received %.',
            v_expected_question_count, v_submitted_question_count;
    END IF;

    -- 9. Grade each answer against canonical question_answer_keys
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        v_question_id := (v_item->>'question_id')::UUID;
        v_selected_index := (v_item->>'selected_option_index')::INTEGER;

        IF v_question_id IS NULL THEN
            RAISE EXCEPTION 'Malformed answer entry: missing question_id.';
        END IF;

        -- Reject duplicate question submissions
        IF v_question_id = ANY(v_seen_questions) THEN
            RAISE EXCEPTION 'Duplicate question submission detected for ID: %.', v_question_id;
        END IF;
        v_seen_questions := array_append(v_seen_questions, v_question_id);

        SELECT q.marks, q.options, k.correct_option_index
        INTO v_marks, v_options, v_correct_index
        FROM public.questions q
        JOIN public.question_answer_keys k ON k.question_id = q.id
        WHERE q.id = v_question_id AND q.quiz_id = v_quiz_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Question % does not belong to quiz %.', v_question_id, v_quiz_id;
        END IF;

        -- Validate option index bounds
        IF v_selected_index IS NOT NULL THEN
            IF v_selected_index < 0 OR v_selected_index >= jsonb_array_length(v_options) THEN
                RAISE EXCEPTION 'Option index % is out of bounds for question %.', v_selected_index, v_question_id;
            END IF;
        END IF;

        v_total_marks := v_total_marks + v_marks;
        v_is_correct := (v_selected_index IS NOT NULL AND v_selected_index = v_correct_index);

        IF v_is_correct THEN
            v_total_score := v_total_score + v_marks;
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
            CASE WHEN v_is_correct THEN v_marks ELSE 0 END,
            GREATEST(0, COALESCE((v_item->>'time_spent_seconds')::INTEGER, 0))
        )
        ON CONFLICT (attempt_id, question_id) DO UPDATE
        SET selected_option_index = EXCLUDED.selected_option_index,
            is_correct = EXCLUDED.is_correct,
            marks_awarded = EXCLUDED.marks_awarded,
            time_spent_seconds = EXCLUDED.time_spent_seconds;
    END LOOP;

    IF v_total_marks > 0 THEN
        v_accuracy := ROUND((v_total_score::NUMERIC / v_total_marks::NUMERIC) * 100.0, 2);
    END IF;

    -- 10. Update attempt record using server-computed time
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
    SET total_score = total_score + v_total_score,
        weekly_score = weekly_score + v_total_score,
        quizzes_attempted = quizzes_attempted + 1,
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'attempt_id', p_attempt_id,
        'status', 'completed',
        'score', v_total_score,
        'total_marks', v_total_marks,
        'accuracy_percentage', v_accuracy,
        'time_taken_seconds', GREATEST(1, v_server_elapsed_seconds)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- C. Get Quiz Review (Accessible ONLY after attempt completion)
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
        sa.marks_awarded,
        k.explanation
    FROM public.student_answers sa
    JOIN public.questions q ON q.id = sa.question_id
    JOIN public.question_answer_keys k ON k.question_id = q.id
    WHERE sa.attempt_id = p_attempt_id
    ORDER BY q.order_index ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

-- ==============================================================================
-- 12. LEADERBOARD SECURE FUNCTION (RPC)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(
    p_scope TEXT DEFAULT 'weekly',
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    college_name TEXT,
    score INTEGER,
    quizzes_attempted INTEGER,
    rank BIGINT
) AS $$
DECLARE
    v_limit INTEGER;
    v_scope TEXT;
BEGIN
    v_scope := LOWER(TRIM(COALESCE(p_scope, 'weekly')));
    IF v_scope NOT IN ('weekly', 'overall') THEN
        v_scope := 'weekly';
    END IF;

    v_limit := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);

    IF v_scope = 'weekly' THEN
        RETURN QUERY
        SELECT
            p.id AS user_id,
            p.full_name,
            COALESCE(c.name, p.college_name, 'Independent Learner') AS college_name,
            p.weekly_score AS score,
            p.quizzes_attempted,
            DENSE_RANK() OVER (ORDER BY p.weekly_score DESC, p.quizzes_attempted DESC, p.created_at ASC) AS rank
        FROM public.profiles p
        LEFT JOIN public.colleges c ON p.college_id = c.id
        WHERE p.weekly_score > 0
        ORDER BY rank ASC
        LIMIT v_limit;
    ELSE
        RETURN QUERY
        SELECT
            p.id AS user_id,
            p.full_name,
            COALESCE(c.name, p.college_name, 'Independent Learner') AS college_name,
            p.total_score AS score,
            p.quizzes_attempted,
            DENSE_RANK() OVER (ORDER BY p.total_score DESC, p.quizzes_attempted DESC, p.created_at ASC) AS rank
        FROM public.profiles p
        LEFT JOIN public.colleges c ON p.college_id = c.id
        WHERE p.total_score > 0
        ORDER BY rank ASC
        LIMIT v_limit;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- ── COLLEGES ──
CREATE POLICY "colleges_select_public" ON public.colleges
    FOR SELECT USING (true);
CREATE POLICY "colleges_admin_all" ON public.colleges
    FOR ALL USING (public.is_admin());

-- ── PROFILES ──
-- Students can only select their own profile; admins can select all
CREATE POLICY "profiles_select_owner_or_admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());
-- Students can update their own profile; trigger and column grants protect scores & admin roles
CREATE POLICY "profiles_update_owner" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL USING (public.is_admin());

-- ── SUBJECTS ──
CREATE POLICY "subjects_select_public" ON public.subjects
    FOR SELECT USING (true);
CREATE POLICY "subjects_admin_all" ON public.subjects
    FOR ALL USING (public.is_admin());

-- ── QUIZZES ──
-- Only published quizzes accessible to standard students
CREATE POLICY "quizzes_select_published" ON public.quizzes
    FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "quizzes_admin_all" ON public.quizzes
    FOR ALL USING (public.is_admin());

-- ── QUESTIONS (PUBLIC FIELDS ONLY) ──
-- Only questions belonging to published quizzes are accessible
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

-- ── QUESTION ANSWER KEYS (HIGHLY RESTRICTED) ──
-- ZERO access for standard students. Only accessible to administrators.
CREATE POLICY "answer_keys_admin_only" ON public.question_answer_keys
    FOR ALL USING (public.is_admin());

-- ── QUIZ ATTEMPTS ──
CREATE POLICY "quiz_attempts_select_owner" ON public.quiz_attempts
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Students can ONLY insert attempts for published quizzes
CREATE POLICY "quiz_attempts_insert_published_only" ON public.quiz_attempts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_attempts.quiz_id
              AND (q.is_published = TRUE OR public.is_admin())
        )
    );

-- Update only for owner; trigger prevents score and status tampering
CREATE POLICY "quiz_attempts_update_owner" ON public.quiz_attempts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "quiz_attempts_admin_all" ON public.quiz_attempts
    FOR ALL USING (public.is_admin());

-- ── STUDENT ANSWERS ──
-- Read access allowed for attempt owner
CREATE POLICY "student_answers_select_owner" ON public.student_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts qa
            WHERE qa.id = student_answers.attempt_id
              AND (qa.user_id = auth.uid() OR public.is_admin())
        )
    );
-- DIRECT INSERT/UPDATE BLOCKED for students. Answers are written via submit_quiz_attempt()
CREATE POLICY "student_answers_admin_all" ON public.student_answers
    FOR ALL USING (public.is_admin());

-- ==============================================================================
-- 14. EXPLICIT SQL GRANTS & REVOKES (DEFENSE IN DEPTH)
-- ==============================================================================

-- Revoke all default table privileges from public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Colleges, Subjects, Quizzes, Questions: Public Read
GRANT SELECT ON public.colleges TO anon, authenticated;
GRANT ALL ON public.colleges TO service_role;

GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT ALL ON public.subjects TO service_role;

GRANT SELECT ON public.quizzes TO anon, authenticated;
GRANT ALL ON public.quizzes TO service_role;

GRANT SELECT ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;

-- Answer Keys: Admin & Service Role ONLY (Students have zero grants)
REVOKE ALL ON public.question_answer_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.question_answer_keys TO service_role;

-- Profiles: Authenticated users can select; and ONLY update their personal editable info
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, college_name, branch, semester, avatar_url) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Quiz Attempts: Authenticated users can select, insert, and update status (for abandonment)
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT UPDATE (status) ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
REVOKE ALL ON public.quiz_attempts FROM anon;

-- Student Answers: Authenticated users can only select their own answers
GRANT SELECT ON public.student_answers TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.student_answers FROM anon, authenticated;
GRANT ALL ON public.student_answers TO service_role;

-- Functions Execution Rights
REVOKE ALL ON FUNCTION public.start_quiz_attempt(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.get_quiz_review(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_review(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_leaderboard(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(TEXT, INTEGER) TO anon, authenticated;

-- ==============================================================================
-- 15. SECURE ADMIN PROMOTION PROCEDURE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(p_user_email TEXT)
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = LOWER(TRIM(p_user_email));

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found.', p_user_email;
    END IF;

    UPDATE public.profiles
    SET is_admin = TRUE, updated_at = NOW()
    WHERE id = v_user_id;

    RETURN 'Success: ' || p_user_email || ' has been promoted to administrator.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.promote_user_to_admin(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(TEXT) TO service_role;
