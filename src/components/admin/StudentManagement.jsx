import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function StudentManagement() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCollege, setFilterCollege] = useState('all')
  const [sortBy, setSortBy] = useState('total_score')

  useEffect(() => {
    let ignore = false

    async function loadStudents() {
      if (!supabase) return
      setLoading(true)
      setError('')

      try {
        const { data, error: fetchErr } = await supabase
          .from('profiles')
          .select('id, full_name, college_name, branch, semester, avatar_url, is_admin, total_score, weekly_score, quizzes_attempted, created_at')
          .order('total_score', { ascending: false })

        if (fetchErr) throw new Error(fetchErr.message)
        if (!ignore) setStudents(data || [])
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load student roster.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadStudents()
    return () => { ignore = true }
  }, [])

  // Unique colleges
  const colleges = useMemo(() => {
    const set = new Set()
    students.forEach((s) => { if (s.college_name) set.add(s.college_name) })
    return Array.from(set).sort()
  }, [students])

  // Filtered and sorted
  const filtered = useMemo(() => {
    let list = students.filter((s) => {
      if (filterCollege !== 'all' && s.college_name !== filterCollege) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = s.full_name?.toLowerCase().includes(q)
        const collegeMatch = s.college_name?.toLowerCase().includes(q)
        const branchMatch = s.branch?.toLowerCase().includes(q)
        if (!nameMatch && !collegeMatch && !branchMatch) return false
      }
      return true
    })

    list.sort((a, b) => {
      if (sortBy === 'total_score') return (b.total_score || 0) - (a.total_score || 0)
      if (sortBy === 'weekly_score') return (b.weekly_score || 0) - (a.weekly_score || 0)
      if (sortBy === 'quizzes_attempted') return (b.quizzes_attempted || 0) - (a.quizzes_attempted || 0)
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '')
      if (sortBy === 'joined') return new Date(b.created_at) - new Date(a.created_at)
      return 0
    })

    return list
  }, [students, filterCollege, searchQuery, sortBy])

  // Summary stats
  const summary = useMemo(() => {
    const total = students.length
    const admins = students.filter((s) => s.is_admin).length
    const avgScore = total > 0
      ? Math.round(students.reduce((acc, s) => acc + (s.total_score || 0), 0) / total)
      : 0
    const totalAttempts = students.reduce((acc, s) => acc + (s.quizzes_attempted || 0), 0)
    return { total, admins, avgScore, totalAttempts }
  }, [students])

  const getInitials = (name) => {
    if (!name) return 'S'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  }

  return (
    <div className="dash-tab-container admin-students-container">
      {/* Header */}
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Student Roster & Activity</h1>
          <p className="dash-page-desc">
            Monitor candidate enrollment, lifetime scores, quiz completion rates and system privileges.
          </p>
        </div>
      </div>

      {error && (
        <div className="auth-message auth-error" style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Students</span>
            <span className="dash-stat-icon">👥</span>
          </div>
          <div className="dash-stat-value">{summary.total}</div>
          <div className="dash-stat-subtitle">{summary.admins} admin(s) in system</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Avg Student Score</span>
            <span className="dash-stat-icon">⭐</span>
          </div>
          <div className="dash-stat-value">{summary.avgScore}</div>
          <div className="dash-stat-subtitle">Points across all students</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Attempts</span>
            <span className="dash-stat-icon">🎯</span>
          </div>
          <div className="dash-stat-value">{summary.totalAttempts}</div>
          <div className="dash-stat-subtitle">Quizzes attempted platform-wide</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Colleges Represented</span>
            <span className="dash-stat-icon">🏛️</span>
          </div>
          <div className="dash-stat-value">{colleges.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="dash-filter-toolbar" style={{ marginBottom: 20 }}>
        <div className="dash-search-box">
          <span className="dash-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, college or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dash-search-input"
          />
          {searchQuery && (
            <button className="dash-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
        <div className="dash-filter-group" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="dash-select" value={filterCollege} onChange={(e) => setFilterCollege(e.target.value)}>
            <option value="all">All Colleges</option>
            {colleges.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="dash-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="total_score">Sort: Highest Score</option>
            <option value="weekly_score">Sort: Weekly Score</option>
            <option value="quizzes_attempted">Sort: Most Quizzes</option>
            <option value="name">Sort: Name (A-Z)</option>
            <option value="joined">Sort: Newest First</option>
          </select>
        </div>
      </div>

      {/* Student Table */}
      {loading ? (
        <div className="dash-loading-container">
          <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
          <p>Loading student profiles from Supabase...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>College</th>
                  <th>Branch & Sem</th>
                  <th>Total Score</th>
                  <th>Weekly</th>
                  <th>Quizzes</th>
                  <th>Role</th>
                  <th>Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #e8634a, #3b1f2b)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                        }}>
                          {getInitials(s.full_name)}
                        </div>
                        <strong style={{ color: '#3b1f2b' }}>{s.full_name || 'Student'}</strong>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#5e4a52', maxWidth: 180 }}>
                      {s.college_name || '—'}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#5e4a52' }}>
                      {s.branch || '—'}
                      {s.semester && <span style={{ marginLeft: 4, color: '#9a8a90' }}>• Sem {s.semester}</span>}
                    </td>
                    <td>
                      <strong style={{ color: '#e8634a' }}>⭐ {s.total_score || 0}</strong>
                    </td>
                    <td style={{ color: '#5e4a52' }}>
                      {s.weekly_score || 0}
                    </td>
                    <td style={{ color: '#3b1f2b', fontWeight: 600 }}>
                      {s.quizzes_attempted || 0}
                    </td>
                    <td>
                      {s.is_admin ? (
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                          fontSize: '0.72rem', fontWeight: 700,
                          color: '#e8634a', background: 'rgba(232, 99, 74, 0.1)',
                        }}>
                          Admin
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#9a8a90' }}>Student</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#9a8a90' }}>
                      {formatDate(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">👥</div>
          <h3>No students match your search</h3>
          <p>Try adjusting your filter criteria.</p>
        </div>
      )}
    </div>
  )
}
