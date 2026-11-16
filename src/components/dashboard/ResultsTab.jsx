import { useState, useMemo } from 'react'

export default function ResultsTab({
  attempts,
  onViewResult,
  onNavigateTab,
}) {
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredAttempts = useMemo(() => {
    if (statusFilter === 'all') return attempts
    return attempts.filter((a) => a.status === statusFilter)
  }, [attempts, statusFilter])

  const formatDate = (isoString) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  return (
    <div className="dash-tab-container">
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">My Quiz Results</h1>
          <p className="dash-page-desc">
            Review your past quiz attempts, track progress over time, and inspect question-by-question explanations.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="dash-category-tabs">
        <button
          className={`dash-cat-pill ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All Attempts ({attempts.length})
        </button>
        <button
          className={`dash-cat-pill ${statusFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('completed')}
        >
          Completed ({attempts.filter((a) => a.status === 'completed').length})
        </button>
        <button
          className={`dash-cat-pill ${statusFilter === 'abandoned' ? 'active' : ''}`}
          onClick={() => setStatusFilter('abandoned')}
        >
          Timed Out / Abandoned ({attempts.filter((a) => a.status === 'abandoned').length})
        </button>
      </div>

      {/* Table of Results */}
      {filteredAttempts.length > 0 ? (
        <div className="dash-card">
          <div className="dash-table-responsive">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Time Taken</th>
                  <th>Date & Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((att) => (
                  <tr key={att.id}>
                    <td>
                      <div className="dash-table-quiz-title">
                        {att.quizzes?.title || 'Quiz Attempt'}
                      </div>
                    </td>
                    <td>
                      <span className="dash-table-sub-tag">
                        {att.quizzes?.subjects?.name || 'General'}
                      </span>
                    </td>
                    <td>
                      <span className={`dash-status-pill status-${att.status}`}>
                        {att.status === 'completed'
                          ? 'Completed'
                          : att.status === 'abandoned'
                          ? 'Timed Out'
                          : 'In Progress'}
                      </span>
                    </td>
                    <td>
                      <span className="dash-table-score">
                        {att.score} / {att.total_marks || 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`dash-table-accuracy acc-${
                          att.accuracy_percentage >= 70
                            ? 'high'
                            : att.accuracy_percentage >= 50
                            ? 'med'
                            : 'low'
                        }`}
                      >
                        {att.accuracy_percentage}%
                      </span>
                    </td>
                    <td>{formatTime(att.time_taken_seconds)}</td>
                    <td>{formatDate(att.completed_at || att.started_at)}</td>
                    <td>
                      {att.status === 'completed' ? (
                        <button
                          className="dash-btn-table-action"
                          onClick={() => onViewResult(att)}
                          title="View review and explanations"
                        >
                          View Result
                        </button>
                      ) : (
                        <span className="dash-table-muted">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">🎯</div>
          <h3>No quiz results found</h3>
          <p>
            {statusFilter === 'all'
              ? "You haven't attempted any quizzes yet. Start taking quizzes to see your records here."
              : `No quiz attempts matching status "${statusFilter}".`}
          </p>
          <button
            className="btn-primary"
            onClick={() => onNavigateTab('quizzes')}
          >
            Explore Quizzes →
          </button>
        </div>
      )}
    </div>
  )
}
