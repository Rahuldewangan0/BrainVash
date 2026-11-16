import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/useAuth'

export default function SignUpModal({ onClose, onSwitchToLogin }) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [branch, setBranch] = useState('')
  const [semester, setSemester] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [colleges, setColleges] = useState([])
  const [collegeSearch, setCollegeSearch] = useState('')
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch colleges from database
  useEffect(() => {
    if (!supabase) return
    const fetchColleges = async () => {
      const { data, error } = await supabase
        .from('colleges')
        .select('id, name, city, state')
        .order('name', { ascending: true })
      if (!error && data) {
        setColleges(data)
      }
    }
    fetchColleges()
  }, [])

  const filteredColleges = colleges.filter((c) =>
    c.name.toLowerCase().includes(collegeSearch.toLowerCase()) ||
    c.city.toLowerCase().includes(collegeSearch.toLowerCase())
  )

  const validate = () => {
    if (!name.trim() || name.trim().length < 2) {
      return 'Full name must be at least 2 characters.'
    }
    if (!email.trim()) {
      return 'Email is required.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address.'
    }
    if (!password) {
      return 'Password is required.'
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters.'
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.'
    }
    if (semester && (parseInt(semester, 10) < 1 || parseInt(semester, 10) > 12)) {
      return 'Semester must be between 1 and 12.'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const { data, error: signUpError } = await signUp({
        email: email.trim(),
        password,
        fullName: name.trim(),
        collegeName: collegeName.trim() || null,
        branch: branch.trim() || null,
        semester: semester || null,
      })

      if (signUpError) {
        setError(signUpError.message)
      } else if (data?.user && !data?.session) {
        // Email confirmation required
        setSuccess('Account created! Please check your email to confirm your account, then log in.')
      } else {
        // Auto-confirmed, signed in directly
        setSuccess('Account created successfully! Welcome to BrainVash!')
        setTimeout(() => onClose(), 1500)
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const selectCollege = (college) => {
    setCollegeName(college.name)
    setCollegeSearch(college.name)
    setShowCollegeDropdown(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-signup" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Join BrainVash</h2>
        <p className="modal-desc">Create your account and start learning today.</p>

        {error && <div className="auth-message auth-error">{error}</div>}
        {success && <div className="auth-message auth-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              type="text"
              placeholder="Rahul Dewangan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group college-group">
            <label htmlFor="signup-college">College</label>
            <input
              id="signup-college"
              type="text"
              placeholder="Search or type your college name"
              value={collegeSearch || collegeName}
              onChange={(e) => {
                setCollegeSearch(e.target.value)
                setCollegeName(e.target.value)
                setShowCollegeDropdown(true)
              }}
              onFocus={() => setShowCollegeDropdown(true)}
              onBlur={() => setTimeout(() => setShowCollegeDropdown(false), 200)}
              disabled={loading}
              autoComplete="off"
            />
            {showCollegeDropdown && filteredColleges.length > 0 && (
              <div className="college-dropdown">
                {filteredColleges.slice(0, 6).map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="college-option"
                    onMouseDown={() => selectCollege(c)}
                  >
                    <span className="college-option-name">{c.name}</span>
                    <span className="college-option-city">{c.city}, {c.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group form-half">
              <label htmlFor="signup-branch">Branch</label>
              <input
                id="signup-branch"
                type="text"
                placeholder="e.g., CSE"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group form-half">
              <label htmlFor="signup-semester">Semester</label>
              <input
                id="signup-semester"
                type="number"
                placeholder="1-12"
                min="1"
                max="12"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-confirm-password">Confirm Password</label>
            <input
              id="signup-confirm-password"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" /> Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="modal-switch">
          Already have an account?
          <button onClick={onSwitchToLogin} disabled={loading}>Log In</button>
        </div>
      </div>
    </div>
  )
}
