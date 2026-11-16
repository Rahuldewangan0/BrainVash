export default function DashboardHeader({
  activeTab,
  onOpenMobileSidebar,
  onNavigateHome,
  onNavigateAdmin,
  onOpenProfile,
  profile,
  user,
}) {
  const getTabTitle = (tab) => {
    switch (tab) {
      case 'overview':
        return 'Student Overview'
      case 'quizzes':
        return 'Available Quizzes'
      case 'results':
        return 'My Quiz Results'
      case 'analytics':
        return 'Performance Analytics'
      case 'leaderboard':
        return 'College Leaderboard'
      case 'study-hub':
        return 'Study Hub & Resources'
      case 'settings':
        return 'Account Settings'
      default:
        return 'Dashboard'
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
    <header className="dash-top-header">
      <div className="dash-header-left">
        <button
          className="dash-menu-toggle"
          onClick={onOpenMobileSidebar}
          aria-label="Open sidebar"
        >
          <span />
          <span />
          <span />
        </button>
        <div className="dash-breadcrumb">
          <span className="dash-bc-root" onClick={onNavigateHome}>BrainVash</span>
          <span className="dash-bc-sep">/</span>
          <span className="dash-bc-current">{getTabTitle(activeTab)}</span>
        </div>
      </div>

      <div className="dash-header-right">
        {/* Points Pill */}
        <div className="dash-score-pill" title="Your total accumulated points">
          <span className="dash-score-icon">⭐</span>
          <span className="dash-score-val">{profile?.total_score ?? 0}</span>
          <span className="dash-score-unit">pts</span>
        </div>

        {/* Admin Panel button if user has admin privileges */}
        {profile?.is_admin && onNavigateAdmin && (
          <button
            className="dash-btn-admin-shortcut"
            onClick={onNavigateAdmin}
            title="Open Admin Console"
          >
            <span>⚙️</span>
            <span>Admin</span>
          </button>
        )}

        {/* Back to Homepage */}
        <button
          className="dash-btn-site"
          onClick={onNavigateHome}
          title="Return to public homepage"
        >
          <span>Website</span>
          <span>↗</span>
        </button>

        {/* Profile Avatar */}
        <button
          className="dash-avatar-btn"
          onClick={onOpenProfile}
          title="Open Profile"
        >
          <div className="dash-header-avatar">
            {getInitials(profile?.full_name || user?.email)}
          </div>
          <span className="dash-header-username">
            {profile?.full_name?.split(' ')[0] || 'Student'}
          </span>
        </button>
      </div>
    </header>
  )
}
