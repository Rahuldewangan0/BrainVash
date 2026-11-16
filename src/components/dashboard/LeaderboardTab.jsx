import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LeaderboardTab({ profile, user }) {
  const [scope, setScope] = useState('weekly')
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadLeaderboard() {
      if (!supabase) return
      try {
        const { data, error: rpcError } = await supabase.rpc('get_leaderboard', {
          p_scope: scope,
          p_limit: 25,
        })

        if (rpcError) {
          if (!ignore) setError(rpcError.message)
        } else if (!ignore) {
          setLeaderboard(data || [])
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load leaderboard.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadLeaderboard()
    return () => {
      ignore = true
    }
  }, [scope, retryCount])

  const handleRetry = () => {
    setLoading(true)
    setError('')
    setRetryCount((prev) => prev + 1)
  }

  const getInitials = (name) => {
    if (!name) return 'S'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="dash-tab-container">
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">College Leaderboard</h1>
          <p className="dash-page-desc">
            See where you rank against students from your college and across the platform.
          </p>
        </div>
      </div>

      {/* Scope Toggles */}
      <div className="dash-category-tabs">
        <button
          className={`dash-cat-pill ${scope === 'weekly' ? 'active' : ''}`}
          onClick={() => setScope('weekly')}
        >
          🏆 Weekly Rankings
        </button>
        <button
          className={`dash-cat-pill ${scope === 'overall' ? 'active' : ''}`}
          onClick={() => setScope('overall')}
        >
          ⭐ All-Time Overall
        </button>
      </div>

      {/* Current Student Standing Banner */}
      <div className="dash-standing-banner">
        <div className="dash-standing-info">
          <span className="dash-standing-label">YOUR CURRENT STANDING</span>
          <div className="dash-standing-row">
            <span className="dash-standing-name">
              {profile?.full_name || 'Student'} ({profile?.college_name || 'Independent'})
            </span>
            <span className="dash-standing-points">
              {scope === 'weekly' ? profile?.weekly_score ?? 0 : profile?.total_score ?? 0} pts
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="dash-card dash-loading-state">
          <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
          <p>Loading real-time leaderboard standings...</p>
        </div>
      ) : error ? (
        <div className="dash-card dash-empty-state">
          <p style={{ color: '#c81e1e' }}>{error}</p>
          <button className="btn-secondary" onClick={handleRetry}>
            Retry
          </button>
        </div>
      ) : leaderboard.length > 0 ? (
        <div className="dash-card">
          <div className="dash-table-responsive">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Student</th>
                  <th>College</th>
                  <th>Quizzes Taken</th>
                  <th style={{ textAlign: 'right' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => {
                  const isCurrent = entry.user_id === user?.id
                  return (
                    <tr
                      key={entry.user_id || entry.rank}
                      className={isCurrent ? 'dash-row-highlight' : ''}
                    >
                      <td>
                        <span className={`dash-rank-badge rank-${entry.rank}`}>
                          {entry.rank}
                        </span>
                      </td>
                      <td>
                        <div className="dash-table-user-cell">
                          <div className="dash-mini-avatar">
                            {getInitials(entry.full_name)}
                          </div>
                          <div>
                            <span className="dash-table-username">
                              {entry.full_name}
                              {isCurrent && <span className="dash-you-tag">YOU</span>}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="dash-table-college">
                          {entry.college_name || 'Independent Learner'}
                        </span>
                      </td>
                      <td>{entry.quizzes_attempted}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#e8634a' }}>
                        {entry.score} pts
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="dash-card dash-empty-state">
          <div className="dash-empty-icon">🏆</div>
          <h3>No students ranked yet for this period</h3>
          <p>
            Complete quizzes to earn points and claim the #1 spot on the leaderboard!
          </p>
        </div>
      )}
    </div>
  )
}
