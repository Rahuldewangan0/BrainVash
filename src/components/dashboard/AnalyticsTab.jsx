export default function AnalyticsTab({
  stats,
  attempts = [],
  onNavigateTab,
}) {
  const completedAttempts = attempts
    .filter((attempt) => attempt.status === 'completed')
    .sort((a, b) => {
      const dateA = new Date(a.completed_at || a.started_at || 0).getTime()
      const dateB = new Date(b.completed_at || b.started_at || 0).getTime()
      return dateA - dateB
    })

  const recentAttempts = completedAttempts.slice(-7)
  const trendValues = recentAttempts.map((attempt) => {
    const totalMarks = Number(attempt.total_marks || 0)
    const score = Number(attempt.score || 0)
    const scorePercentage =
      totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0

    return {
      id: attempt.id,
      title: attempt.quizzes?.title || 'Quiz',
      subject: attempt.quizzes?.subjects?.name || 'General',
      date: attempt.completed_at || attempt.started_at,
      score: scorePercentage,
      rawScore: score,
      totalMarks,
    }
  })

  const averageRecentScore =
    trendValues.length > 0
      ? Math.round(
        trendValues.reduce((total, item) => total + item.score, 0) /
        trendValues.length
      )
      : 0

  const firstScore = trendValues[0]?.score
  const lastScore = trendValues[trendValues.length - 1]?.score
  const trendDifference =
    trendValues.length > 1 ? lastScore - firstScore : null

  const formatDate = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })
  }

  const getTrendLabel = () => {
    if (trendDifference === null) return 'Complete more quizzes to see your trend'
    if (trendDifference > 0) return `Up ${trendDifference} percentage points`
    if (trendDifference < 0) return `Down ${Math.abs(trendDifference)} percentage points`
    return 'Your first and latest scores are level'
  }

  return (
    <div className="dash-tab-container">
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Performance Analytics</h1>
          <p className="dash-page-desc">
            Deep-dive into your subject proficiencies, accuracy trends, and areas for improvement.
          </p>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-score">
            <span>📊</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Average Accuracy</span>
            <span className="dash-stat-number">{stats.overallAccuracy}%</span>
            <span className="dash-stat-note">{stats.accuracyGrade}</span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-quizzes">
            <span>📝</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Quizzes Completed</span>
            <span className="dash-stat-number">{stats.completedAttempts}</span>
            <span className="dash-stat-note">Out of {stats.totalAttempts} total attempts</span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-accuracy">
            <span>🏆</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Strongest Subject</span>
            <span className="dash-stat-number" style={{ fontSize: 18 }}>
              {stats.strongestSubject?.name || 'N/A'}
            </span>
            <span className="dash-stat-note">
              {stats.strongestSubject
                ? `${stats.strongestSubject.accuracy}% accuracy`
                : 'Take quizzes to identify'}
            </span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-points">
            <span>⚠️</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Needs Practice</span>
            <span className="dash-stat-number" style={{ fontSize: 18 }}>
              {stats.weakestSubject?.name || 'N/A'}
            </span>
            <span className="dash-stat-note">
              {stats.weakestSubject
                ? `${stats.weakestSubject.accuracy}% accuracy`
                : 'Take quizzes to identify'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Performance Trend */}
      <div className="dash-card" style={{ marginBottom: 24 }}>
        <div className="dash-card-header">
          <div>
            <h2 className="dash-card-title">Recent Performance Trend</h2>
            <p className="dash-card-subtitle">
              Score percentage across your last 7 completed quiz attempts
            </p>
          </div>
        </div>

        {trendValues.length > 0 ? (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 24,
                margin: '18px 0 22px',
              }}
            >
              <div>
                <div style={{ color: '#8c7b80', fontSize: 12, marginBottom: 4 }}>
                  Recent average score
                </div>
                <div style={{ color: '#38232f', fontSize: 28, fontWeight: 700 }}>
                  {averageRecentScore}%
                </div>
              </div>
              <div>
                <div style={{ color: '#8c7b80', fontSize: 12, marginBottom: 4 }}>
                  Trend (first to latest)
                </div>
                <div style={{ color: '#38232f', fontSize: 15, fontWeight: 600 }}>
                  {getTrendLabel()}
                </div>
              </div>
            </div>

            <div
              role="img"
              aria-label={`Recent quiz score trend: ${trendValues
                .map((item) => `${item.title} ${item.score}%`)
                .join(', ')}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(trendValues.length, 1)}, minmax(0, 1fr))`,
                alignItems: 'end',
                gap: 12,
                minHeight: 190,
                padding: '12px 4px 0',
                borderBottom: '1px solid #eadfe1',
              }}
            >
              {trendValues.map((item, index) => {
                const barHeight = Math.max(8, Math.min(100, item.score))
                return (
                  <div
                    key={item.id}
                    title={`${item.title}: ${item.score}%`}
                    style={{
                      minWidth: 0,
                      height: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 7,
                    }}
                  >
                    <span style={{ color: '#5d4652', fontSize: 12, fontWeight: 700 }}>
                      {item.score}%
                    </span>
                    <div
                      style={{
                        width: 'min(100%, 44px)',
                        height: `${barHeight}%`,
                        minHeight: 8,
                        borderRadius: '7px 7px 0 0',
                        background: index === trendValues.length - 1 ? '#e8634a' : '#d9a18f',
                        transition: 'height 180ms ease',
                      }}
                    />
                    <span style={{ color: '#8c7b80', fontSize: 11 }}>
                      {formatDate(item.date)}
                    </span>
                  </div>
                )
              })}
            </div>
            <p style={{ color: '#8c7b80', fontSize: 12, marginTop: 12 }}>
              Bars are ordered from oldest to latest. Scores are calculated from marks earned ÷ total marks.
            </p>
          </>
        ) : (
          <div className="dash-empty-state-mini" style={{ margin: '18px 0' }}>
            <p>Complete a quiz to start building your performance trend.</p>
            <button className="btn-primary" onClick={() => onNavigateTab('quizzes')}>
              Explore Quizzes →
            </button>
          </div>
        )}
      </div>

      {stats.subjectBreakdown.length > 0 ? (
        <div className="dash-two-col-grid">
          {/* Subject Accuracy Chart */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h2 className="dash-card-title">Subject-wise Accuracy</h2>
                <p className="dash-card-subtitle">Calculated from your completed quiz attempts</p>
              </div>
            </div>

            <div className="dash-subject-bars" style={{ marginTop: 16 }}>
              {stats.subjectBreakdown.map((sub) => (
                <div className="dash-bar-row" key={sub.name}>
                  <div className="dash-bar-meta">
                    <span className="dash-bar-name">
                      {sub.name} <small style={{ color: '#9a8a90' }}>({sub.attempts} attempts)</small>
                    </span>
                    <span className="dash-bar-val">{sub.accuracy}%</span>
                  </div>
                  <div className="dash-bar-track">
                    <div
                      className="dash-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(5, sub.accuracy))}%`,
                        backgroundColor:
                          sub.accuracy >= 75
                            ? '#48bb78'
                            : sub.accuracy >= 50
                              ? '#f5945e'
                              : '#e8634a',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h2 className="dash-card-title">Subject Insights</h2>
                <p className="dash-card-subtitle">Detailed points and accuracy breakdown</p>
              </div>
            </div>

            <div className="dash-table-responsive">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Attempts</th>
                    <th>Total Scored</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.subjectBreakdown.map((sub) => (
                    <tr key={sub.name}>
                      <td style={{ fontWeight: 600 }}>{sub.name}</td>
                      <td>{sub.attempts}</td>
                      <td>{sub.totalScored} pts</td>
                      <td>
                        <span
                          className={`dash-table-accuracy acc-${sub.accuracy >= 70 ? 'high' : sub.accuracy >= 50 ? 'med' : 'low'
                            }`}
                        >
                          {sub.accuracy}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="dash-card dash-empty-state">
          <div className="dash-empty-icon">📈</div>
          <h3>Insufficient analytics data</h3>
          <p>
            Complete quizzes across different subjects to unlock your comparative analysis, subject strengths, and personalized recommendations.
          </p>
          <button
            className="btn-primary"
            onClick={() => onNavigateTab('quizzes')}
          >
            Start Practicing Quizzes →
          </button>
        </div>
      )}
    </div>
  )
}
