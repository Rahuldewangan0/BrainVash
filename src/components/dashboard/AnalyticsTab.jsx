export default function AnalyticsTab({
  stats,
  onNavigateTab,
}) {
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
              {stats.strongestSubject ? `${stats.strongestSubject.accuracy}% accuracy` : 'Take quizzes to identify'}
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
              {stats.weakestSubject ? `${stats.weakestSubject.accuracy}% accuracy` : 'Take quizzes to identify'}
            </span>
          </div>
        </div>
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

          {/* Breakdown Table & Recommendations */}
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
                          className={`dash-table-accuracy acc-${
                            sub.accuracy >= 70 ? 'high' : sub.accuracy >= 50 ? 'med' : 'low'
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
