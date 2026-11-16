import { useState } from 'react'
import { useAuth } from '../contexts/useAuth'

export default function ResetPasswordModal({ onClose }) {
  const { updatePassword, setPasswordRecoveryMode } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await updatePassword(newPassword)
      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess('Password updated successfully! You can now continue.')
        setTimeout(() => {
          setPasswordRecoveryMode(false)
          onClose()
        }, 1500)
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPasswordRecoveryMode(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>×</button>
        <h2>Set New Password</h2>
        <p className="modal-desc">Enter your new secure password below.</p>

        {error && <div className="auth-message auth-error">{error}</div>}
        {success && <div className="auth-message auth-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-new-password">New Password</label>
            <input
              id="reset-new-password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reset-confirm-password">Confirm New Password</label>
            <input
              id="reset-confirm-password"
              type="password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" /> Updating Password...
              </span>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
