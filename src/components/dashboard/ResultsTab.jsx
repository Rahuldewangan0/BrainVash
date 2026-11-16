import { useMemo, useState } from 'react'

export default function ResultsTab({
  attempts = [],
  onViewResult,
  onNavigateTab,
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const counts = useMemo(
    () => ({
      all: attempts.length,
      completed: attempts.filter((attempt) => attempt.status === 'completed').length,
      abandoned: attempts.filter((attempt) => attempt.status === 'abandoned').length,
    }),
    [attempts]
  )

  const filteredAttempts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    const filtered = attempts.filter((attempt) => {
      const matchesStatus =
        statusFilter === 'all' || attempt.status === statusFilter

      const quizTitle = attempt.quizzes?.title || 'Quiz Attempt'
      const subjectName = attempt.quizzes?.subjects?.name || 'General'
      const matchesSearch =
        !query ||
        quizTitle.toLowerCase().includes(query) ||
        subjectName.toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.completed_at || a.started_at || 0).getTime()
      const dateB = new Date(b.completed_at || b.started_at || 0).getTime()
      const scoreA = Number(a.score || 0)
      const scoreB = Number(b.score || 0)
      const accuracyA = Number(a.accuracy_percentage || 0)
      const accuracyB = Number(b.accuracy_percentage || 0)

      switch (sortBy) {
        case 'oldest':
          return dateA - dateB
        case 'highest':
          return accuracyB - accuracyA || scoreB - scoreA
        case 'lowest':
          return accuracyA - accuracyB || scoreA - scoreB
        case 'newest':
        default:
          return dateB - dateA
      }
    })
  }, [attempts, statusFilter, searchQuery, sortBy])

  const formatDate = (isoString) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (seconds) => {
    const value = Number(seconds || 0)
    if (value <= 0) return '0s'
    const minutes = Math.floor(value / 60)
    const remainingSeconds = value % 60
    if (minutes === 0) return `${remainingSeconds}s`
    return `${minutes}m ${remainingSeconds}s`
  }

  const statusLabel = (status) => {
    if (status === 'completed') return 'Completed'
    if (status === 'abandoned') return 'Timed Out'
    return 'In Progress'
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

      {/* Status filters */}
      <div className="dash-category-tabs">
        <button
          className={`dash-cat-pill ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All Attempts ({counts.all})
        </button>
        <button
          className={`dash-cat-pill ${statusFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('completed')}
        >
          Completed ({counts.completed})
        </button>
        <button
          className={`dash-cat-pill ${statusFilter === 'abandoned' ? 'active' : ''}`}
          onClick={() => setStatusFilter('abandoned')}
        >
          Timed Out / Abandoned ({counts.abandoned})
        </button>
      </div>

      {/* Search and sort controls */}
      <div
        className="dash-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 18,
          padding: 16,
        }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <label
            htmlFor="attempt-search"
            style={{
              display: 'block',
              color: '#6e5a63',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Search quiz or subject
          </label>
          <input
            id="attempt-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="e.g. Data Structures, DBMS..."
            style={{
              width: '100%',
              minHeight: 42,
              border: '1px solid #e8dadd',
              borderRadius: 9,
              padding: '9px 12px',
              background: '#fffdfc',
              color: '#38232f',
              outlineColor: '#e8634a',
            }}
          />
        </div>

        <div style={{ flex: '0 1 210px' }}>
          <label
            htmlFor="attempt-sort"
            style={{
              display: 'block',
              color: '#6e5a63',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Sort attempts
          </label>
          <select
            id="attempt-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            style={{
              width: '100%',
              minHeight: 42,
              border: '1px solid #e8dadd',
              borderRadius: 9,
              padding: '9px 12px',
              background: '#fffdfc',
              color: '#38232f',
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest accuracy</option>
            <option value="lowest">Lowest accuracy</option>
          </select>
        </div>

        {(searchQuery || sortBy !== 'newest') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSortBy('newest')
              setStatusFilter('all')
            }}
            style={{
              alignSelf: 'flex-end',
              minHeight: 42,
              border: '1px solid #e8dadd',
              borderRadius: 9,
              padding: '9px 13px',
              background: '#fff',
              color: '#765d67',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Results table */}
      {filteredAttempts.length > 0 ? (
        <div className="dash-card">
          <div
            className="dash-card-header"
            style={{ padding: '16px 18px 8px' }}
          >
            <div>
              <h2 className="dash-card-title">Attempt History</h2>
              <p className="dash-card-subtitle">
                Showing {filteredAttempts.length} of {attempts.length} attempts
              </p>
            </div>
          </div>

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
                {filteredAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      <div className="dash-table-quiz-title">
                        {attempt.quizzes?.title || 'Quiz Attempt'}
                      </div>
                    </td>
                    <td>
                      <span className="dash-table-sub-tag">
                        {attempt.quizzes?.subjects?.name || 'General'}
                      </span>
                    </td>
                    <td>
                      <span className={`dash-status-pill status-${attempt.status}`}>
                        {statusLabel(attempt.status)}
                      </span>
                    </td>
                    <td>
                      <span className="dash-table-score">
                        {attempt.score ?? 0} / {attempt.total_marks || 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`dash-table-accuracy acc-${Number(attempt.accuracy_percentage || 0) >= 70
                          ? 'high'
                          : Number(attempt.accuracy_percentage || 0) >= 50
                            ? 'med'
                            : 'low'
                          }`}
                      >
                        {Number(attempt.accuracy_percentage || 0)}%
                      </span>
                    </td>
                    <td>{formatTime(attempt.time_taken_seconds)}</td>
                    <td>{formatDate(attempt.completed_at || attempt.started_at)}</td>
                    <td>
                      {attempt.status === 'completed' ? (
                        <button
                          className="dash-btn-table-action"
                          onClick={() => onViewResult(attempt)}
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
          <h3>{attempts.length === 0 ? 'No quiz results yet' : 'No matching attempts found'}</h3>
          <p>
            {attempts.length === 0
              ? "You haven't attempted any quizzes yet. Start taking quizzes to see your records here."
              : 'Try another search term or change the status filter to find an attempt.'}
          </p>
          {attempts.length === 0 ? (
            <button
              className="btn-primary"
              onClick={() => onNavigateTab('quizzes')}
            >
              Explore Quizzes →
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setSortBy('newest')
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
