import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('all')
  const [filterSubject, setFilterSubject] = useState('all')

  // Question Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [saving, setSaving] = useState(false)

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Form data
  const [form, setForm] = useState({
    question_text: '',
    code_snippet: '',
    options: ['', '', '', ''],
    correct_option_index: 0,
    explanation: '',
    marks: 1,
    difficulty: 'medium',
    subject_id: '',
    quiz_id: '',
    topic: '',
  })

  useEffect(() => {
    let ignore = false

    async function loadData() {
      if (!supabase) return
      setLoading(true)
      setError('')

      try {
        // Subjects
        const { data: subData } = await supabase
          .from('subjects')
          .select('id, name, code')
          .order('name')
        if (!ignore) setSubjects(subData || [])

        // Quizzes (for assignment)
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('id, title')
          .order('title')
        if (!ignore) setQuizzes(quizData || [])

        // Questions — admin sees all (resilient to schema with or without direct subject_id relationship)
        let loadedQuestions = []
        const { data: qData, error: qErr } = await supabase
          .from('questions')
          .select(`
            id,
            quiz_id,
            subject_id,
            question_text,
            question_type,
            code_snippet,
            options,
            marks,
            difficulty,
            topic,
            order_index,
            created_at,
            subjects ( id, name, code ),
            quizzes ( id, title )
          `)
          .order('created_at', { ascending: false })

        if (!qErr) {
          loadedQuestions = qData || []
        } else {
          // Fallback linking via quizzes -> subjects
          const { data: qBase, error: qBaseErr } = await supabase
            .from('questions')
            .select(`
              id,
              quiz_id,
              question_text,
              question_type,
              code_snippet,
              options,
              marks,
              order_index,
              created_at,
              quizzes (
                id,
                title,
                subjects (
                  id,
                  name,
                  code
                )
              )
            `)
            .order('created_at', { ascending: false })

          if (qBaseErr) throw new Error(qBaseErr.message)
          loadedQuestions = (qBase || []).map((q) => ({
            ...q,
            difficulty: q.difficulty || 'medium',
            topic: q.topic || '',
            subjects: q.quizzes?.subjects || null,
          }))
        }

        if (!ignore) setQuestions(loadedQuestions)
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading question bank.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()
    return () => {
      ignore = true
    }
  }, [refreshTrigger])

  // Filtered questions
  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterDifficulty !== 'all' && (q.difficulty || 'medium') !== filterDifficulty) return false
      if (filterSubject !== 'all' && q.subject_id !== filterSubject) return false
      if (searchQuery.trim()) {
        const s = searchQuery.toLowerCase().trim()
        const textMatch = q.question_text?.toLowerCase().includes(s)
        const topicMatch = q.topic?.toLowerCase().includes(s)
        const subMatch = q.subjects?.name?.toLowerCase().includes(s)
        if (!textMatch && !topicMatch && !subMatch) return false
      }
      return true
    })
  }, [questions, filterDifficulty, filterSubject, searchQuery])

  // Difficulty counts
  const diffCounts = useMemo(() => {
    const easy = questions.filter((q) => q.difficulty === 'easy').length
    const medium = questions.filter((q) => !q.difficulty || q.difficulty === 'medium').length
    const hard = questions.filter((q) => q.difficulty === 'hard').length
    return { easy, medium, hard, total: questions.length }
  }, [questions])

  // Open Create
  const handleOpenCreate = () => {
    setEditingQuestion(null)
    setForm({
      question_text: '',
      code_snippet: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      explanation: '',
      marks: 1,
      difficulty: 'medium',
      subject_id: subjects.length > 0 ? subjects[0].id : '',
      quiz_id: '',
      topic: '',
    })
    setIsFormOpen(true)
    setError('')
  }

  // Open Edit — fetch answer key for existing question
  const handleOpenEdit = async (question) => {
    setEditingQuestion(question)
    setForm({
      question_text: question.question_text || '',
      code_snippet: question.code_snippet || '',
      options: Array.isArray(question.options) ? [...question.options] : ['', '', '', ''],
      correct_option_index: 0,
      explanation: '',
      marks: question.marks || 1,
      difficulty: question.difficulty || 'medium',
      subject_id: question.subject_id || '',
      quiz_id: question.quiz_id || '',
      topic: question.topic || '',
    })

    // Try fetching the answer key (admin only)
    try {
      const { data: akData } = await supabase
        .from('question_answer_keys')
        .select('correct_option_index, explanation')
        .eq('question_id', question.id)
        .single()

      if (akData) {
        setForm((prev) => ({
          ...prev,
          correct_option_index: akData.correct_option_index ?? 0,
          explanation: akData.explanation || '',
        }))
      }
    } catch (akErr) {
      console.warn('[QuestionBank] Answer key fetch notice:', akErr.message)
    }

    setIsFormOpen(true)
    setError('')
  }

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault()

    // Client-side validation
    if (!form.question_text.trim()) {
      setError('Question text cannot be empty.')
      return
    }
    const emptyOpt = form.options.findIndex((o) => !o.trim())
    if (emptyOpt !== -1) {
      setError(`Option ${String.fromCharCode(65 + emptyOpt)} cannot be empty.`)
      return
    }
    if (form.correct_option_index < 0 || form.correct_option_index > 3) {
      setError('Correct answer must be A, B, C or D.')
      return
    }
    if (!form.marks || form.marks <= 0) {
      setError('Marks must be a positive number.')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')

    try {
      // Try using admin_save_question RPC first
      const { error: rpcErr } = await supabase.rpc('admin_save_question', {
        p_question_id: editingQuestion?.id || null,
        p_quiz_id: form.quiz_id || null,
        p_subject_id: form.subject_id || null,
        p_topic: form.topic || null,
        p_difficulty: form.difficulty || 'medium',
        p_question_text: form.question_text.trim(),
        p_code_snippet: form.code_snippet || null,
        p_options: form.options,
        p_marks: Number(form.marks),
        p_correct_option_index: Number(form.correct_option_index),
        p_explanation: form.explanation || null,
      })

      if (rpcErr) {
        // Fallback: direct table operations if RPC is not yet available (pre-migration)
        const questionPayload = {
          quiz_id: form.quiz_id || null,
          subject_id: form.subject_id || null,
          topic: form.topic || null,
          difficulty: form.difficulty || 'medium',
          question_text: form.question_text.trim(),
          code_snippet: form.code_snippet || null,
          options: form.options,
          marks: Number(form.marks),
        }

        if (editingQuestion) {
          let { error: updErr } = await supabase
            .from('questions')
            .update(questionPayload)
            .eq('id', editingQuestion.id)

          if (updErr && (updErr.message.includes('column') || updErr.message.includes('does not exist'))) {
            // Fallback for Phase 1 without subject_id / topic / difficulty
            const basePayload = {
              quiz_id: questionPayload.quiz_id,
              question_text: questionPayload.question_text,
              code_snippet: questionPayload.code_snippet,
              options: questionPayload.options,
              marks: questionPayload.marks,
            }
            const resBase = await supabase
              .from('questions')
              .update(basePayload)
              .eq('id', editingQuestion.id)

            updErr = resBase.error
          }

          if (updErr) {
            if (updErr.message.includes('permission denied')) {
              throw new Error(`Database Permission Notice: The 'authenticated' role currently lacks table-level UPDATE grants on questions. Deploying the Phase 2 migration will grant full admin permissions.`)
            }
            throw new Error(updErr.message)
          }

          // Upsert answer key
          await supabase
            .from('question_answer_keys')
            .upsert({
              question_id: editingQuestion.id,
              correct_option_index: Number(form.correct_option_index),
              explanation: form.explanation || null,
            }, { onConflict: 'question_id' })

          setSuccessMsg('Question updated successfully.')
        } else {
          let { data: insData, error: insErr } = await supabase
            .from('questions')
            .insert([questionPayload])
            .select('id')
            .single()

          if (insErr && (insErr.message.includes('column') || insErr.message.includes('does not exist'))) {
            // Fallback for Phase 1 without subject_id / topic / difficulty
            const basePayload = {
              quiz_id: questionPayload.quiz_id,
              question_text: questionPayload.question_text,
              code_snippet: questionPayload.code_snippet,
              options: questionPayload.options,
              marks: questionPayload.marks,
            }
            const resBase = await supabase
              .from('questions')
              .insert([basePayload])
              .select('id')
              .single()

            insData = resBase.data
            insErr = resBase.error
          }

          if (insErr) {
            if (insErr.message.includes('permission denied')) {
              throw new Error(`Database Permission Notice: The 'authenticated' role currently lacks table-level INSERT grants on questions. Deploying the Phase 2 migration will grant full admin permissions.`)
            }
            throw new Error(insErr.message)
          }

          // Insert answer key
          if (insData?.id) {
            await supabase
              .from('question_answer_keys')
              .insert({
                question_id: insData.id,
                correct_option_index: Number(form.correct_option_index),
                explanation: form.explanation || null,
              })
          }

          setSuccessMsg('Question created successfully.')
        }
      } else {
        setSuccessMsg(editingQuestion ? 'Question updated via secure RPC.' : 'Question created via secure RPC.')
      }

      setIsFormOpen(false)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setError(err.message || 'Failed to save question.')
    } finally {
      setSaving(false)
    }
  }

  // Delete question
  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    setError('')
    setSuccessMsg('')

    try {
      // Delete answer key first (cascading on FK should handle this, but be explicit)
      await supabase
        .from('question_answer_keys')
        .delete()
        .eq('question_id', deleteConfirm.id)

      const { error: delErr } = await supabase
        .from('questions')
        .delete()
        .eq('id', deleteConfirm.id)

      if (delErr) throw new Error(delErr.message)

      setSuccessMsg('Question deleted successfully.')
      setDeleteConfirm(null)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setError(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // Update an option value
  const updateOption = (idx, value) => {
    setForm((prev) => {
      const opts = [...prev.options]
      opts[idx] = value
      return { ...prev, options: opts }
    })
  }

  const diffStyle = {
    easy: { color: '#2e7d32', bg: '#e8f5e9' },
    medium: { color: '#d84315', bg: '#fbe9e7' },
    hard: { color: '#c2185b', bg: '#fce4ec' },
  }

  return (
    <div className="dash-tab-container admin-questions-container">
      {/* Header */}
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Reusable Question Bank</h1>
          <p className="dash-page-desc">
            Author, categorize and assign MCQ items across Easy, Medium and Hard difficulty tiers. Questions are shared via the quiz_questions junction table.
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreate}>
          <span>➕</span> New Question
        </button>
      </div>

      {/* Difficulty Distribution Cards */}
      <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('all')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">All Questions</span>
            <span className="dash-stat-icon">🗄️</span>
          </div>
          <div className="dash-stat-value">{diffCounts.total}</div>
        </div>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('easy')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">🌱 Easy Tier</span>
          </div>
          <div className="dash-stat-value" style={{ color: '#2e7d32' }}>{diffCounts.easy}</div>
        </div>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('medium')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">⚡ Medium Tier</span>
          </div>
          <div className="dash-stat-value" style={{ color: '#d84315' }}>{diffCounts.medium}</div>
        </div>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('hard')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">🔥 Hard Tier</span>
          </div>
          <div className="dash-stat-value" style={{ color: '#c2185b' }}>{diffCounts.hard}</div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="auth-message auth-success" style={{ marginBottom: 16 }}>
          ✓ {successMsg}
          <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}
      {error && (
        <div className="auth-message auth-error" style={{ marginBottom: 16 }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="dash-filter-toolbar" style={{ marginBottom: 20 }}>
        <div className="dash-search-box">
          <span className="dash-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search question text, topic or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dash-search-input"
          />
          {searchQuery && (
            <button className="dash-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
        <div className="dash-filter-group" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="dash-select" value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
            <option value="all">All Difficulties</option>
            <option value="easy">🌱 Easy</option>
            <option value="medium">⚡ Medium</option>
            <option value="hard">🔥 Hard</option>
          </select>
          <select className="dash-select" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="dash-loading-container">
          <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
          <p>Loading question bank from Supabase...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((q, idx) => {
            const ds = diffStyle[q.difficulty] || diffStyle.medium
            return (
              <div key={q.id} className="dash-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                        color: ds.color, background: ds.bg,
                      }}>
                        {q.difficulty || 'medium'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#9a8a90' }}>
                        {q.marks} mark{q.marks !== 1 ? 's' : ''}
                      </span>
                      {q.subjects?.name && (
                        <span style={{ fontSize: '0.78rem', color: '#5e4a52', background: '#faf5ef', padding: '1px 6px', borderRadius: 4 }}>
                          📚 {q.subjects.name}
                        </span>
                      )}
                      {q.topic && (
                        <span style={{ fontSize: '0.78rem', color: '#9a8a90' }}>
                          • {q.topic}
                        </span>
                      )}
                      {q.quizzes?.title && (
                        <span style={{ fontSize: '0.72rem', color: '#2e7d32', background: '#e8f5e9', padding: '1px 6px', borderRadius: 4 }}>
                          🔗 {q.quizzes.title}
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#3b1f2b', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>
                      <strong>Q{idx + 1}.</strong> {q.question_text}
                    </p>
                    {q.code_snippet && (
                      <pre style={{
                        background: '#2d1520', color: '#f8d7d0', padding: '10px 14px',
                        borderRadius: 8, fontSize: '0.82rem', marginTop: 8, overflowX: 'auto',
                      }}>
                        <code>{q.code_snippet}</code>
                      </pre>
                    )}
                    {/* Options preview */}
                    {Array.isArray(q.options) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 8 }}>
                        {q.options.map((opt, oi) => (
                          <span key={oi} style={{ fontSize: '0.82rem', color: '#5e4a52' }}>
                            <strong style={{ color: '#3b1f2b' }}>{String.fromCharCode(65 + oi)}.</strong> {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.82rem' }} onClick={() => handleOpenEdit(q)}>
                      Edit
                    </button>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.82rem', color: '#c2185b' }} onClick={() => setDeleteConfirm(q)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">🗄️</div>
          <h3>Question bank is empty</h3>
          <p>Start building your reusable assessment repository.</p>
          <button className="btn-primary" onClick={handleOpenCreate} style={{ marginTop: 12 }}>
            ➕ Create First Question
          </button>
        </div>
      )}

      {/* Create / Edit Question Modal */}
      {isFormOpen && (
        <div className="auth-modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <button className="auth-modal-close" onClick={() => setIsFormOpen(false)}>×</button>

            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge">
                <span>📝</span> {editingQuestion ? 'Edit Question' : 'New MCQ Question'}
              </div>
              <h2 className="diff-modal-title">
                {editingQuestion ? 'Update Question Bank Item' : 'Author New Question'}
              </h2>
            </div>

            <form onSubmit={handleSave} className="admin-form" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
              {/* Question Text */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Question Statement *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What is the output of the following code?"
                  className="form-input"
                  style={{ resize: 'vertical' }}
                  value={form.question_text}
                  onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                />
              </div>

              {/* Code Snippet */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Code Snippet (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Paste code here if this is a code-output question..."
                  className="form-input"
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  value={form.code_snippet}
                  onChange={(e) => setForm({ ...form, code_snippet: e.target.value })}
                />
              </div>

              {/* Four Options */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Answer Options * (Exactly 4 required)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                        fontWeight: 700, color: form.correct_option_index === idx ? '#2e7d32' : '#9a8a90', fontSize: '0.85rem',
                      }}>
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className="form-input"
                        style={{
                          paddingLeft: 34,
                          borderColor: form.correct_option_index === idx ? '#2e7d32' : undefined,
                          background: form.correct_option_index === idx ? '#f1f8e9' : undefined,
                        }}
                        value={form.options[idx]}
                        onChange={(e) => updateOption(idx, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Correct Answer & Marks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Correct Answer *</label>
                  <select
                    className="form-input"
                    value={form.correct_option_index}
                    onChange={(e) => setForm({ ...form, correct_option_index: Number(e.target.value) })}
                  >
                    <option value={0}>A — {form.options[0].slice(0, 20) || 'Option A'}</option>
                    <option value={1}>B — {form.options[1].slice(0, 20) || 'Option B'}</option>
                    <option value={2}>C — {form.options[2].slice(0, 20) || 'Option C'}</option>
                    <option value={3}>D — {form.options[3].slice(0, 20) || 'Option D'}</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Marks *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    className="form-input"
                    value={form.marks}
                    onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Difficulty *</label>
                  <select
                    className="form-input"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  >
                    <option value="easy">🌱 Easy</option>
                    <option value="medium">⚡ Medium</option>
                    <option value="hard">🔥 Hard</option>
                  </select>
                </div>
              </div>

              {/* Subject, Quiz, Topic */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Subject</label>
                  <select className="form-input" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                    <option value="">— No Subject —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Link to Quiz</label>
                  <select className="form-input" value={form.quiz_id} onChange={(e) => setForm({ ...form, quiz_id: e.target.value })}>
                    <option value="">— Standalone (Bank Only) —</option>
                    {quizzes.map((qz) => (
                      <option key={qz.id} value={qz.id}>{qz.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Topic Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Linked Lists"
                    className="form-input"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  />
                </div>
              </div>

              {/* Explanation */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Answer Explanation (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Explain why the correct answer is right — shown to students post-quiz during review."
                  className="form-input"
                  style={{ resize: 'vertical' }}
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingQuestion ? 'Update Question ✓' : 'Create Question +'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="auth-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge" style={{ background: '#fce4ec', color: '#c2185b' }}>
                <span>⚠️</span> Confirm Deletion
              </div>
              <h2 className="diff-modal-title">Delete Question</h2>
            </div>
            <p style={{ color: '#5e4a52', marginBottom: 20 }}>
              Permanently delete: <strong>{deleteConfirm.question_text?.slice(0, 80)}...</strong>?
              This will also remove its answer key.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ background: '#c2185b', borderColor: '#c2185b' }} disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
