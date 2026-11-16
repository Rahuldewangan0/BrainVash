import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function QuizManagement() {
  const [quizzes, setQuizzes] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all') // all, published, draft
  const [filterSemester, setFilterSemester] = useState('all')

  // Modal: Create / Edit Quiz
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [saving, setSaving] = useState(false)

  // Modal: Delete Quiz
  const [deleteConfirmQuiz, setDeleteConfirmQuiz] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Modal: Publish Validation & Confirmation
  const [publishModalQuiz, setPublishModalQuiz] = useState(null)
  const [publishValidationErrors, setPublishValidationErrors] = useState([])
  const [validatingPublish, setValidatingPublish] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [unpublishConfirmQuiz, setUnpublishConfirmQuiz] = useState(null)

  // Drawer / Modal: Manage Questions for a Quiz
  const [activeQuizForQuestions, setActiveQuizForQuestions] = useState(null)
  const [assignedQuestions, setAssignedQuestions] = useState([])
  const [availableBankQuestions, setAvailableBankQuestions] = useState([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [linkingQuestionId, setLinkingQuestionId] = useState(null)

  // Quiz Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    subject_id: '',
    semester: 3,
    branch: 'Computer Science & Engineering',
    difficulty: 'medium',
    time_limit_minutes: 20,
    total_questions: 10,
    total_marks: 20,
    passing_score: 60,
    negative_marks: 0.25,
    max_attempts: 2,
    is_published: false,
    is_daily_challenge: false,
  })

  // Fetch quizzes and subjects
  useEffect(() => {
    let ignore = false

    async function loadData() {
      if (!supabase) return
      setLoading(true)
      setError('')
      try {
        // 1. Fetch subjects
        const { data: subData } = await supabase
          .from('subjects')
          .select('id, name, code')
          .order('name', { ascending: true })

        if (!ignore) setSubjects(subData || [])

        // 2. Fetch quizzes (resilient to schema with or without Phase 2 columns)
        let loadedQuizzes = []
        const { data: qzFull, error: qzFullErr } = await supabase
          .from('quizzes')
          .select(`
            id,
            title,
            slug,
            description,
            subject_id,
            semester,
            branch,
            difficulty,
            time_limit_minutes,
            total_questions,
            total_marks,
            passing_score,
            negative_marks,
            max_attempts,
            is_published,
            is_daily_challenge,
            created_at,
            subjects (
              id,
              name,
              code
            )
          `)
          .order('created_at', { ascending: false })

        if (!qzFullErr) {
          loadedQuizzes = qzFull || []
        } else {
          // Fallback with base Phase 1 columns
          const { data: qzBase, error: qzBaseErr } = await supabase
            .from('quizzes')
            .select(`
              id,
              title,
              slug,
              description,
              subject_id,
              difficulty,
              time_limit_minutes,
              total_questions,
              passing_score,
              is_published,
              is_daily_challenge,
              created_at,
              subjects (
                id,
                name,
                code
              )
            `)
            .order('created_at', { ascending: false })

          if (qzBaseErr) throw new Error(qzBaseErr.message)

          loadedQuizzes = (qzBase || []).map((q) => ({
            ...q,
            total_marks: q.total_marks || (q.total_questions ? q.total_questions * 2 : 20),
            negative_marks: q.negative_marks != null ? q.negative_marks : 0.0,
            max_attempts: q.max_attempts || 1,
            semester: q.semester || null,
            branch: q.branch || null,
          }))
        }

        if (!ignore) setQuizzes(loadedQuizzes)
      } catch (err) {
        if (!ignore) setError(err.message || 'Error fetching assessment records.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()
    return () => {
      ignore = true
    }
  }, [refreshTrigger])

  // Auto-slugify generator
  const slugify = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // Filtered quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      // Subject filter
      if (filterSubject !== 'all' && quiz.subject_id !== filterSubject) return false

      // Status filter
      if (filterStatus === 'published' && !quiz.is_published) return false
      if (filterStatus === 'draft' && quiz.is_published) return false

      // Semester filter
      if (filterSemester !== 'all' && Number(quiz.semester) !== Number(filterSemester)) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const titleMatch = quiz.title?.toLowerCase().includes(q)
        const descMatch = quiz.description?.toLowerCase().includes(q)
        const subMatch = quiz.subjects?.name?.toLowerCase().includes(q)
        if (!titleMatch && !descMatch && !subMatch) return false
      }

      return true
    })
  }, [quizzes, filterSubject, filterStatus, filterSemester, searchQuery])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingQuiz(null)
    const firstSubId = subjects.length > 0 ? subjects[0].id : ''
    setFormData({
      title: '',
      slug: '',
      description: '',
      subject_id: firstSubId,
      semester: 3,
      branch: 'Computer Science & Engineering',
      difficulty: 'medium',
      time_limit_minutes: 20,
      total_questions: 10,
      total_marks: 20,
      passing_score: 60,
      negative_marks: 0.25,
      max_attempts: 2,
      is_published: false,
      is_daily_challenge: false,
    })
    setIsFormModalOpen(true)
    setError('')
  }

  // Open Edit Modal
  const handleOpenEdit = (quiz) => {
    setEditingQuiz(quiz)
    setFormData({
      title: quiz.title || '',
      slug: quiz.slug || '',
      description: quiz.description || '',
      subject_id: quiz.subject_id || (subjects[0]?.id || ''),
      semester: quiz.semester || 3,
      branch: quiz.branch || 'Computer Science & Engineering',
      difficulty: quiz.difficulty || 'medium',
      time_limit_minutes: quiz.time_limit_minutes || 20,
      total_questions: quiz.total_questions || 10,
      total_marks: quiz.total_marks || 20,
      passing_score: quiz.passing_score || 60,
      negative_marks: quiz.negative_marks != null ? quiz.negative_marks : 0.0,
      max_attempts: quiz.max_attempts || 1,
      is_published: Boolean(quiz.is_published),
      is_daily_challenge: Boolean(quiz.is_daily_challenge),
    })
    setIsFormModalOpen(true)
    setError('')
  }

  // Save Quiz (Create or Update)
  const handleSaveQuiz = async (e) => {
    e.preventDefault()

    if (!supabase) {
      setError('Supabase is not configured. Check your .env.local settings.')
      return
    }

    if (!formData.title.trim()) {
      setError('Quiz title is required.')
      return
    }

    if (!formData.subject_id) {
      setError('Please select a subject before creating the quiz.')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')

    try {
      const generatedSlug =
        formData.slug.trim() ||
        `${slugify(formData.title)}-${Date.now().toString().slice(-4)}`

      const payload = {
        title: formData.title.trim(),
        slug: generatedSlug,
        description: formData.description.trim() || null,
        subject_id: formData.subject_id,
        semester: Number(formData.semester),
        branch: formData.branch.trim() || null,
        difficulty: formData.difficulty,
        time_limit_minutes: Number(formData.time_limit_minutes),
        total_questions: Number(formData.total_questions),
        total_marks: Number(formData.total_marks),
        passing_score: Number(formData.passing_score),
        negative_marks: Number(formData.negative_marks),
        max_attempts: Number(formData.max_attempts),
        is_published: Boolean(formData.is_published),
        is_daily_challenge: Boolean(formData.is_daily_challenge),
      }

      // Confirm there is an authenticated user before writing.
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!authData?.user) {
        throw new Error('Your session has expired. Please sign in again and retry.')
      }

      if (editingQuiz) {
        // Update and return the saved row. A zero-row update is treated as a failure.
        const { data: updatedQuiz, error: updateError } = await supabase
          .from('quizzes')
          .update(payload)
          .eq('id', editingQuiz.id)
          .select('*')
          .single()

        if (updateError) throw updateError
        if (!updatedQuiz?.id) {
          throw new Error('Supabase did not confirm that the quiz was updated.')
        }

        setSuccessMsg(`Quiz "${updatedQuiz.title}" updated successfully.`)
      } else {
        // Insert and return the actual database row. No reduced-payload fallback:
        // schema, permission, validation and duplicate-slug errors must be visible.
        const { data: insertedQuiz, error: insertError } = await supabase
          .from('quizzes')
          .insert(payload)
          .select('*')
          .single()

        if (insertError) throw insertError
        if (!insertedQuiz?.id) {
          throw new Error('Supabase did not return a saved quiz record. The quiz was not confirmed as created.')
        }

        // Add the confirmed record immediately; the refresh below reloads its subject relation.
        const selectedSubject = subjects.find(
          (subject) => subject.id === insertedQuiz.subject_id
        )
        setQuizzes((current) => [
          { ...insertedQuiz, subjects: selectedSubject || null },
          ...current.filter((quiz) => quiz.id !== insertedQuiz.id),
        ])
        setSuccessMsg(`Quiz "${insertedQuiz.title}" created and saved successfully.`)
      }

      // Close only after Supabase returns the saved row without an error.
      setIsFormModalOpen(false)
      setRefreshTrigger((previous) => previous + 1)
    } catch (err) {
      const details = [
        err?.message || 'Unknown database error',
        err?.code ? `Code: ${err.code}` : null,
        err?.details ? `Details: ${err.details}` : null,
        err?.hint ? `Hint: ${err.hint}` : null,
      ].filter(Boolean).join(' | ')

      setError(`Failed to save quiz: ${details}`)
    } finally {
      setSaving(false)
    }
  }

  // Pre-Publish Validation and Confirmation
  const handleInitiateTogglePublish = async (quiz) => {
    if (quiz.is_published) {
      // Prompt unpublish confirmation
      setUnpublishConfirmQuiz(quiz)
      return
    }

    // User wants to PUBLISH. Run strict pre-publishing validation
    setValidatingPublish(true)
    setError('')
    const errors = []

    // 1. Verify title
    if (!quiz.title || quiz.title.trim().length < 3) {
      errors.push('Quiz title is missing or too short (minimum 3 characters).')
    }

    // 2. Verify subject
    if (!quiz.subject_id) {
      errors.push('A curriculum subject must be selected for this quiz.')
    }

    // 3. Verify duration
    if (!quiz.time_limit_minutes || Number(quiz.time_limit_minutes) <= 0) {
      errors.push('Quiz duration must be at least 1 minute.')
    }

    // 4. Verify difficulty
    const diff = (quiz.difficulty || '').toLowerCase()
    if (!['easy', 'medium', 'hard'].includes(diff)) {
      errors.push('Quiz difficulty must be explicitly set to Easy, Medium, or Hard.')
    }

    // 5. Verify questions are assigned
    try {
      let linkedQuestions = []
      // Check junction table
      const { data: qqData } = await supabase
        .from('quiz_questions')
        .select(`
          question_id,
          questions (
            id,
            question_text,
            options,
            difficulty,
            marks
          )
        `)
        .eq('quiz_id', quiz.id)

      if (qqData && qqData.length > 0) {
        linkedQuestions = qqData.map((row) => row.questions).filter(Boolean)
      }

      // Fallback: check questions.quiz_id
      if (linkedQuestions.length === 0) {
        const { data: qData } = await supabase
          .from('questions')
          .select('id, question_text, options, difficulty, marks')
          .eq('quiz_id', quiz.id)

        linkedQuestions = qData || []
      }

      if (linkedQuestions.length === 0) {
        errors.push('No questions are assigned to this quiz. Use the "Questions 🗄️" button to assign questions from the Question Bank before publishing.')
      } else {
        // Verify each assigned question has valid options
        let invalidOptionsCount = 0
        linkedQuestions.forEach((q) => {
          if (!Array.isArray(q.options) || q.options.length !== 4) {
            invalidOptionsCount += 1
          } else {
            const hasEmptyOpt = q.options.some((opt) => !opt || !String(opt).trim())
            if (hasEmptyOpt) invalidOptionsCount += 1
          }
        })

        if (invalidOptionsCount > 0) {
          errors.push(`${invalidOptionsCount} assigned question(s) do not have exactly 4 valid, non-empty options.`)
        }

        // Verify correct answer keys exist
        const questionIds = linkedQuestions.map((q) => q.id)
        const { data: keysData } = await supabase
          .from('question_answer_keys')
          .select('question_id, correct_option_index')
          .in('question_id', questionIds)

        const keysMap = new Set((keysData || []).map((k) => k.question_id))
        const missingKeys = questionIds.filter((id) => !keysMap.has(id))
        if (missingKeys.length > 0) {
          errors.push(`${missingKeys.length} assigned question(s) are missing a configured correct answer key in the database.`)
        }
      }
    } catch (valErr) {
      console.warn('[QuizManagement] Pre-publish validation check exception:', valErr.message)
    } finally {
      setValidatingPublish(false)
    }

    setPublishValidationErrors(errors)
    setPublishModalQuiz(quiz)
  }

  // Execute Publish
  const handleExecutePublish = async (quiz) => {
    setPublishing(true)
    setError('')
    try {
      const { error: updErr } = await supabase
        .from('quizzes')
        .update({ is_published: true })
        .eq('id', quiz.id)

      if (updErr) throw new Error(updErr.message)

      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, is_published: true } : q))
      )
      setSuccessMsg(`Quiz "${quiz.title}" has been successfully published! It is now live in the Student Dashboard.`)
      setPublishModalQuiz(null)
    } catch (err) {
      setError(`Failed to publish quiz: ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  // Execute Unpublish
  const handleExecuteUnpublish = async (quiz) => {
    setPublishing(true)
    setError('')
    try {
      const { error: updErr } = await supabase
        .from('quizzes')
        .update({ is_published: false })
        .eq('id', quiz.id)

      if (updErr) throw new Error(updErr.message)

      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, is_published: false } : q))
      )
      setSuccessMsg(`Quiz "${quiz.title}" has been moved to Draft (hidden from students).`)
      setUnpublishConfirmQuiz(null)
    } catch (err) {
      setError(`Failed to unpublish quiz: ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  // Execute Delete Quiz
  const handleExecuteDeleteQuiz = async () => {
    if (!deleteConfirmQuiz) return
    setDeleting(true)
    setError('')
    setSuccessMsg('')

    try {
      const { error: delErr } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', deleteConfirmQuiz.id)

      if (delErr) throw new Error(delErr.message)

      setSuccessMsg(`Quiz "${deleteConfirmQuiz.title}" deleted.`)
      setDeleteConfirmQuiz(null)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setError(`Error deleting quiz: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // Load Questions for "Manage Questions" Drawer
  const handleOpenQuestionsDrawer = async (quiz) => {
    setActiveQuizForQuestions(quiz)
    setLoadingQuestions(true)
    setError('')

    try {
      // 1. Fetch questions currently linked via quiz_questions junction table
      let assigned = []
      try {
        const { data: qqData } = await supabase
          .from('quiz_questions')
          .select(`
            order_index,
            is_direct,
            is_manual,
            questions (
              id,
              question_text,
              difficulty,
              marks,
              topic
            )
          `)
          .eq('quiz_id', quiz.id)
          .order('order_index', { ascending: true })

        if (qqData && qqData.length > 0) {
          assigned = qqData
            .map((row) => (row.questions ? { ...row.questions, is_direct: row.is_direct, is_manual: row.is_manual } : null))
            .filter(Boolean)
        }
      } catch (qqErr) {
        console.warn('[QuizManagement] quiz_questions fetch notice:', qqErr.message)
      }

      // Fallback: check questions directly linked via quiz_id column
      if (assigned.length === 0) {
        const { data: qData } = await supabase
          .from('questions')
          .select('id, question_text, difficulty, marks, topic')
          .eq('quiz_id', quiz.id)

        assigned = (qData || []).map((q) => ({ ...q, is_direct: true, is_manual: false }))
      }
      setAssignedQuestions(assigned)

      // 2. Fetch available bank questions for this subject (excluding already assigned)
      const assignedIds = new Set(assigned.map((q) => q.id))
      const { data: bankData } = await supabase
        .from('questions')
        .select('id, question_text, difficulty, marks, topic, subject_id')
        .order('created_at', { ascending: false })
        .limit(50)

      const available = (bankData || []).filter((q) => !assignedIds.has(q.id))
      setAvailableBankQuestions(available)
    } catch (err) {
      setError(err.message || 'Error loading quiz questions.')
    } finally {
      setLoadingQuestions(false)
    }
  }

  // Assign Question to Quiz via junction table
  const handleAssignQuestion = async (questionId) => {
    if (!activeQuizForQuestions) return
    setLinkingQuestionId(questionId)
    setError('')

    try {
      // Try calling RPC admin_assign_question_to_quiz
      const { error: rpcErr } = await supabase.rpc('admin_assign_question_to_quiz', {
        p_quiz_id: activeQuizForQuestions.id,
        p_question_id: questionId,
        p_order_index: assignedQuestions.length,
      })

      if (rpcErr) {
        // Phase 1 compatibility: questions are linked directly through questions.quiz_id.
        // Phase 2 compatibility: use the quiz_questions junction table when available.
        const { error: junctionErr } = await supabase
          .from('quiz_questions')
          .insert({
            quiz_id: activeQuizForQuestions.id,
            question_id: questionId,
            order_index: assignedQuestions.length,
          })

        if (junctionErr) {
          const { error: directErr } = await supabase
            .from('questions')
            .update({ quiz_id: activeQuizForQuestions.id })
            .eq('id', questionId)

          if (directErr) {
            throw new Error(
              `Assignment RPC failed (${rpcErr.message}); junction insert failed (${junctionErr.message}); direct assignment failed (${directErr.message}).`
            )
          }
        }
      }

      // Refresh drawer questions and surface refresh failures instead of silently succeeding.
      await handleOpenQuestionsDrawer(activeQuizForQuestions)
    } catch (err) {
      setError(`Failed to assign question: ${err.message}`)
    } finally {
      setLinkingQuestionId(null)
    }
  }

  // Remove Question from Quiz
  const handleRemoveQuestion = async (questionId) => {
    if (!activeQuizForQuestions) return
    setLinkingQuestionId(questionId)
    setError('')

    try {
      const targetQ = assignedQuestions.find((q) => q.id === questionId)
      // When removing a direct-only question from the quiz drawer, also unlink its direct assignment
      const removeDirect = Boolean(targetQ?.is_direct && !targetQ?.is_manual)

      // Try calling RPC admin_remove_question_from_quiz
      const { error: rpcErr } = await supabase.rpc('admin_remove_question_from_quiz', {
        p_quiz_id: activeQuizForQuestions.id,
        p_question_id: questionId,
        p_remove_direct: removeDirect,
      })

      if (rpcErr) {
        // Check both Phase 2 junction-table and Phase 1 direct-link cleanup operations.
        const { error: junctionErr } = await supabase
          .from('quiz_questions')
          .delete()
          .eq('quiz_id', activeQuizForQuestions.id)
          .eq('question_id', questionId)

        const { error: directErr } = await supabase
          .from('questions')
          .update({ quiz_id: null })
          .eq('id', questionId)
          .eq('quiz_id', activeQuizForQuestions.id)

        const junctionMissing = junctionErr && /does not exist|schema cache|relation/i.test(junctionErr.message)
        if (directErr || (junctionErr && !junctionMissing)) {
          throw new Error(
            `Removal RPC failed (${rpcErr.message}); ${junctionErr ? `junction removal failed (${junctionErr.message})` : 'junction removal succeeded'}; ${directErr ? `direct unlink failed (${directErr.message})` : 'direct unlink succeeded'}.`
          )
        }
      }

      // Refresh drawer questions
      await handleOpenQuestionsDrawer(activeQuizForQuestions)
    } catch (err) {
      setError(`Failed to remove question: ${err.message}`)
    } finally {
      setLinkingQuestionId(null)
    }
  }

  return (
    <div className="dash-tab-container admin-quizzes-container">
      {/* Header */}
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Assessment & Quiz Management</h1>
          <p className="dash-page-desc">
            Configure assessment timing, pass criteria, negative marking, attempt limits, and draft/publish workflows.
          </p>
        </div>

        <div>
          <button className="btn-primary" onClick={handleOpenCreate}>
            <span>➕</span> Create New Quiz
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="auth-message auth-success" style={{ marginBottom: 16 }}>
          <span>✓ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="auth-message auth-error" style={{ marginBottom: 16 }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="dash-filter-toolbar" style={{ marginBottom: 20 }}>
        {/* Search */}
        <div className="dash-search-box">
          <span className="dash-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search quizzes by title, description or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dash-search-input"
          />
          {searchQuery && (
            <button className="dash-search-clear" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="dash-filter-group" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Status */}
          <select
            className="dash-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published (Live)</option>
            <option value="draft">Drafts Only</option>
          </select>

          {/* Subject */}
          <select
            className="dash-select"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="all">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} ({sub.code || 'No Code'})
              </option>
            ))}
          </select>

          {/* Semester */}
          <select
            className="dash-select"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
          >
            <option value="all">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quizzes List Table */}
      {loading ? (
        <div className="dash-loading-container">
          <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
          <p>Loading quizzes from Supabase...</p>
        </div>
      ) : filteredQuizzes.length > 0 ? (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Quiz Details</th>
                  <th>Subject & Sem</th>
                  <th>Duration & Questions</th>
                  <th>Scoring & Penalty</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuizzes.map((quiz) => {
                  const negMarks = Number(quiz.negative_marks || 0)
                  return (
                    <tr key={quiz.id}>
                      <td>
                        <div>
                          <strong style={{ color: '#3b1f2b', display: 'block', fontSize: '0.95rem' }}>
                            {quiz.title}
                          </strong>
                          {quiz.description && (
                            <span style={{ fontSize: '0.8rem', color: '#9a8a90' }}>
                              {quiz.description.slice(0, 55)}...
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            {quiz.is_daily_challenge && (
                              <span style={{ fontSize: '0.7rem', background: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                🌟 Daily Challenge
                              </span>
                            )}
                            <span style={{ fontSize: '0.7rem', background: '#faf5ef', color: '#5e4a52', padding: '1px 6px', borderRadius: 4 }}>
                              Max {quiz.max_attempts || 1} Attempt(s)
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: '#3b1f2b' }}>{quiz.subjects?.name || 'General'}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#9a8a90' }}>
                          Sem {quiz.semester || '-'} • {quiz.branch || 'Engineering'}
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'block', fontWeight: 600, color: '#3b1f2b' }}>
                          ⏱️ {quiz.time_limit_minutes} Mins
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#5e4a52' }}>
                          ❓ {quiz.total_questions} Questions
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          <span>Pass: {quiz.passing_score}%</span>
                          {negMarks > 0 ? (
                            <span style={{ display: 'block', color: '#c2185b', fontSize: '0.75rem', fontWeight: 600 }}>
                              ⚠️ -{negMarks} Neg Marks
                            </span>
                          ) : (
                            <span style={{ display: 'block', color: '#2e7d32', fontSize: '0.75rem' }}>
                              Zero Penalty
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleInitiateTogglePublish(quiz)}
                          className={`dash-status-badge ${quiz.is_published ? 'status-completed' : 'status-abandoned'}`}
                          title={quiz.is_published ? 'Click to unpublish (hide from students)' : 'Click to validate and publish quiz'}
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          {quiz.is_published ? '● Published' : '○ Draft'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#faf5ef' }}
                            onClick={() => handleOpenQuestionsDrawer(quiz)}
                            title="Manage assigned questions"
                          >
                            Questions 🗄️
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            onClick={() => handleOpenEdit(quiz)}
                            title="Edit quiz parameters"
                          >
                            Edit
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#c2185b' }}
                            onClick={() => setDeleteConfirmQuiz(quiz)}
                            title="Delete quiz"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">📝</div>
          <h3>No quizzes match your filter criteria</h3>
          <p>Get started by creating your first engineering assessment.</p>
          <button className="btn-primary" onClick={handleOpenCreate} style={{ marginTop: 12 }}>
            ➕ Create New Quiz
          </button>
        </div>
      )}

      {/* Modal: Create / Edit Quiz */}
      {isFormModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setIsFormModalOpen(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <button className="auth-modal-close" onClick={() => setIsFormModalOpen(false)}>
              ×
            </button>

            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge">
                <span>📝</span> {editingQuiz ? 'Update Assessment' : 'New Assessment'}
              </div>
              <h2 className="diff-modal-title">
                {editingQuiz ? `Edit: ${editingQuiz.title}` : 'Create Engineering Quiz'}
              </h2>
            </div>

            <form onSubmit={handleSaveQuiz} className="admin-form">
              {/* Title & Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Quiz Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures Midterm Test"
                    className="form-input"
                    value={formData.title}
                    onChange={(e) => {
                      const newTitle = e.target.value
                      setFormData({
                        ...formData,
                        title: newTitle,
                        slug: !editingQuiz ? slugify(newTitle) : formData.slug,
                      })
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">URL Slug</label>
                  <input
                    type="text"
                    placeholder="dsa-midterm-test"
                    className="form-input"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })}
                  />
                </div>
              </div>

              {/* Subject & Semester */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <select
                    className="form-input"
                    value={formData.subject_id}
                    onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.code || 'General'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select
                    className="form-input"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Branch */}
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Engineering Branch</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science & Engineering"
                  className="form-input"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                />
              </div>

              {/* Numerical Metrics: Duration, Total Qs, Total Marks, Passing % */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Duration (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className="form-input"
                    value={formData.time_limit_minutes}
                    onChange={(e) => setFormData({ ...formData, time_limit_minutes: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Qs</label>
                  <input
                    type="number"
                    min={1}
                    className="form-input"
                    value={formData.total_questions}
                    onChange={(e) => setFormData({ ...formData, total_questions: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Marks</label>
                  <input
                    type="number"
                    min={1}
                    className="form-input"
                    value={formData.total_marks}
                    onChange={(e) => setFormData({ ...formData, total_marks: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Pass (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="form-input"
                    value={formData.passing_score}
                    onChange={(e) => setFormData({ ...formData, passing_score: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Negative Marking & Max Attempts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Negative Marks (per incorrect answer)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="0.25"
                    className="form-input"
                    value={formData.negative_marks}
                    onChange={(e) => setFormData({ ...formData, negative_marks: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Attempts Allowed</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    placeholder="1"
                    className="form-input"
                    value={formData.max_attempts}
                    onChange={(e) => setFormData({ ...formData, max_attempts: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Quiz Description</label>
                <textarea
                  rows={2}
                  placeholder="Explain topics covered, difficulty expectations, and student instructions..."
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Checkboxes: Published & Daily Challenge */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', color: '#3b1f2b' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#e8634a' }}
                  />
                  <strong>Publish Immediately</strong> (Visible to students)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', color: '#3b1f2b' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_daily_challenge}
                    onChange={(e) => setFormData({ ...formData, is_daily_challenge: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#e8634a' }}
                  />
                  <span>Mark as Daily Challenge 🌟</span>
                </label>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsFormModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingQuiz ? 'Update Quiz ✓' : 'Create Quiz +'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer / Modal: Manage Questions for a Quiz */}
      {activeQuizForQuestions && (
        <div className="auth-modal-overlay" onClick={() => setActiveQuizForQuestions(null)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <button className="auth-modal-close" onClick={() => setActiveQuizForQuestions(null)}>
              ×
            </button>

            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge">
                <span>🗄️</span> Reusable Question Bank Assignment
              </div>
              <h2 className="diff-modal-title">
                Manage Questions: {activeQuizForQuestions.title}
              </h2>
              <p className="diff-modal-subtitle">
                Assign reusable questions from the central repository to this assessment via the junction mapping table.
              </p>
            </div>

            {loadingQuestions ? (
              <div className="dash-loading-container" style={{ padding: '30px 0' }}>
                <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
                <p>Loading linked question bank items...</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Currently Assigned Questions */}
                <div>
                  <h4 style={{ color: '#3b1f2b', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Currently Linked ({assignedQuestions.length})</span>
                  </h4>
                  <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assignedQuestions.length > 0 ? (
                      assignedQuestions.map((q, idx) => (
                        <div
                          key={q.id}
                          style={{
                            padding: '10px 12px',
                            background: '#faf5ef',
                            borderRadius: 8,
                            border: '1px solid #f3e0d5',
                            fontSize: '0.85rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <strong style={{ color: '#3b1f2b' }}>
                              #{idx + 1}. {q.question_text?.slice(0, 60)}...
                            </strong>
                            <button
                              type="button"
                              disabled={linkingQuestionId === q.id}
                              onClick={() => handleRemoveQuestion(q.id)}
                              style={{
                                color: '#c2185b',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                              }}
                            >
                              ✕ Remove
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.75rem', color: '#9a8a90' }}>
                            <span style={{ textTransform: 'capitalize' }}>Tier: {q.difficulty || 'medium'}</span>
                            <span>•</span>
                            <span>{q.marks || 1} mark(s)</span>
                            {q.topic && <span>• Topic: {q.topic}</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: '#9a8a90', fontSize: '0.85rem', padding: '16px 0', textAlign: 'center' }}>
                        No questions linked to this quiz yet. Pick from the available bank on the right.
                      </p>
                    )}
                  </div>
                </div>

                {/* Available Questions to Assign */}
                <div>
                  <h4 style={{ color: '#3b1f2b', marginBottom: 10 }}>
                    Available in Question Bank ({availableBankQuestions.length})
                  </h4>
                  <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableBankQuestions.length > 0 ? (
                      availableBankQuestions.map((q) => (
                        <div
                          key={q.id}
                          style={{
                            padding: '10px 12px',
                            background: '#ffffff',
                            borderRadius: 8,
                            border: '1px solid #eee',
                            fontSize: '0.85rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ color: '#3b1f2b', fontWeight: 500 }}>
                              {q.question_text?.slice(0, 60)}...
                            </span>
                            <button
                              type="button"
                              disabled={linkingQuestionId === q.id}
                              onClick={() => handleAssignQuestion(q.id)}
                              className="btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            >
                              + Assign
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.75rem', color: '#9a8a90' }}>
                            <span style={{ textTransform: 'capitalize' }}>Tier: {q.difficulty || 'medium'}</span>
                            <span>•</span>
                            <span>{q.marks || 1} mark(s)</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: '#9a8a90', fontSize: '0.85rem', padding: '16px 0', textAlign: 'center' }}>
                        All available questions are already assigned or bank is empty.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveQuizForQuestions(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmQuiz && (
        <div className="auth-modal-overlay" onClick={() => setDeleteConfirmQuiz(null)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge" style={{ background: '#fce4ec', color: '#c2185b' }}>
                <span>⚠️</span> Confirm Quiz Deletion
              </div>
              <h2 className="diff-modal-title">Delete Quiz</h2>
            </div>

            <p style={{ color: '#5e4a52', marginBottom: 20 }}>
              Are you sure you want to delete <strong>{deleteConfirmQuiz.title}</strong>? All student attempt records associated with this quiz may be removed or affected.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirmQuiz(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#c2185b', borderColor: '#c2185b' }}
                disabled={deleting}
                onClick={handleExecuteDeleteQuiz}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Validation & Confirmation Modal */}
      {publishModalQuiz && (
        <div className="auth-modal-overlay" onClick={() => setPublishModalQuiz(null)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <button className="auth-modal-close" onClick={() => setPublishModalQuiz(null)}>
              ×
            </button>

            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div
                className="diff-header-badge"
                style={{
                  background: publishValidationErrors.length > 0 ? '#fce4ec' : '#e8f5e9',
                  color: publishValidationErrors.length > 0 ? '#c2185b' : '#2e7d32',
                }}
              >
                <span>{publishValidationErrors.length > 0 ? '⚠️' : '🚀'}</span>
                {publishValidationErrors.length > 0 ? 'Publishing Blocked — Validation Issues' : 'Ready to Publish'}
              </div>
              <h2 className="diff-modal-title">
                {publishValidationErrors.length > 0 ? 'Assessment Not Ready' : `Publish "${publishModalQuiz.title}"`}
              </h2>
            </div>

            {validatingPublish ? (
              <div className="dash-loading-container" style={{ padding: '20px 0' }}>
                <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
                <p>Validating questions, options, and answer keys...</p>
              </div>
            ) : publishValidationErrors.length > 0 ? (
              <div>
                <p style={{ color: '#5e4a52', marginBottom: 12 }}>
                  Before this quiz can be published to students, the following requirements must be resolved:
                </p>
                <div style={{ background: '#fff5f5', border: '1px solid #ffd6d6', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#c2185b', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {publishValidationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPublishModalQuiz(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      const q = publishModalQuiz
                      setPublishModalQuiz(null)
                      handleOpenQuestionsDrawer(q)
                    }}
                  >
                    Open Question Manager 🗄️
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: '#5e4a52', marginBottom: 16 }}>
                  All publishing checks have passed! Once published, this assessment will immediately become available in the Student Dashboard for all eligible students.
                </p>

                <div style={{ background: '#faf5ef', border: '1px solid #f3e0d5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <div><strong>Subject:</strong> {publishModalQuiz.subjects?.name || 'General'}</div>
                    <div><strong>Semester:</strong> Sem {publishModalQuiz.semester || 'All'}</div>
                    <div><strong>Duration:</strong> {publishModalQuiz.time_limit_minutes} Minutes</div>
                    <div><strong>Difficulty:</strong> <span style={{ textTransform: 'capitalize' }}>{publishModalQuiz.difficulty}</span></div>
                    <div><strong>Total Marks:</strong> {publishModalQuiz.total_marks}</div>
                    <div><strong>Negative Marks:</strong> -{publishModalQuiz.negative_marks || 0}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPublishModalQuiz(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#2e7d32', borderColor: '#2e7d32' }}
                    disabled={publishing}
                    onClick={() => handleExecutePublish(publishModalQuiz)}
                  >
                    {publishing ? 'Publishing...' : 'Confirm & Publish Live ✓'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unpublish Confirmation Modal */}
      {unpublishConfirmQuiz && (
        <div className="auth-modal-overlay" onClick={() => setUnpublishConfirmQuiz(null)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge">
                <span>🔒</span> Unpublish Assessment
              </div>
              <h2 className="diff-modal-title">Move to Draft?</h2>
            </div>

            <p style={{ color: '#5e4a52', marginBottom: 20 }}>
              Moving <strong>{unpublishConfirmQuiz.title}</strong> to Draft will immediately hide it from student listings. Existing student scores and completed attempts will remain securely preserved.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setUnpublishConfirmQuiz(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={publishing}
                onClick={() => handleExecuteUnpublish(unpublishConfirmQuiz)}
              >
                {publishing ? 'Updating...' : 'Move to Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
