
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function QuizRunnerModal({
  quiz,
  selectedDifficulty = 'medium',
  onClose,
  onQuizCompleted,
}) {
  const difficulty = (selectedDifficulty || 'medium').toLowerCase().trim()

  const [attemptId, setAttemptId] = useState(null)
  const [attemptDeadline, setAttemptDeadline] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [markedQuestions, setMarkedQuestions] = useState(new Set())
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [availableDiffs, setAvailableDiffs] = useState([])

  const timerRef = useRef(null)
  const submittingRef = useRef(false)

  const diffColors = {
    easy: {
      text: '#2e7d32',
      bg: '#e8f5e9',
      border: '#a5d6a7',
      label: 'Easy',
    },
    medium: {
      text: '#d84315',
      bg: '#fbe9e7',
      border: '#ffab91',
      label: 'Medium',
    },
    hard: {
      text: '#c2185b',
      bg: '#fce4ec',
      border: '#f48fb1',
      label: 'Hard',
    },
  }

  const currentDiff = diffColors[difficulty] || diffColors.medium

  // Restore saved answers and marked questions.
  useEffect(() => {
    try {
      const savedAnswers = sessionStorage.getItem(
        `brainvash_answers_${quiz.id}`
      )
      const savedMarked = sessionStorage.getItem(
        `brainvash_marked_${quiz.id}`
      )

      setAnswers(savedAnswers ? JSON.parse(savedAnswers) : {})
      setMarkedQuestions(
        savedMarked ? new Set(JSON.parse(savedMarked)) : new Set()
      )
    } catch {
      setAnswers({})
      setMarkedQuestions(new Set())
    }
  }, [quiz.id])

  // Persist answers.
  useEffect(() => {
    try {
      if (Object.keys(answers).length > 0) {
        sessionStorage.setItem(
          `brainvash_answers_${quiz.id}`,
          JSON.stringify(answers)
        )
      } else {
        sessionStorage.removeItem(`brainvash_answers_${quiz.id}`)
      }
    } catch {
      // Ignore storage errors.
    }
  }, [answers, quiz.id])

  // Persist marked questions.
  useEffect(() => {
    try {
      if (markedQuestions.size > 0) {
        sessionStorage.setItem(
          `brainvash_marked_${quiz.id}`,
          JSON.stringify(Array.from(markedQuestions))
        )
      } else {
        sessionStorage.removeItem(`brainvash_marked_${quiz.id}`)
      }
    } catch {
      // Ignore storage errors.
    }
  }, [markedQuestions, quiz.id])

  const cleanupSessionStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(`brainvash_answers_${quiz.id}`)
      sessionStorage.removeItem(`brainvash_marked_${quiz.id}`)
    } catch {
      // Ignore storage errors.
    }
  }, [quiz.id])

  // Load questions and initialize the quiz attempt.
  useEffect(() => {
    let isMounted = true

    const initQuiz = async () => {
      setLoading(true)
      setError('')
      setQuestions([])
      setAttemptId(null)
      setAttemptDeadline(null)
      setTimeLeft(0)

      try {
        if (!quiz?.id) {
          throw new Error('Quiz ID is missing.')
        }

        const questionColumns =
          'id, quiz_id, question_text, question_type, code_snippet, options, marks, difficulty, order_index'

        let directQuestions = []
        let junctionQuestions = []
        let directError = null
        let junctionError = null

        // 1. Fetch questions directly linked through questions.quiz_id.
        const directResult = await supabase
          .from('questions')
          .select(questionColumns)
          .eq('quiz_id', quiz.id)
          .order('order_index', { ascending: true })

        if (directResult.error) {
          directError = directResult.error
          console.error(
            '[BrainVash] Direct question query failed:',
            directError
          )
        } else {
          directQuestions = directResult.data || []
        }

        // 2. Fetch reusable question assignments through quiz_questions.
        const junctionResult = await supabase
          .from('quiz_questions')
          .select('question_id, order_index')
          .eq('quiz_id', quiz.id)
          .order('order_index', { ascending: true })

        if (junctionResult.error) {
          junctionError = junctionResult.error
          console.error(
            '[BrainVash] Quiz assignment query failed:',
            junctionError
          )
        } else if (
          junctionResult.data &&
          junctionResult.data.length > 0
        ) {
          const assignmentRows = junctionResult.data
          const questionIds = assignmentRows
            .map((row) => row.question_id)
            .filter(Boolean)

          if (questionIds.length > 0) {
            const questionResult = await supabase
              .from('questions')
              .select(questionColumns)
              .in('id', questionIds)

            if (questionResult.error) {
              console.error(
                '[BrainVash] Assigned question fetch failed:',
                questionResult.error
              )
              throw new Error(
                `Could not load assigned questions: ${questionResult.error.message}`
              )
            }

            const orderMap = new Map(
              assignmentRows.map((row) => [
                row.question_id,
                row.order_index,
              ])
            )

            junctionQuestions = (questionResult.data || []).map((q) => ({
              ...q,
              order_index:
                orderMap.get(q.id) ?? q.order_index ?? 0,
            }))
          }
        }

        // If both query paths failed, show the real database error.
        if (directError && junctionError) {
          throw new Error(
            `Question loading failed. Direct query: ${directError.message}. Assignment query: ${junctionError.message}`
          )
        }

        // 3. Merge both sources without duplicate question IDs.
        const questionMap = new Map()

        for (const q of directQuestions) {
          if (q?.id) questionMap.set(q.id, q)
        }

        for (const q of junctionQuestions) {
          if (q?.id) {
            questionMap.set(q.id, {
              ...questionMap.get(q.id),
              ...q,
            })
          }
        }

        const allQuestions = Array.from(questionMap.values())

        // 4. Find available difficulty levels.
        const distinctDifficulties = Array.from(
          new Set(
            allQuestions
              .map((q) =>
                (q.difficulty || 'medium').toLowerCase().trim()
              )
              .filter(Boolean)
          )
        )

        // 5. Strictly filter by selected difficulty.
        const filteredQuestions = allQuestions
          .filter(
            (q) =>
              (q.difficulty || 'medium').toLowerCase().trim() ===
              difficulty
          )
          .sort(
            (a, b) =>
              (a.order_index ?? 0) - (b.order_index ?? 0)
          )

        if (!isMounted) return

        setAvailableDiffs(distinctDifficulties)

        if (filteredQuestions.length === 0) {
          setQuestions([])
          setLoading(false)

          if (allQuestions.length === 0) {
            throw new Error(
              'No questions are linked to this quiz. Check the quiz assignment in Admin Panel.'
            )
          }

          return
        }

        // Validate question options before starting the attempt.
        const invalidQuestion = filteredQuestions.find(
          (q) =>
            !Array.isArray(q.options) ||
            q.options.length < 2 ||
            !q.question_text
        )

        if (invalidQuestion) {
          throw new Error(
            `Question ${invalidQuestion.id} has missing question text or options. Please check it in Question Bank.`
          )
        }

        // 6. Create the attempt only after questions are available.
        let attemptResult = null

        const startResult = await supabase.rpc(
          'start_quiz_attempt',
          {
            p_quiz_id: quiz.id,
            p_difficulty: difficulty,
          }
        )

        if (!startResult.error) {
          attemptResult = startResult.data
        } else {
          const message = startResult.error.message || ''
          const isArgumentMismatch =
            startResult.error.code === '42883' ||
            (message.includes('function') &&
              (message.includes('does not exist') ||
                message.includes('argument')))

          if (!isArgumentMismatch) {
            throw new Error(message)
          }

          // Compatibility with the older one-argument RPC.
          const fallbackResult = await supabase.rpc(
            'start_quiz_attempt',
            { p_quiz_id: quiz.id }
          )

          if (fallbackResult.error) {
            throw new Error(fallbackResult.error.message)
          }

          attemptResult = fallbackResult.data
        }

        const activeAttemptId =
          attemptResult?.attempt_id ||
          attemptResult?.id ||
          (Array.isArray(attemptResult)
            ? attemptResult[0]?.attempt_id ||
            attemptResult[0]?.id
            : null)

        if (!activeAttemptId) {
          throw new Error(
            'Quiz session could not be created. Please try again.'
          )
        }

        // 7. Read server start time to establish a stable deadline.
        const attemptRead = await supabase
          .from('quiz_attempts')
          .select('started_at')
          .eq('id', activeAttemptId)
          .single()

        if (attemptRead.error || !attemptRead.data?.started_at) {
          throw new Error(
            attemptRead.error?.message ||
            'Could not verify the quiz start time.'
          )
        }

        const durationMs =
          (quiz.time_limit_minutes || 15) * 60 * 1000

        const deadline = new Date(
          new Date(attemptRead.data.started_at).getTime() +
          durationMs
        )

        if (!isMounted) return

        setAttemptId(activeAttemptId)
        setAttemptDeadline(deadline.toISOString())
        setTimeLeft(
          Math.max(
            0,
            Math.ceil((deadline.getTime() - Date.now()) / 1000)
          )
        )
        setQuestions(filteredQuestions)
        setCurrentIdx(0)
        setLoading(false)
      } catch (err) {
        console.error('[BrainVash] Quiz initialization error:', err)

        if (isMounted) {
          setError(
            err.message || 'Failed to start quiz session.'
          )
          setLoading(false)
        }
      }
    }

    initQuiz()

    return () => {
      isMounted = false

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [quiz.id, quiz.time_limit_minutes, difficulty])

  // Submit quiz.
  const handleSubmit = useCallback(async () => {
    if (
      !attemptId ||
      !questions.length ||
      submittingRef.current
    ) {
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setError('')

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    try {
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        selected_option_index:
          answers[q.id] !== undefined ? answers[q.id] : null,
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

      if (!data) {
        throw new Error(
          'The server returned an empty submission result.'
        )
      }

      cleanupSessionStorage()
      setResult(data)

      if (onQuizCompleted) {
        onQuizCompleted()
      }
    } catch (err) {
      console.error('[BrainVash] Quiz submission error:', err)
      setError(err.message || 'Error submitting quiz.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [
    attemptId,
    questions,
    answers,
    cleanupSessionStorage,
    onQuizCompleted,
  ])

  // Timer runs only after the quiz is ready.
  useEffect(() => {
    if (
      loading ||
      error ||
      result ||
      !questions.length ||
      !attemptDeadline
    ) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(attemptDeadline).getTime() - Date.now()) /
          1000
        )
      )

      setTimeLeft(remaining)

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        handleSubmit()
      }
    }

    updateTimer()
    timerRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [
    loading,
    error,
    result,
    questions.length,
    attemptDeadline,
    handleSubmit,
  ])

  const handleExit = useCallback(() => {
    if (submittingRef.current) return

    cleanupSessionStorage()
    onClose()
  }, [cleanupSessionStorage, onClose])

  const selectOption = (questionId, optionIdx) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }))
  }

  const clearCurrentResponse = (questionId) => {
    setAnswers((prev) => {
      const updated = { ...prev }
      delete updated[questionId]
      return updated
    })
  }

  const toggleMarkForReview = (questionId) => {
    setMarkedQuestions((prev) => {
      const updated = new Set(prev)

      if (updated.has(questionId)) {
        updated.delete(questionId)
      } else {
        updated.add(questionId)
      }

      return updated
    })
  }

  const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`
  }

  const answeredCount = questions.reduce(
    (count, question) =>
      count +
      (answers[question.id] !== undefined ? 1 : 0),
    0
  )

  const unansweredCount = Math.max(
    0,
    questions.length - answeredCount
  )

  // Result screen.
  if (result) {
    return (
      <div className="modal-overlay">
        <div
          className="modal dash-runner-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dash-runner-result-box">
            <div className="dash-result-trophy">
              {result.status === 'completed' ? '🎉' : '⏱️'}
            </div>

            <h2>
              {result.status === 'completed'
                ? 'Quiz Completed!'
                : 'Quiz Attempt Submitted'}
            </h2>

            <p className="modal-desc">
              {result.message ||
                'Your answers were submitted for evaluation.'}
            </p>

            <div
              className="dash-review-score-grid"
              style={{ margin: '24px 0' }}
            >
              <div className="dash-review-stat">
                <span className="stat-label">Difficulty</span>
                <span
                  className="stat-value"
                  style={{
                    color: currentDiff.text,
                    textTransform: 'capitalize',
                  }}
                >
                  {result.selected_difficulty || difficulty}
                </span>
              </div>

              <div className="dash-review-stat">
                <span className="stat-label">Score</span>
                <span className="stat-value">
                  {result.score ?? 0} pts
                </span>
              </div>

              <div className="dash-review-stat">
                <span className="stat-label">Accuracy</span>
                <span className="stat-value">
                  {result.accuracy_percentage ?? 0}%
                </span>
              </div>

              <div className="dash-review-stat">
                <span className="stat-label">Time</span>
                <span className="stat-value">
                  {result.time_taken_seconds ?? 0}s
                </span>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
              }}
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
      <div
        className="modal dash-runner-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dash-runner-header">
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span className="dash-welcome-badge">
                {quiz.subjects?.name || 'Quiz'}
              </span>

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

            <h2 className="dash-runner-title">
              {quiz.title}
            </h2>
          </div>

          {!loading &&
            !error &&
            questions.length > 0 &&
            attemptDeadline && (
              <div className="dash-runner-timer-box">
                <span className="timer-icon">⏱️</span>
                <span
                  className={`timer-text ${timeLeft < 180 ? 'timer-warning' : ''
                    }`}
                >
                  {formatTimer(timeLeft)}
                </span>
              </div>
            )}
        </div>

        {loading ? (
          <div className="dash-review-loading">
            <span
              className="spinner"
              style={{
                borderColor: 'rgba(232, 99, 74, 0.3)',
                borderTopColor: '#e8634a',
              }}
            />
            <p>Loading quiz questions...</p>
          </div>
        ) : error ? (
          <div
            className="auth-message auth-error"
            style={{ margin: '24px 0' }}
          >
            <p>{error}</p>
            <button
              className="btn-secondary"
              style={{ marginTop: 12 }}
              onClick={handleExit}
            >
              Return to Dashboard
            </button>
          </div>
        ) : questions.length === 0 ? (
          <div
            className="dash-empty-state-mini"
            style={{ margin: '24px 0' }}
          >
            <div className="dash-empty-icon">📝</div>

            <h3>
              No {currentDiff.label} Questions Available
            </h3>

            <p>
              This quiz does not currently have any active
              questions configured for {currentDiff.label}{' '}
              difficulty.
            </p>

            {availableDiffs.length > 0 ? (
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  marginTop: 8,
                }}
              >
                Available difficulty levels:{' '}
                <strong>
                  {availableDiffs
                    .map(
                      (item) =>
                        item.charAt(0).toUpperCase() +
                        item.slice(1)
                    )
                    .join(', ')}
                </strong>
              </p>
            ) : (
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  marginTop: 8,
                }}
              >
                No active questions have been assigned to this
                quiz yet.
              </p>
            )}

            <button
              className="btn-secondary"
              style={{ marginTop: 16 }}
              onClick={handleExit}
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Question Palette */}
            <div className="dash-runner-palette">
              {questions.map((question, idx) => {
                const isAnswered =
                  answers[question.id] !== undefined
                const isCurrent = idx === currentIdx
                const isMarked = markedQuestions.has(question.id)

                return (
                  <button
                    key={question.id}
                    className={`palette-dot ${isCurrent ? 'current' : ''
                      } ${isAnswered ? 'answered' : ''} ${isMarked ? 'flagged' : ''
                      }`}
                    onClick={() => setCurrentIdx(idx)}
                    title={`Question ${idx + 1}`}
                  >
                    {idx + 1}
                    {isMarked && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          marginLeft: 1,
                        }}
                      >
                        🚩
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Current Question */}
            {questions[currentIdx] && (
              <div className="dash-runner-question-card">
                <div className="dash-runner-q-top">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span className="q-index-badge">
                      Question {currentIdx + 1} of{' '}
                      {questions.length}
                    </span>

                    {markedQuestions.has(
                      questions[currentIdx].id
                    ) && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            background: '#ede7f6',
                            color: '#512da8',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontWeight: 700,
                          }}
                        >
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
                    <code>
                      {questions[currentIdx].code_snippet}
                    </code>
                  </pre>
                )}

                {/* Options */}
                <div className="dash-runner-options">
                  {Array.isArray(
                    questions[currentIdx].options
                  ) &&
                    questions[currentIdx].options.map(
                      (option, optIdx) => {
                        const isSelected =
                          answers[questions[currentIdx].id] ===
                          optIdx

                        const optionLabel =
                          typeof option === 'string'
                            ? option
                            : option?.label ?? option?.text ?? ''

                        return (
                          <div
                            key={optIdx}
                            className={`dash-runner-opt ${isSelected ? 'selected' : ''
                              }`}
                            onClick={() =>
                              selectOption(
                                questions[currentIdx].id,
                                optIdx
                              )
                            }
                          >
                            <span className="dash-runner-opt-radio">
                              {isSelected ? '●' : '○'}
                            </span>

                            <span className="dash-runner-opt-char">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>

                            <span className="dash-runner-opt-text">
                              {optionLabel}
                            </span>
                          </div>
                        )
                      }
                    )}
                </div>

                {/* Question Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: '1px solid #f3e0d5',
                  }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '4px 10px',
                    }}
                    disabled={
                      answers[questions[currentIdx].id] ===
                      undefined
                    }
                    onClick={() =>
                      clearCurrentResponse(
                        questions[currentIdx].id
                      )
                    }
                  >
                    Clear Response
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '4px 10px',
                      background: markedQuestions.has(
                        questions[currentIdx].id
                      )
                        ? '#ede7f6'
                        : undefined,
                      color: markedQuestions.has(
                        questions[currentIdx].id
                      )
                        ? '#512da8'
                        : undefined,
                    }}
                    onClick={() =>
                      toggleMarkForReview(
                        questions[currentIdx].id
                      )
                    }
                  >
                    {markedQuestions.has(
                      questions[currentIdx].id
                    )
                      ? '🚩 Unmark Review'
                      : '🏳️ Mark for Review'}
                  </button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="dash-runner-footer">
              <button
                className="btn-secondary"
                disabled={currentIdx === 0}
                onClick={() =>
                  setCurrentIdx((prev) =>
                    Math.max(0, prev - 1)
                  )
                }
              >
                ← Previous
              </button>

              <div style={{ display: 'flex', gap: 12 }}>
                {currentIdx < questions.length - 1 && (
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      setCurrentIdx((prev) =>
                        Math.min(
                          questions.length - 1,
                          prev + 1
                        )
                      )
                    }
                  >
                    Next →
                  </button>
                )}

                <button
                  className="btn-primary"
                  disabled={submitting}
                  onClick={() => setShowSubmitConfirm(true)}
                >
                  {submitting
                    ? 'Submitting...'
                    : 'Submit Assessment ✓'}
                </button>
              </div>
            </div>

            {/* Submission Confirmation */}
            {showSubmitConfirm && (
              <div
                className="auth-modal-overlay"
                onClick={() => setShowSubmitConfirm(false)}
              >
                <div
                  className="auth-modal-card"
                  onClick={(e) => e.stopPropagation()}
                  style={{ maxWidth: 480 }}
                >
                  <div
                    className="diff-modal-header"
                    style={{ marginBottom: 14 }}
                  >
                    <div className="diff-header-badge">
                      <span>🎯</span> Confirm Assessment
                      Submission
                    </div>

                    <h2 className="diff-modal-title">
                      Ready to Submit?
                    </h2>
                  </div>

                  <div
                    style={{
                      background: '#faf5ef',
                      border: '1px solid #f3e0d5',
                      borderRadius: 8,
                      padding: '14px 16px',
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px 12px',
                        fontSize: '0.88rem',
                      }}
                    >
                      <div>
                        Total Questions:{' '}
                        <strong>{questions.length}</strong>
                      </div>

                      <div>
                        Answered:{' '}
                        <strong style={{ color: '#2e7d32' }}>
                          {answeredCount}
                        </strong>
                      </div>

                      <div>
                        Unanswered:{' '}
                        <strong
                          style={{
                            color:
                              unansweredCount > 0
                                ? '#c2185b'
                                : '#2e7d32',
                          }}
                        >
                          {unansweredCount}
                        </strong>
                      </div>

                      <div>
                        Marked for Review:{' '}
                        <strong style={{ color: '#512da8' }}>
                          {markedQuestions.size}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {unansweredCount > 0 && (
                    <p
                      style={{
                        color: '#c2185b',
                        fontSize: '0.85rem',
                        marginBottom: 16,
                      }}
                    >
                      ⚠️ You have {unansweredCount} unanswered
                      question(s). Are you sure you want to
                      proceed?
                    </p>
                  )}

                  {error && (
                    <p className="auth-message auth-error">
                      {error}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setShowSubmitConfirm(false)
                      }
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
                      {submitting
                        ? 'Submitting...'
                        : 'Yes, Submit Now ✓'}
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
