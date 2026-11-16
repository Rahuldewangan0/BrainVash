import { useState } from 'react'

export default function SettingsTab({
  profile,
  user,
  onOpenProfile,
  onLogout,
  onResetPassword,
}) {
  const [resetMessage, setResetMessage] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleSendReset = async () => {
    if (!user?.email) return
    setResetLoading(true)
    setResetMessage('')
    try {
      const { error } = await onResetPassword(user.email)
      if (error) {
        setResetMessage(`Error: ${error.message}`)
      } else {
        setResetMessage('Password reset link sent to your email!')
      }
    } catch (err) {
      setResetMessage(`Error: ${err.message}`)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="dash-tab-container">
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Account Settings</h1>
          <p className="dash-page-desc">
            Manage your personal profile, credentials, and notification settings.
          </p>
        </div>
      </div>

      <div className="dash-two-col-grid">
        {/* Profile Details Card */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Student Profile</h2>
              <p className="dash-card-subtitle">Your personal academic information</p>
            </div>
            <button className="dash-link-action" onClick={onOpenProfile}>
              Edit →
            </button>
          </div>

          <div className="dash-settings-list">
            <div className="dash-setting-row">
              <span className="setting-label">Full Name</span>
              <span className="setting-value">{profile?.full_name || 'Student'}</span>
            </div>
            <div className="dash-setting-row">
              <span className="setting-label">Email Address</span>
              <span className="setting-value">{user?.email}</span>
            </div>
            <div className="dash-setting-row">
              <span className="setting-label">College</span>
              <span className="setting-value">{profile?.college_name || 'Not configured'}</span>
            </div>
            <div className="dash-setting-row">
              <span className="setting-label">Branch</span>
              <span className="setting-value">{profile?.branch || 'Not configured'}</span>
            </div>
            <div className="dash-setting-row">
              <span className="setting-label">Current Semester</span>
              <span className="setting-value">
                {profile?.semester ? `Semester ${profile.semester}` : 'Not configured'}
              </span>
            </div>
          </div>
        </div>

        {/* Security & Preferences Card */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Security & Credentials</h2>
              <p className="dash-card-subtitle">Password recovery and session management</p>
            </div>
          </div>

          <div className="dash-settings-body">
            <div className="dash-setting-action-block">
              <div>
                <h4>Change Password</h4>
                <p>Send a secure password recovery email to reset your account password.</p>
              </div>
              <button
                className="btn-secondary"
                onClick={handleSendReset}
                disabled={resetLoading}
              >
                {resetLoading ? 'Sending...' : 'Send Reset Email'}
              </button>
            </div>

            {resetMessage && (
              <div
                className={`auth-message ${
                  resetMessage.startsWith('Error') ? 'auth-error' : 'auth-success'
                }`}
                style={{ marginTop: 12 }}
              >
                {resetMessage}
              </div>
            )}

            <div className="dash-setting-action-block" style={{ marginTop: 24, borderTop: '1px solid #f3e0d5', paddingTop: 20 }}>
              <div>
                <h4>Session Logout</h4>
                <p>Sign out of your BrainVash student session on this browser.</p>
              </div>
              <button
                className="dash-btn-logout"
                style={{ padding: '8px 16px', borderRadius: 8 }}
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
