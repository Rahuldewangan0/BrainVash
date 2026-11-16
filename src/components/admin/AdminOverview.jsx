import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AdminOverview({ onNavigateTab }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    publishedQuizzes: 0,
    draftQuizzes: 0,
    totalQuestions: 0,
    easyQuestions: 0,
    mediumQuestions: 0,
    hardQuestions: 0,
    totalStudents: 0,
    totalAttempts: 0,
    completedAttempts: 0,
    avgAccuracy: 0,
  })
  const [recentAttempts, setRecentAttempts] = useState([])

  useEffect(() => {
    let ignore = false

    async function loadAdminKPIs() {
      if (!supabase) return
      setLoading(true)
      setError('')

      try {
        // 1. Quizzes stats
        const { data: quizzes, error: qErr } = await supabase
          .from('quizzes')
          .select('id, is_published')

        if (qErr) console.warn('[AdminOverview] Quizzes fetch notice:', qErr.message)

        const totalQuizzes = quizzes ? quizzes.length : 0
        const publishedQuizzes = quizzes ? quizzes.filter((q) => q.is_published).length : 0
        const draftQuizzes = totalQuizzes - publishedQuizzes

        // 2. Questions stats (resilient to schema with or without questions.difficulty)
        let questions = []
        const { data: qWithDiff, error: questErr } = await supabase
          .from('questions')
          .select('id, difficulty')

        if (!questErr) {
          questions = qWithDiff || []
        } else {
          // Fallback if questions.difficulty column is not yet migrated
          const { data: qBase } = await supabase.from('questions').select('id')
          questions = qBase || []
        }

        const totalQuestions = questions.length
        const easyQuestions = questions.filter((q) => (q.difficulty || '').toLowerCase() === 'easy').length
        const mediumQuestions = questions.filter((q) => (q.difficulty || 'medium').toLowerCase() === 'medium').length
        const hardQuestions = questions.filter((q) => (q.difficulty || '').toLowerCase() === 'hard').length

        // 3. Students count
        const { count: studentCount, error: profErr } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })

        if (profErr) console.warn('[AdminOverview] Profiles count notice:', profErr.message)

        // 4. Attempts stats & recent activity (resilient to schema with or without selected_difficulty)
        let attempts = []
        const { data: attData1, error: attErr1 } = await supabase
          .from('quiz_attempts')
          .select(`
            id,
            status,
            score,
            total_marks,
            accuracy_percentage,
            selected_difficulty,
            started_at,
            completed_at,
            user_id,
            quiz_id,
            quizzes (
              id,
              title,
              subjects (
                name
              )
            ),
            profiles (
              full_name,
              college_name
            )
          `)
          .order('started_at', { ascending: false })
          .limit(10)

        if (!attErr1) {
          attempts = attData1 || []
        } else {
          // Fallback without selected_difficulty
          const { data: attData2 } = await supabase
            .from('quiz_attempts')
            .select(`
              id,
              status,
              score,
              total_marks,
              accuracy_percentage,
              started_at,
              completed_at,
              user_id,
              quiz_id,
              quizzes (
                id,
                title,
                subjects (
                  name
                )
              ),
              profiles (
                full_name,
                college_name
              )
            `)
            .order('started_at', { ascending: false })
            .limit(10)

          attempts = attData2 || []
        }

        const totalAttempts = attempts ? attempts.length : 0
        const completedAttempts = attempts ? attempts.filter((a) => a.status === 'completed').length : 0

        const totalAcc = attempts
          ? attempts
              .filter((a) => a.status === 'completed' && a.accuracy_percentage != null)
              .reduce((acc, curr) => acc + Number(curr.accuracy_percentage), 0)
          : 0
        const avgAccuracy = completedAttempts > 0 ? Math.round(totalAcc / completedAttempts) : 0

        if (!ignore) {
          setStats({
            totalQuizzes,
            publishedQuizzes,
            draftQuizzes,
            totalQuestions,
            easyQuestions,
            mediumQuestions,
            hardQuestions,
            totalStudents: studentCount || 0,
            totalAttempts,
            completedAttempts,
            avgAccuracy,
          })
          setRecentAttempts(attempts || [])
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Error loading administrator metrics.')
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadAdminKPIs()
    return () => {
      ignore = true
    }
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="dash-loading-container">
        <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
        <p>Loading real-time platform metrics from Supabase...</p>
      </div>
    )
  }

  return (
    <div className="dash-tab-container admin-overview-container">
      {/* Page Header & Quick Actions */}
      <div className="dash-tab-header">
        <div>
          <div className="dash-welcome-badge" style={{ background: 'rgba(232, 99, 74, 0.1)', color: '#e8634a' }}>
            🛡️ Production Admin Console
          </div>
          <h1 className="dash-page-title">Platform Operations Overview</h1>
          <p className="dash-page-desc">
            Live monitoring of assessments, question bank volume, candidate attempts, and system health.
          </p>
        </div>

        <div className="admin-header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => onNavigateTab('quizzes')}
            title="Create or configure quizzes"
          >
            <span>➕</span> New Quiz
          </button>
          <button
            className="btn-secondary"
            onClick={() => onNavigateTab('questions')}
            title="Add to Question Bank"
          >
            <span>📝</span> Add Question
          </button>
          <button
            className="btn-secondary"
            onClick={() => onNavigateTab('subjects')}
            title="Manage curriculum subjects"
          >
            <span>📚</span> New Subject
          </button>
        </div>
      </div>

      {error && (
        <div className="auth-message auth-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="dash-stats-grid" style={{ marginBottom: 30 }}>
        {/* Total Quizzes */}
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Quizzes</span>
            <span className="dash-stat-icon">📝</span>
          </div>
          <div className="dash-stat-value">{stats.totalQuizzes}</div>
          <div className="dash-stat-subtitle">
            <span style={{ color: '#2e7d32', fontWeight: 600 }}>{stats.publishedQuizzes} Published</span>
            {' • '}
            <span style={{ color: '#e8634a', fontWeight: 600 }}>{stats.draftQuizzes} Drafts</span>
          </div>
        </div>

        {/* Question Bank */}
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Question Bank</span>
            <span className="dash-stat-icon">🗄️</span>
          </div>
          <div className="dash-stat-value">{stats.totalQuestions}</div>
          <div className="dash-stat-subtitle" style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#2e7d32' }}>🌱 {stats.easyQuestions} Easy</span>
            {' | '}
            <span style={{ color: '#d84315' }}>⚡ {stats.mediumQuestions} Med</span>
            {' | '}
            <span style={{ color: '#c2185b' }}>🔥 {stats.hardQuestions} Hard</span>
          </div>
        </div>

        {/* Registered Students */}
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Enrolled Students</span>
            <span className="dash-stat-icon">👥</span>
          </div>
          <div className="dash-stat-value">{stats.totalStudents}</div>
          <div className="dash-stat-subtitle">
            Active candidate profiles on BrainVash
          </div>
        </div>

        {/* Performance & Attempts */}
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Quiz Attempts</span>
            <span className="dash-stat-icon">🎯</span>
          </div>
          <div className="dash-stat-value">{stats.totalAttempts}</div>
          <div className="dash-stat-subtitle">
            <span style={{ color: '#2e7d32', fontWeight: 600 }}>{stats.avgAccuracy}%</span> avg student accuracy
          </div>
        </div>
      </div>

      {/* Two Column Section: Quick Management Modules & Recent Attempts */}
      <div className="dash-two-col-grid" style={{ marginBottom: 30 }}>
        {/* Module Nav Cards */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>⚡ Management Shortcuts</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              className="admin-module-link-card"
              onClick={() => onNavigateTab('quizzes')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#faf5ef',
                border: '1px solid #f3e0d5',
                cursor: 'pointer',
              }}
            >
              <div>
                <strong style={{ display: 'block', color: '#3b1f2b' }}>Quiz Management</strong>
                <span style={{ fontSize: '0.85rem', color: '#5e4a52' }}>
                  Create, configure, publish or draft engineering quizzes
                </span>
              </div>
              <span style={{ color: '#e8634a', fontWeight: 'bold' }}>Manage →</span>
            </div>

            <div
              className="admin-module-link-card"
              onClick={() => onNavigateTab('questions')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#faf5ef',
                border: '1px solid #f3e0d5',
                cursor: 'pointer',
              }}
            >
              <div>
                <strong style={{ display: 'block', color: '#3b1f2b' }}>Question Bank & Difficulty</strong>
                <span style={{ fontSize: '0.85rem', color: '#5e4a52' }}>
                  Author reusable questions across Easy, Medium, and Hard tiers
                </span>
              </div>
              <span style={{ color: '#e8634a', fontWeight: 'bold' }}>Bank →</span>
            </div>

            <div
              className="admin-module-link-card"
              onClick={() => onNavigateTab('subjects')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#faf5ef',
                border: '1px solid #f3e0d5',
                cursor: 'pointer',
              }}
            >
              <div>
                <strong style={{ display: 'block', color: '#3b1f2b' }}>Curriculum Subjects</strong>
                <span style={{ fontSize: '0.85rem', color: '#5e4a52' }}>
                  Define branches, semesters, and subject codes
                </span>
              </div>
              <span style={{ color: '#e8634a', fontWeight: 'bold' }}>Subjects →</span>
            </div>

            <div
              className="admin-module-link-card"
              onClick={() => onNavigateTab('students')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                background: '#faf5ef',
                border: '1px solid #f3e0d5',
                cursor: 'pointer',
              }}
            >
              <div>
                <strong style={{ display: 'block', color: '#3b1f2b' }}>Student Roster & Logs</strong>
                <span style={{ fontSize: '0.85rem', color: '#5e4a52' }}>
                  Audit student progress, scores, and access privileges
                </span>
              </div>
              <span style={{ color: '#e8634a', fontWeight: 'bold' }}>Roster →</span>
            </div>
          </div>
        </div>

        {/* Security & RLS Compliance Status */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>🔒 Security & Governance Matrix</h3>
          </div>
          <div className="admin-security-checklist">
            <div className="admin-sec-item" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓</span>
                <strong style={{ color: '#3b1f2b' }}>Row Level Security (RLS)</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#5e4a52', marginLeft: 24 }}>
                Active on subjects, quizzes, questions, quiz_questions, and question_answer_keys.
              </p>
            </div>

            <div className="admin-sec-item" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓</span>
                <strong style={{ color: '#3b1f2b' }}>Answer Key Privacy Barrier</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#5e4a52', marginLeft: 24 }}>
                Direct reads on question_answer_keys are completely blocked for non-admin roles. Evaluation is performed solely via SECURITY DEFINER procedures.
              </p>
            </div>

            <div className="admin-sec-item" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓</span>
                <strong style={{ color: '#3b1f2b' }}>Strict Difficulty Validation</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#5e4a52', marginLeft: 24 }}>
                Quiz submissions are checked against the candidate's selected difficulty tier (Easy, Medium, Hard). Mismatched question submissions are rejected server-side.
              </p>
            </div>

            <div className="admin-sec-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✓</span>
                <strong style={{ color: '#3b1f2b' }}>Score Tampering Prevention</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#5e4a52', marginLeft: 24 }}>
                Database triggers prevent direct client mutations on total_score, weekly_score, or attempts status.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h3>🕒 Live Assessment Activity</h3>
          <span style={{ fontSize: '0.85rem', color: '#9a8a90' }}>Real-time student submissions</span>
        </div>

        {recentAttempts.length > 0 ? (
          <div className="dash-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Quiz</th>
                  <th>Difficulty</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {recentAttempts.map((att) => {
                  const studentName = att.profiles?.full_name || 'Anonymous Student'
                  const quizTitle = att.quizzes?.title || 'Engineering Quiz'
                  const diff = att.selected_difficulty || 'medium'
                  return (
                    <tr key={att.id}>
                      <td>
                        <strong style={{ color: '#3b1f2b' }}>{studentName}</strong>
                        {att.profiles?.college_name && (
                          <div style={{ fontSize: '0.75rem', color: '#9a8a90' }}>
                            {att.profiles.college_name}
                          </div>
                        )}
                      </td>
                      <td>{quizTitle}</td>
                      <td>
                        <span className={`dash-quiz-diff diff-${diff}`} style={{ textTransform: 'capitalize' }}>
                          {diff}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#3b1f2b' }}>{att.score ?? 0}</strong>
                        <span style={{ color: '#9a8a90', fontSize: '0.8rem' }}>
                          {' '}/ {att.total_marks ?? '-'}
                        </span>
                      </td>
                      <td>
                        {att.accuracy_percentage != null ? `${att.accuracy_percentage}%` : '-'}
                      </td>
                      <td>
                        <span className={`dash-status-badge status-${att.status}`}>
                          {att.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#9a8a90' }}>
                        {formatDate(att.started_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dash-empty-state-mini">
            <p>No student quiz attempts recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
