import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function QuizRunnerModal({
  quiz,
  selectedDifficulty = 'medium',
  onClose,
  onQuizCompleted,
}) {
  const [attemptId, setAttemptId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`brainvash_answers_${quiz.id}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [markedQuestions, setMarkedQuestions] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`brainvash_marked_${quiz.id}`)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [timeLeft, setTimeLeft] = useState((quiz.time_limit_minutes || 15) * 60)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const timerRef = useRef(null)

  // Persist answers to sessionStorage for page refresh recovery
  useEffect(() => {
    try {
      if (Object.keys(answers).length > 0) {
        sessionStorage.setItem(`brainvash_answers_${quiz.id}`, JSON.stringify(answers))
      } else {
        sessionStorage.removeItem(`brainvash_answers_${quiz.id}`)
      }
    } catch {
      // ignore
    }
  }, [answers, quiz.id])

  // Persist marked questions to sessionStorage
  useEffect(() => {
    try {
      if (markedQuestions.size > 0) {
        sessionStorage.setItem(`brainvash_marked_${quiz.id}`, JSON.stringify(Array.from(markedQuestions)))
      } else {
        sessionStorage.removeItem(`brainvash_marked_${quiz.id}`)
      }
    } catch {
      // ignore
    }
  }, [markedQuestions, quiz.id])

  const cleanupSessionStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(`brainvash_answers_${quiz.id}`)
      sessionStorage.removeItem(`brainvash_marked_${quiz.id}`)
    } catch {
      // ignore
    }
  }, [quiz.id])

  const diffColors = {
    easy: { text: '#2e7d32', bg: '#e8f5e9', border: '#a5d6a7', label: 'Easy' },
    medium: { text: '#d84315', bg: '#fbe9e7', border: '#ffab91', label: 'Medium' },
    hard: { text: '#c2185b', bg: '#fce4ec', border: '#f48fb1', label: 'Hard' },
  }
  const currentDiff = diffColors[selectedDifficulty] || diffColors.medium

  // Start attempt and fetch questions
  useEffect(() => {
    let isMounted = true

    const initQuiz = async () => {
      setLoading(true)
      setError('')
      try {
        // 1. Call start_quiz_attempt RPC (Try 2-param signature first, fallback to 1-param for Phase 1 compatibility)
        let attemptResult = null
        const res2 = await supabase.rpc('start_quiz_attempt', {
          p_quiz_id: quiz.id,
          p_difficulty: selectedDifficulty || 'medium',
        })

        if (!res2.error) {
          attemptResult = res2.data
        } else {
          // If RPC failed due to argument count mismatch, retry with single argument
          const res1 = await supabase.rpc('start_quiz_attempt', {
            p_quiz_id: quiz.id,
          })
          if (res1.error) {
            throw new Error(res2.error?.message || res1.error.message)
          }
          attemptResult = res1.data
        }

        if (isMounted) {
          setAttemptId(attemptResult?.attempt_id || attemptResult?.id)
        }

        // 2. Fetch questions: First query reusable quiz_questions junction table
        let loadedQuestions = []

        try {
          const { data: qqData } = await supabase
            .from('quiz_questions')
            .select(`
              order_index,
              questions (
                id,
                quiz_id,
                question_text,
                question_type,
                code_snippet,
                options,
                marks,
                difficulty,
                order_index
              )
            `)
            .eq('quiz_id', quiz.id)
            .order('order_index', { ascending: true })

          if (qqData && qqData.length > 0) {
            loadedQuestions = qqData
              .map((row) => row.questions)
              .filter(Boolean)
          }
        } catch (qqErr) {
          console.warn('[BrainVash] quiz_questions fetch notice:', qqErr.message)
        }

        // If junction table yielded no questions, fallback to questions directly linked via quiz_id
        if (loadedQuestions.length === 0) {
          const fullRes = await supabase
            .from('questions')
            .select('id, quiz_id, question_text, question_type, code_snippet, options, marks, difficulty, order_index')
            .eq('quiz_id', quiz.id)
            .order('order_index', { ascending: true })

          if (!fullRes.error) {
            loadedQuestions = fullRes.data || []
          } else {
            // Fallback for Phase 1 schema without difficulty column
            const baseRes = await supabase
              .from('questions')
              .select('id, quiz_id, question_text, question_type, code_snippet, options, marks, order_index')
              .eq('quiz_id', quiz.id)
              .order('order_index', { ascending: true })

            if (baseRes.error) {
              throw new Error(baseRes.error.message)
            }
            loadedQuestions = baseRes.data || []
          }
        }

        // Filter strictly by the selected difficulty level
        const filteredByDiff = loadedQuestions.filter(
          (q) => (q.difficulty || '').toLowerCase() === selectedDifficulty.toLowerCase()
        )

        // If specific difficulty questions exist, use them. If none match (legacy quiz questions without tags), use all.
        const finalQuestions = filteredByDiff.length > 0 ? filteredByDiff : loadedQuestions

        if (isMounted) {
          setQuestions(finalQuestions)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to start quiz session.')
          setLoading(false)
        }
      }
    }

    initQuiz()

    return () => {
      isMounted = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [quiz.id, quiz.time_limit_minutes, selectedDifficulty])

  // Submit quiz function
  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitting) return
    setSubmitting(true)
    setError('')
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      // Format payload for submit_quiz_attempt RPC:
      // p_answers: Array of { question_id, selected_option_index, time_spent_seconds }
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        selected_option_index: answers[q.id] !== undefined ? answers[q.id] : null,
        time_spent_seconds: 0,
      }))

      const { data, error: submitError } = await supabase.rpc(
        'submit_quiz_attempt',
        {
          p_attempt_id: attemptId,
          p_answers: formattedAnswers,
        }
      )

      if (submitError) {
        throw new Error(submitError.message)
      }

      cleanupSessionStorage()
      setResult(data)
      if (onQuizCompleted) {
        onQuizCompleted()
      }
    } catch (err) {
      setError(err.message || 'Error submitting quiz.')
    } finally {
      setSubmitting(false)
    }
  }, [attemptId, submitting, questions, answers, onQuizCompleted, cleanupSessionStorage])

  const handleExit = useCallback(() => {
    cleanupSessionStorage()
    onClose()
  }, [cleanupSessionStorage, onClose])

  // Timer countdown
  useEffect(() => {
    if (loading || result || !questions.length) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loading, result, questions.length, handleSubmit])

  const selectOption = (questionId, optionIdx) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }))
  }

  const clearCurrentResponse = (questionId) => {
    setAnswers((prev) => {
      const copy = { ...prev }
      delete copy[questionId]
      return copy
    })
  }

  const toggleMarkForReview = (questionId) => {
    setMarkedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Result View
  if (result) {
    return (
      <div className="modal-overlay">
        <div className="modal dash-runner-modal" onClick={(e) => e.stopPropagation()}>
          <div className="dash-runner-result-box">
            <div className="dash-result-trophy">
              {result.status === 'completed' ? '🎉' : '⏱️'}
            </div>
            <h2>
              {result.status === 'completed'
                ? 'Quiz Completed!'
                : 'Quiz Attempt Closed'}
            </h2>
            <p className="modal-desc">
              {result.message || 'Your answers were securely graded on the server.'}
            </p>

            <div className="dash-review-score-grid" style={{ margin: '24px 0' }}>
              <div className="dash-review-stat">
                <span className="stat-label">Difficulty</span>
                <span
                  className="stat-value"
                  style={{ color: currentDiff.text, textTransform: 'capitalize' }}
                >
                  {result.selected_difficulty || selectedDifficulty}
                </span>
              </div>
              <div className="dash-review-stat">
                <span className="stat-label">Score</span>
                <span className="stat-value">{result.score ?? 0} pts</span>
              </div>
              <div className="dash-review-stat">
                <span className="stat-label">Accuracy</span>
                <span className="stat-value">{result.accuracy_percentage ?? 0}%</span>
              </div>
              <div className="dash-review-stat">
                <span className="stat-label">Time</span>
                <span className="stat-value">{result.time_taken_seconds ?? 0}s</span>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleExit}
            >
              Back to Dashboard →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay">
      <div className="modal dash-runner-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header with Title, Difficulty Badge, and Live Timer */}
        <div className="dash-runner-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="dash-welcome-badge">{quiz.subjects?.name || 'Quiz'}</span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: currentDiff.text,
                  background: currentDiff.bg,
                  border: `1px solid ${currentDiff.border}`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {currentDiff.label} Tier
              </span>
            </div>
            <h2 className="dash-runner-title">{quiz.title}</h2>
          </div>

          <div className="dash-runner-timer-box">
            <span className="timer-icon">⏱️</span>
            <span className={`timer-text ${timeLeft < 180 ? 'timer-warning' : ''}`}>
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="dash-review-loading">
            <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
            <p>Starting secure session and loading {selectedDifficulty} questions...</p>
          </div>
        ) : error ? (
          <div className="auth-message auth-error" style={{ margin: '24px 0' }}>
            <p>{error}</p>
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={handleExit}>
              Close
            </button>
          </div>
        ) : questions.length === 0 ? (
          <div className="dash-empty-state-mini" style={{ margin: '24px 0' }}>
            <div className="dash-empty-icon">📝</div>
            <h3>No questions found for {selectedDifficulty} tier</h3>
            <p>This quiz does not currently have any active questions at this difficulty level.</p>
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={handleExit}>
              Return to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Question Palette / Indicator */}
            <div className="dash-runner-palette">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined
                const isCurrent = idx === currentIdx
                const isMarked = markedQuestions.has(q.id)
                return (
                  <button
                    key={q.id}
                    className={`palette-dot ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''} ${isMarked ? 'flagged' : ''}`}
                    onClick={() => setCurrentIdx(idx)}
                    title={`Question ${idx + 1}${isAnswered ? ' (Answered)' : ' (Unanswered)'}${isMarked ? ' (Marked for Review)' : ''}`}
                  >
                    {idx + 1}
                    {isMarked && <span style={{ fontSize: '0.65rem', marginLeft: 1 }}>🚩</span>}
                  </button>
                )
              })}
            </div>

            {/* Current Question */}
            {questions[currentIdx] && (
              <div className="dash-runner-question-card">
                <div className="dash-runner-q-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="q-index-badge">
                      Question {currentIdx + 1} of {questions.length}
                    </span>
                    {markedQuestions.has(questions[currentIdx].id) && (
                      <span style={{ fontSize: '0.72rem', background: '#ede7f6', color: '#512da8', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                        🚩 Marked for Review
                      </span>
                    )}
                  </div>
                  <span className="q-marks-badge">
                    {questions[currentIdx].marks} Marks
                  </span>
                </div>

                <div className="dash-runner-q-text">
                  {questions[currentIdx].question_text}
                </div>

                {questions[currentIdx].code_snippet && (
                  <pre className="dash-review-code">
                    <code>{questions[currentIdx].code_snippet}</code>
                  </pre>
                )}

                {/* Options List */}
                <div className="dash-runner-options">
                  {Array.isArray(questions[currentIdx].options) &&
                    questions[currentIdx].options.map((opt, optIdx) => {
                      const isSelected = answers[questions[currentIdx].id] === optIdx
                      return (
                        <div
                          key={optIdx}
                          className={`dash-runner-opt ${isSelected ? 'selected' : ''}`}
                          onClick={() => selectOption(questions[currentIdx].id, optIdx)}
                        >
                          <span className="dash-runner-opt-radio">
                            {isSelected ? '●' : '○'}
                          </span>
                          <span className="dash-runner-opt-char">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span className="dash-runner-opt-text">{opt}</span>
                        </div>
                      )
                    })}
                </div>

                {/* Question Toolbar: Clear Response & Mark for Review */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3e0d5' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    disabled={answers[questions[currentIdx].id] === undefined}
                    onClick={() => clearCurrentResponse(questions[currentIdx].id)}
                    title="Clear selected option for this question"
                  >
                    Clear Response
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '4px 10px',
                      background: markedQuestions.has(questions[currentIdx].id) ? '#ede7f6' : undefined,
                      color: markedQuestions.has(questions[currentIdx].id) ? '#512da8' : undefined,
                    }}
                    onClick={() => toggleMarkForReview(questions[currentIdx].id)}
                  >
                    {markedQuestions.has(questions[currentIdx].id) ? '🚩 Unmark Review' : '🏳️ Mark for Review'}
                  </button>
                </div>
              </div>
            )}

            {/* Footer Navigation */}
            <div className="dash-runner-footer">
              <button
                className="btn-secondary"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              >
                ← Previous
              </button>

              <div style={{ display: 'flex', gap: 12 }}>
                {currentIdx < questions.length - 1 && (
                  <button
                    className="btn-secondary"
                    onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                  >
                    Next →
                  </button>
                )}

                <button
                  className="btn-primary"
                  disabled={submitting}
                  onClick={() => setShowSubmitConfirm(true)}
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment ✓'}
                </button>
              </div>
            </div>

            {/* Submit Confirmation Modal */}
            {showSubmitConfirm && (
              <div className="auth-modal-overlay" onClick={() => setShowSubmitConfirm(false)}>
                <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                  <div className="diff-modal-header" style={{ marginBottom: 14 }}>
                    <div className="diff-header-badge">
                      <span>🎯</span> Confirm Assessment Submission
                    </div>
                    <h2 className="diff-modal-title">Ready to Submit?</h2>
                  </div>

                  <div style={{ background: '#faf5ef', border: '1px solid #f3e0d5', borderRadius: 8, padding: '14px 16px', marginBottom: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '0.88rem' }}>
                      <div>Total Questions: <strong>{questions.length}</strong></div>
                      <div>Answered: <strong style={{ color: '#2e7d32' }}>{Object.keys(answers).length}</strong></div>
                      <div>Unanswered: <strong style={{ color: questions.length - Object.keys(answers).length > 0 ? '#c2185b' : '#2e7d32' }}>
                        {questions.length - Object.keys(answers).length}
                      </strong></div>
                      <div>Marked for Review: <strong style={{ color: '#512da8' }}>{markedQuestions.size}</strong></div>
                    </div>
                  </div>

                  {questions.length - Object.keys(answers).length > 0 && (
                    <p style={{ color: '#c2185b', fontSize: '0.85rem', marginBottom: 16 }}>
                      ⚠️ You have {questions.length - Object.keys(answers).length} unanswered question(s). Are you sure you want to proceed?
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowSubmitConfirm(false)}
                    >
                      Review Answers
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={submitting}
                      onClick={() => {
                        setShowSubmitConfirm(false)
                        handleSubmit()
                      }}
                    >
                      {submitting ? 'Submitting...' : 'Yes, Submit Now ✓'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
