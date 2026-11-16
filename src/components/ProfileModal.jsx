import { useState } from 'react'
import { useAuth } from '../contexts/useAuth'

export default function ProfileModal({ onClose }) {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [collegeName, setCollegeName] = useState(profile?.college_name || '')
  const [branch, setBranch] = useState(profile?.branch || '')
  const [semester, setSemester] = useState(profile?.semester?.toString() || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.')
      return
    }

    if (semester && (parseInt(semester, 10) < 1 || parseInt(semester, 10) > 12)) {
      setError('Semester must be between 1 and 12.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await updateProfile({
        fullName: fullName.trim(),
        collegeName: collegeName.trim() || null,
        branch: branch.trim() || null,
        semester: semester || null,
      })

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess('Profile updated successfully!')
        setIsEditing(false)
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      setError(err.message || 'An error occurred while updating profile.')
    } finally {
      setLoading(false)
    }
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-profile" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="profile-header">
          <div className="profile-avatar-large">
            {getInitials(profile?.full_name || user?.email)}
          </div>
          <div>
            <h2>{profile?.full_name || 'Student'}</h2>
            <p className="profile-email">{user?.email}</p>
            {profile?.is_admin && <span className="profile-admin-tag">Admin</span>}
          </div>
        </div>

        {error && <div className="auth-message auth-error">{error}</div>}
        {success && <div className="auth-message auth-success">{success}</div>}

        {/* Profile Statistics Grid */}
        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <span className="stat-label">Total Score</span>
            <span className="stat-value">{profile?.total_score ?? 0}</span>
          </div>
          <div className="profile-stat-card">
            <span className="stat-label">Weekly Score</span>
            <span className="stat-value">{profile?.weekly_score ?? 0}</span>
          </div>
          <div className="profile-stat-card">
            <span className="stat-label">Quizzes Attempted</span>
            <span className="stat-value">{profile?.quizzes_attempted ?? 0}</span>
          </div>
        </div>

        {!isEditing ? (
          <div className="profile-details-view">
            <div className="profile-field">
              <span className="field-label">College</span>
              <span className="field-value">{profile?.college_name || 'Not specified'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Branch</span>
              <span className="field-value">{profile?.branch || 'Not specified'}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Semester</span>
              <span className="field-value">{profile?.semester ? `Semester ${profile.semester}` : 'Not specified'}</span>
            </div>

            <div className="profile-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setFullName(profile?.full_name || '')
                  setCollegeName(profile?.college_name || '')
                  setBranch(profile?.branch || '')
                  setSemester(profile?.semester?.toString() || '')
                  setIsEditing(true)
                }}
              >
                Edit Profile
              </button>
              <button
                type="button"
                className="btn-logout-modal"
                onClick={async () => {
                  await signOut()
                  onClose()
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="profile-edit-form">
            <div className="form-group">
              <label htmlFor="edit-name">Full Name</label>
              <input
                id="edit-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-college">College</label>
              <input
                id="edit-college"
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="e.g. LNCT&S Bhopal"
                disabled={loading}
              />
            </div>

            <div className="form-row">
              <div className="form-group form-half">
                <label htmlFor="edit-branch">Branch</label>
                <input
                  id="edit-branch"
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. CSE"
                  disabled={loading}
                />
              </div>
              <div className="form-group form-half">
                <label htmlFor="edit-semester">Semester</label>
                <input
                  id="edit-semester"
                  type="number"
                  min="1"
                  max="12"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="1-12"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="profile-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEditing(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
