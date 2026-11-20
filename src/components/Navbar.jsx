import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/useAuth'

const navItems = [
  { label: 'Home', target: 'hero' },
  { label: 'Explore', target: 'categories' },
  { label: 'Leaderboard', target: 'leaderboard' },
  { label: 'Study Hub', target: 'track' },
]

const rightLinks = [
  { label: 'For Colleges', target: 'how-it-works' },
  { label: 'Pricing', target: 'track' },
]

export default function Navbar({
  onLogin,
  onSignUp,
  onOpenProfile,
  onOpenDashboard,
  onOpenAdmin,
  scrollTo,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const { user, profile, isAuthenticated, signOut } = useAuth()
  const dropdownRef = useRef(null)

  const handleNav = (target) => {
    scrollTo(target)
    setMobileOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getInitials = (name) => {
    if (!name) return 'S'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const handleLogout = async () => {
    setUserDropdownOpen(false)
    setMobileOpen(false)
    await signOut()
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="nav-left">
            <div className="logo" onClick={() => scrollTo('hero')}>
              <img
                src="/brainvash-new-logo.png"
                alt="BrainVash logo"
                className="logo-img"
              />
              <span className="logo-text">Brain<span>Vash</span></span>
            </div>
            <ul className="nav-links">
              {navItems.map(item => (
                <li key={item.label}>
                  <button onClick={() => handleNav(item.target)}>{item.label}</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="nav-right">
            <div className="nav-right-links">
              {rightLinks.map(item => (
                <button key={item.label} onClick={() => handleNav(item.target)}>
                  {item.label}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  className="btn-dashboard-nav"
                  onClick={onOpenDashboard}
                  title="Open Student Dashboard"
                >
                  Dashboard ⚡
                </button>

                <div className="user-menu-container" ref={dropdownRef}>
                  <button
                    className="user-menu-btn"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    aria-label="User menu"
                  >
                    <div className="user-avatar-circle">
                      {getInitials(profile?.full_name || user?.email)}
                    </div>
                    <span className="user-name-label">
                      {profile?.full_name?.split(' ')[0] || 'Student'}
                    </span>
                    <span className="user-chevron">▼</span>
                  </button>

                  {userDropdownOpen && (
                    <div className="user-dropdown-menu">
                      <div className="user-dropdown-header">
                        <div className="dropdown-user-name">
                          {profile?.full_name || 'Student'}
                          {profile?.is_admin && <span className="dropdown-admin-tag">Admin</span>}
                        </div>
                        <div className="dropdown-user-email">{user?.email}</div>
                        {profile?.college_name && (
                          <div className="dropdown-user-college">{profile.college_name}</div>
                        )}
                        <div className="dropdown-user-score">
                          ⭐ {profile?.total_score ?? 0} pts
                        </div>
                      </div>
                      <div className="user-dropdown-divider" />
                      {profile?.is_admin && onOpenAdmin && (
                        <button
                          className="user-dropdown-item"
                          onClick={() => {
                            setUserDropdownOpen(false)
                            onOpenAdmin()
                          }}
                          style={{ color: '#e8634a', fontWeight: 600 }}
                        >
                          <span>⚙️</span> Admin Console
                        </button>
                      )}
                      <button
                        className="user-dropdown-item"
                        onClick={() => {
                          setUserDropdownOpen(false)
                          onOpenDashboard()
                        }}
                      >
                        <span>📊</span> Student Dashboard
                      </button>
                      <button
                        className="user-dropdown-item"
                        onClick={() => {
                          setUserDropdownOpen(false)
                          onOpenProfile()
                        }}
                      >
                        <span>👤</span> My Profile
                      </button>
                      <button
                        className="user-dropdown-item user-dropdown-logout"
                        onClick={handleLogout}
                      >
                        <span>🚪</span> Log Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button className="btn-login" onClick={onLogin}>Login</button>
                <button className="btn-signup" onClick={onSignUp}>Sign Up</button>
              </>
            )}

            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-nav ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <div className="logo" onClick={() => handleNav('hero')}>
            <img
              src="/brainvash-logo-transparent.png"
              alt="BrainVash logo"
              className="logo-img"
            />
            <span className="logo-text">Brain<span>Vash</span></span>
          </div>
          <button className="mobile-nav-close" onClick={() => setMobileOpen(false)}>×</button>
        </div>
        <ul className="mobile-nav-links">
          {[...navItems, ...rightLinks].map(item => (
            <li key={item.label}>
              <button onClick={() => handleNav(item.target)}>{item.label}</button>
            </li>
          ))}
        </ul>
        <div className="mobile-nav-actions">
          {isAuthenticated ? (
            <div className="mobile-auth-section">
              <div className="mobile-user-card" onClick={() => { setMobileOpen(false); onOpenDashboard() }}>
                <div className="user-avatar-circle">
                  {getInitials(profile?.full_name || user?.email)}
                </div>
                <div className="mobile-user-info">
                  <div className="mobile-user-name">{profile?.full_name || 'Student'}</div>
                  <div className="mobile-user-score">{profile?.total_score ?? 0} pts • {profile?.college_name || user?.email}</div>
                </div>
              </div>
              <div className="mobile-auth-buttons">
                <button
                  className="btn-profile-mobile"
                  onClick={() => { setMobileOpen(false); onOpenDashboard() }}
                >
                  Dashboard ⚡
                </button>
                <button className="btn-logout-mobile" onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn-login" onClick={() => { setMobileOpen(false); onLogin() }}>Login</button>
              <button className="btn-signup" onClick={() => { setMobileOpen(false); onSignUp() }}>Sign Up</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
