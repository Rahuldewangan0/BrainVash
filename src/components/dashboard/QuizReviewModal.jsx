import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function QuizReviewModal({ attempt, onClose }) {
  const [reviewData, setReviewData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!attempt?.id || !supabase) return

    const loadReview = async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: rpcError } = await supabase.rpc('get_quiz_review', {
          p_attempt_id: attempt.id,
        })

        if (rpcError) {
          setError(rpcError.message)
        } else {
          setReviewData(data || [])
        }
      } catch (err) {
        setError(err.message || 'Failed to load quiz review.')
      } finally {
        setLoading(false)
      }
    }

    loadReview()
  }, [attempt])

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal dash-review-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="dash-review-header">
          <span className="dash-welcome-badge">QUIZ REVIEW</span>
          <h2>{attempt?.quizzes?.title || 'Quiz Result Summary'}</h2>
          <p className="modal-desc" style={{ marginBottom: 16 }}>
            Completed on {attempt?.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : 'Recent'}
          </p>

          {/* Result Score Banner */}
          <div className="dash-review-score-grid">
            <div className="dash-review-stat">
              <span className="stat-label">Final Score</span>
              <span className="stat-value">{attempt?.score} / {attempt?.total_marks}</span>
            </div>
            <div className="dash-review-stat">
              <span className="stat-label">Accuracy</span>
              <span className="stat-value">{attempt?.accuracy_percentage}%</span>
            </div>
            <div className="dash-review-stat">
              <span className="stat-label">Time Spent</span>
              <span className="stat-value">{formatTime(attempt?.time_taken_seconds)}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="dash-review-loading">
            <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
            <p>Fetching server-graded answer review...</p>
          </div>
        ) : error ? (
          <div className="auth-message auth-error" style={{ margin: '20px 0' }}>
            {error}
          </div>
        ) : reviewData.length > 0 ? (
          <div className="dash-review-questions-list">
            {reviewData.map((item, idx) => (
              <div
                key={item.question_id || idx}
                className={`dash-review-item ${item.is_correct ? 'item-correct' : 'item-incorrect'}`}
              >
                <div className="dash-review-q-top">
                  <span className="dash-q-num">Question {idx + 1}</span>
                  <span className={`dash-result-tag ${item.is_correct ? 'tag-correct' : item.selected_option_index === null ? 'tag-skipped' : 'tag-incorrect'}`}>
                    {item.is_correct
                      ? `✓ Correct (+ ${item.marks_awarded})`
                      : item.selected_option_index !== null && Number(item.marks_awarded) < 0
                        ? `✗ Incorrect (${item.marks_awarded})`
                        : item.selected_option_index === null
                          ? '○ Skipped (0 marks)'
                          : '✗ Incorrect (0 marks)'}
                  </span>
                </div>

                <div className="dash-review-q-text">{item.question_text}</div>

                {item.code_snippet && (
                  <pre className="dash-review-code">
                    <code>{item.code_snippet}</code>
                  </pre>
                )}

                {/* Options list */}
                <div className="dash-review-options">
                  {Array.isArray(item.options) &&
                    item.options.map((opt, optIdx) => {
                      const isSelected = optIdx === item.selected_option_index
                      const isCorrect = optIdx === item.correct_option_index

                      let optClass = 'dash-opt'
                      if (isCorrect) optClass += ' opt-correct'
                      if (isSelected && !isCorrect) optClass += ' opt-wrong'
                      if (isSelected) optClass += ' opt-selected'

                      return (
                        <div key={optIdx} className={optClass}>
                          <span className="dash-opt-idx">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="dash-opt-text">{opt}</span>
                          {isSelected && <span className="dash-opt-badge-user">Your Choice</span>}
                          {isCorrect && <span className="dash-opt-badge-correct">✓ Correct</span>}
                        </div>
                      )
                    })}
                </div>

                {item.explanation && (
                  <div className="dash-review-explanation">
                    <span className="exp-label">💡 Explanation:</span>
                    <p>{item.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty-state-mini" style={{ margin: '20px 0' }}>
            <p>No question breakdown available for this attempt.</p>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button className="btn-secondary" onClick={onClose}>
            Close Review
          </button>
        </div>
      </div>
    </div>
  )
}
