import { useState } from 'react'

export default function OverviewTab({
  profile,
  user,
  quizzes,
  attempts,
  stats,
  onNavigateTab,
  onOpenProfile,
  onStartQuiz,
  onViewResult,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all')

  const getInitials = (name) => {
    if (!name) return 'S'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  // Categories list
  const categories = [
    { id: 'all', label: 'All Quizzes' },
    { id: 'programming', label: 'Programming' },
    { id: 'core_cs', label: 'Core CS' },
    { id: 'college_syllabus', label: 'College Syllabus' },
    { id: 'aptitude', label: 'Aptitude' },
  ]

  // Filter quizzes by selected category
  const filteredQuizzes = quizzes.filter((q) => {
    if (selectedCategory === 'all') return true
    return q.subjects?.category === selectedCategory
  })

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return 'Recent'
    const d = new Date(isoString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Format time taken helper
  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  return (
    <div className="dash-overview-container">
      {/* ── 1. Welcome Section ── */}
      <section className="dash-welcome-card">
        <div className="dash-welcome-content">
          <div className="dash-welcome-text">
            <div className="dash-welcome-badge">STUDENT PORTAL</div>
            <h1 className="dash-welcome-title">
              Welcome back, {profile?.full_name || 'Student'}!
            </h1>
            <p className="dash-welcome-subtitle">
              Track your learning path, test your skills against college curriculum, and climb the leaderboard.
            </p>

            <div className="dash-student-meta-tags">
              <span className="dash-meta-tag">
                🏫 {profile?.college_name || 'College Not Set'}
              </span>
              {profile?.branch && (
                <span className="dash-meta-tag">
                  💻 {profile.branch}
                </span>
              )}
              {profile?.semester && (
                <span className="dash-meta-tag">
                  📚 Semester {profile.semester}
                </span>
              )}
              {(!profile?.college_name || !profile?.branch || !profile?.semester) && (
                <button
                  className="dash-meta-tag dash-meta-tag-action"
                  onClick={onOpenProfile}
                >
                  ✏️ Complete Profile
                </button>
              )}
            </div>
          </div>

          <div className="dash-welcome-avatar-wrapper">
            <div className="dash-welcome-avatar">
              {getInitials(profile?.full_name || user?.email)}
            </div>
            <button className="dash-btn-edit-profile" onClick={onOpenProfile}>
              Edit Profile
            </button>
          </div>
        </div>
      </section>

      {/* ── 2. Real Statistics Cards Grid ── */}
      <section className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-quizzes">
            <span>📝</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Quizzes Attempted</span>
            <span className="dash-stat-number">{stats.totalAttempts}</span>
            <span className="dash-stat-note">
              {stats.completedAttempts} completed
            </span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-score">
            <span>📊</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Average Score</span>
            <span className="dash-stat-number">{stats.averageScore}%</span>
            <span className="dash-stat-note">
              {stats.completedAttempts > 0 ? 'Across completed quizzes' : 'No quizzes completed yet'}
            </span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-accuracy">
            <span>🎯</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Overall Accuracy</span>
            <span className="dash-stat-number">{stats.overallAccuracy}%</span>
            <span className="dash-stat-note">
              {stats.accuracyGrade}
            </span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon-wrap icon-points">
            <span>⭐</span>
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Total Points</span>
            <span className="dash-stat-number">{profile?.total_score ?? 0}</span>
            <span className="dash-stat-note">
              Weekly: {profile?.weekly_score ?? 0} pts
            </span>
          </div>
        </div>
      </section>

      {/* ── 3. Performance & Recommendations Row ── */}
      <div className="dash-two-col-grid">
        {/* Subject-wise Performance Overview */}
        <section className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Performance Overview</h2>
              <p className="dash-card-subtitle">Real subject-wise accuracy analysis</p>
            </div>
            {stats.subjectBreakdown.length > 0 && (
              <button
                className="dash-link-action"
                onClick={() => onNavigateTab('analytics')}
              >
                Detailed View →
              </button>
            )}
          </div>

          {stats.subjectBreakdown.length > 0 ? (
            <div className="dash-performance-body">
              {/* Strongest & Weakest Badges */}
              <div className="dash-strength-badges">
                {stats.strongestSubject && (
                  <div className="dash-badge-item badge-strong">
                    <span className="badge-tag">🏆 Strongest Subject</span>
                    <span className="badge-name">{stats.strongestSubject.name}</span>
                    <span className="badge-score">{stats.strongestSubject.accuracy}% accuracy</span>
                  </div>
                )}
                {stats.weakestSubject && (
                  <div className="dash-badge-item badge-weak">
                    <span className="badge-tag">⚠️ Needs Focus</span>
                    <span className="badge-name">{stats.weakestSubject.name}</span>
                    <span className="badge-score">{stats.weakestSubject.accuracy}% accuracy</span>
                  </div>
                )}
              </div>

              {/* Subject Accuracy Bars */}
              <div className="dash-subject-bars">
                {stats.subjectBreakdown.slice(0, 4).map((sub) => (
                  <div className="dash-bar-row" key={sub.name}>
                    <div className="dash-bar-meta">
                      <span className="dash-bar-name">{sub.name}</span>
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
          ) : (
            <div className="dash-empty-state-mini">
              <div className="dash-empty-icon">📈</div>
              <h3>No performance data yet</h3>
              <p>
                Complete your first quiz to view your subject-wise accuracy, discover your strongest skills, and identify areas to improve.
              </p>
              <button
                className="btn-primary"
                onClick={() => onNavigateTab('quizzes')}
              >
                Browse Quizzes →
              </button>
            </div>
          )}
        </section>

        {/* Personalized Recommendations */}
        <section className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Recommendations</h2>
              <p className="dash-card-subtitle">Personalized next actions</p>
            </div>
          </div>

          <div className="dash-recommendations-list">
            {stats.completedAttempts === 0 ? (
              <>
                <div className="dash-rec-item">
                  <div className="dash-rec-icon">🎯</div>
                  <div className="dash-rec-text">
                    <h4>Take a Diagnostic Quiz</h4>
                    <p>Start with any fundamental quiz to benchmark your knowledge and establish your initial stats.</p>
                  </div>
                </div>
                <div className="dash-rec-item">
                  <div className="dash-rec-icon">🏫</div>
                  <div className="dash-rec-text">
                    <h4>Complete Your Profile</h4>
                    <p>Ensure your college name and current semester are configured to match syllabus requirements.</p>
                  </div>
                </div>
                <div className="dash-rec-item">
                  <div className="dash-rec-icon">🏆</div>
                  <div className="dash-rec-text">
                    <h4>Join the Weekly Leaderboard</h4>
                    <p>Compete with students across colleges. Every completed quiz adds directly to your weekly score.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {stats.weakestSubject && (
                  <div className="dash-rec-item alert-focus">
                    <div className="dash-rec-icon">💡</div>
                    <div className="dash-rec-text">
                      <h4>Practice More in {stats.weakestSubject.name}</h4>
                      <p>
                        Your current accuracy is {stats.weakestSubject.accuracy}%. Re-attempting quizzes in this topic will rapidly increase your points.
                      </p>
                    </div>
                  </div>
                )}
                <div className="dash-rec-item">
                  <div className="dash-rec-icon">🔥</div>
                  <div className="dash-rec-text">
                    <h4>Attempt Daily Challenges</h4>
                    <p>Daily challenges award bonus points and keep your problem-solving momentum sharp.</p>
                  </div>
                </div>
                <div className="dash-rec-item">
                  <div className="dash-rec-icon">📊</div>
                  <div className="dash-rec-text">
                    <h4>Review Past Mistakes</h4>
                    <p>Click "View Result" on past attempts to inspect step-by-step explanations for incorrect questions.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── 4. Available Quizzes Section ── */}
      <section className="dash-card">
        <div className="dash-card-header-flex">
          <div>
            <h2 className="dash-card-title">Available Quizzes</h2>
            <p className="dash-card-subtitle">
              Curated quizzes based on college curriculum and competitive prep
            </p>
          </div>
          <button
            className="dash-link-action"
            onClick={() => onNavigateTab('quizzes')}
          >
            View All ({quizzes.length}) →
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="dash-category-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`dash-cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filteredQuizzes.length > 0 ? (
          <div className="dash-quizzes-grid">
            {filteredQuizzes.slice(0, 6).map((quiz) => (
              <div className="dash-quiz-card" key={quiz.id}>
                <div className="dash-quiz-top">
                  <span className="dash-quiz-subject">
                    {quiz.subjects?.name || 'General'}
                  </span>
                  <span className={`dash-quiz-diff diff-${quiz.difficulty}`}>
                    {quiz.difficulty}
                  </span>
                </div>

                <h3 className="dash-quiz-title">{quiz.title}</h3>
                <p className="dash-quiz-desc">
                  {quiz.description || 'Test your understanding and core concepts in this subject.'}
                </p>

                <div className="dash-quiz-meta">
                  <span>⏱️ {quiz.time_limit_minutes} Mins</span>
                  <span>❓ {quiz.total_questions} Questions</span>
                  <span>🏆 {quiz.passing_score}% to Pass</span>
                </div>

                <button
                  className="btn-attempt dash-btn-start"
                  onClick={() => onStartQuiz(quiz)}
                >
                  Start Quiz →
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty-state">
            <div className="dash-empty-icon">📝</div>
            <h3>No quizzes published in this category yet</h3>
            <p>
              Quizzes are actively published by administrators. Check back shortly or switch categories.
            </p>
          </div>
        )}
      </section>

      {/* ── 5. Recent Quiz Attempts ── */}
      <section className="dash-card">
        <div className="dash-card-header-flex">
          <div>
            <h2 className="dash-card-title">Recent Quiz Attempts</h2>
            <p className="dash-card-subtitle">Your latest quiz results and performance records</p>
          </div>
          {attempts.length > 0 && (
            <button
              className="dash-link-action"
              onClick={() => onNavigateTab('results')}
            >
              All Results ({attempts.length}) →
            </button>
          )}
        </div>

        {attempts.length > 0 ? (
          <div className="dash-table-responsive">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Subject</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Duration</th>
                  <th>Completed Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, 5).map((att) => (
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
                      <button
                        className="dash-btn-table-action"
                        onClick={() => onViewResult(att)}
                        title="Review questions and answer explanations"
                      >
                        View Result
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dash-empty-state">
            <div className="dash-empty-icon">🎯</div>
            <h3>No quiz attempts yet</h3>
            <p>
              You haven't attempted any quizzes yet. Explore our curriculum quizzes, test your knowledge, and track your scores here!
            </p>
            <button
              className="btn-primary"
              onClick={() => onNavigateTab('quizzes')}
            >
              Explore Quizzes →
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
