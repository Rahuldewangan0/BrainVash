export default function DashboardSidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  onNavigateHome,
  onNavigateAdmin,
  profile,
  user,
  onLogout,
  onOpenProfile,
}) {
  const getInitials = (name) => {
    if (!name) return 'S'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'quizzes', label: 'Available Quizzes', icon: '📝' },
    { id: 'results', label: 'My Results', icon: '🎯' },
    { id: 'analytics', label: 'Performance', icon: '📈' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'study-hub', label: 'Study Hub', icon: '📚' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId)
    if (setMobileOpen) setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="dash-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`dash-sidebar ${mobileOpen ? 'open' : ''}`}>

        {/* Brand / Logo */}
        <div className="dash-sidebar-header">
          <div className="logo" onClick={onNavigateHome}>
            <img
              src="/brainvash-new-logo.png"
              alt="BrainVash"
              className="h-9 w-auto object-contain"
            />
            <span className="logo-text">
              Brain<span>Vash</span>
            </span>
          </div>

          <span className="dash-portal-tag">Student</span>

          {setMobileOpen && (
            <button
              className="dash-sidebar-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="dash-sidebar-nav">
          <div className="dash-nav-section-label">MAIN MENU</div>
          <ul className="dash-nav-list">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  className={`dash-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => handleSelectTab(item.id)}
                >
                  <span className="dash-nav-icon">{item.icon}</span>
                  <span className="dash-nav-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="dash-nav-section-label">SHORTCUTS</div>
          <ul className="dash-nav-list">
            {profile?.is_admin && onNavigateAdmin && (
              <li>
                <button
                  className="dash-nav-item dash-nav-admin"
                  onClick={() => {
                    if (setMobileOpen) setMobileOpen(false)
                    onNavigateAdmin()
                  }}
                  style={{
                    background: 'rgba(232, 99, 74, 0.08)',
                    color: '#e8634a',
                    fontWeight: 600,
                  }}
                >
                  <span className="dash-nav-icon">⚙️</span>
                  <span className="dash-nav-label">Admin Console</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.65rem',
                      background: '#e8634a',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Admin
                  </span>
                </button>
              </li>
            )}
            <li>
              <button
                className="dash-nav-item"
                onClick={onOpenProfile}
              >
                <span className="dash-nav-icon">👤</span>
                <span className="dash-nav-label">My Profile</span>
              </button>
            </li>
            <li>
              <button
                className="dash-nav-item"
                onClick={onNavigateHome}
              >
                <span className="dash-nav-icon">🌐</span>
                <span className="dash-nav-label">Back to Website</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* User Mini Profile & Logout */}
        <div className="dash-sidebar-footer">
          <div className="dash-user-card" onClick={onOpenProfile} title="View Profile">
            <div className="dash-user-avatar">
              {getInitials(profile?.full_name || user?.email)}
            </div>
            <div className="dash-user-info">
              <div className="dash-user-name">
                {profile?.full_name || 'Student'}
              </div>
              <div className="dash-user-sub">
                {profile?.college_name || user?.email || 'College Student'}
              </div>
            </div>
          </div>
          <button
            className="dash-btn-logout"
            onClick={onLogout}
            title="Sign out of your account"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
