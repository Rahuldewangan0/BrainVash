import { useState } from 'react'
import { useAuth } from '../contexts/useAuth'

export default function LoginModal({ onClose, onSwitchToSignUp }) {
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)
    try {
      const { error: signInError } = await signIn({
        email: email.trim(),
        password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please confirm your email address before logging in. Check your inbox.')
        } else {
          setError(signInError.message)
        }
      } else {
        setSuccess('Welcome back!')
        setTimeout(() => onClose(), 800)
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!resetEmail.trim()) {
      setError('Please enter your email address.')
      return
    }

    setResetLoading(true)
    try {
      const { error: resetError } = await resetPassword(resetEmail.trim())

      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess('Password reset email sent! Check your inbox.')
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setResetLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>×</button>
          <h2>Reset Password</h2>
          <p className="modal-desc">Enter your email and we'll send you a reset link.</p>

          {error && <div className="auth-message auth-error">{error}</div>}
          {success && <div className="auth-message auth-success">{success}</div>}

          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@college.edu"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetLoading}
                required
              />
            </div>
            <button type="submit" className="btn-submit" disabled={resetLoading}>
              {resetLoading ? (
                <span className="btn-loading">
                  <span className="spinner" /> Sending...
                </span>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="modal-switch">
            Remember your password?
            <button onClick={() => { setShowForgotPassword(false); setError(''); setSuccess('') }}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Welcome back</h2>
        <p className="modal-desc">Log in to continue your learning journey.</p>

        {error && <div className="auth-message auth-error">{error}</div>}
        {success && <div className="auth-message auth-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-forgot">
            <button
              type="button"
              className="forgot-link"
              onClick={() => { setShowForgotPassword(true); setResetEmail(email); setError(''); setSuccess('') }}
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" /> Logging in...
              </span>
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="modal-switch">
          Don't have an account?
          <button onClick={onSwitchToSignUp} disabled={loading}>Sign Up</button>
        </div>
      </div>
    </div>
  )
}
