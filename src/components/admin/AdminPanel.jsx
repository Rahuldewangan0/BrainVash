import { useState } from 'react'
import { useAuth } from '../../contexts/useAuth'
import AdminOverview from './AdminOverview'
import QuizManagement from './QuizManagement'
import QuestionBank from './QuestionBank'
import SubjectManagement from './SubjectManagement'
import StudentManagement from './StudentManagement'

export default function AdminPanel({ onNavigateHome, onNavigateDashboard }) {
  const { user, profile, loading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Loading state
  if (loading) {
    return (
      <div className="dash-loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a', width: 36, height: 36 }} />
        <p style={{ marginTop: 16, color: '#5e4a52' }}>Verifying administrative permissions...</p>
      </div>
    )
  }

  // Security guard: Non-admin or unauthenticated access
  if (!user || !profile?.is_admin) {
    return (
      <div className="dash-loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛡️</div>
        <h2 style={{ color: '#3b1f2b', marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: '#5e4a52', maxWidth: 440, marginBottom: 20 }}>
          You do not have administrator permissions to access the BrainVash Admin Console. This incident is logged.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" onClick={onNavigateDashboard}>
            Go to Student Dashboard
          </button>
          <button className="btn-secondary" onClick={onNavigateHome}>
            Return to Homepage
          </button>
        </div>
      </div>
    )
  }

  const getInitials = (name) => {
    if (!name) return 'A'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'quizzes', label: 'Quiz Management', icon: '📝' },
    { id: 'questions', label: 'Question Bank', icon: '🗄️' },
    { id: 'subjects', label: 'Curriculum Subjects', icon: '📚' },
    { id: 'students', label: 'Student Roster', icon: '👥' },
  ]

  const getTabTitle = (tab) => {
    switch (tab) {
      case 'overview':
        return 'System Overview & KPIs'
      case 'quizzes':
        return 'Quiz & Assessment Management'
      case 'questions':
        return 'Question Bank & Difficulty'
      case 'subjects':
        return 'Curriculum Subjects'
      case 'students':
        return 'Student Profiles & Logs'
      default:
        return 'Admin Console'
    }
  }

  return (
    <div className="dash-layout admin-layout">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="dash-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Admin Sidebar */}
      <aside className={`dash-sidebar admin-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="dash-sidebar-header">
          <div className="logo" onClick={onNavigateHome} style={{ cursor: 'pointer' }}>
            <img
              src="/brainvash-logo-transparent.png"
              alt="BrainVash logo"
              className="logo-img"
            />
            <span className="logo-text">
              Brain<span>Vash</span>
            </span>
          </div>
          <span
            className="dash-portal-tag"
            style={{ background: '#e8634a', color: '#fff', fontWeight: 700 }}
          >
            Admin
          </span>
          <button
            className="dash-sidebar-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* Navigation list */}
        <nav className="dash-sidebar-nav">
          <div className="dash-nav-section-label">ADMIN CONTROLS</div>
          <ul className="dash-nav-list">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  className={`dash-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(item.id)
                    setMobileSidebarOpen(false)
                  }}
                >
                  <span className="dash-nav-icon">{item.icon}</span>
                  <span className="dash-nav-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="dash-nav-section-label">PORTAL SWITCH</div>
          <ul className="dash-nav-list">
            <li>
              <button
                className="dash-nav-item"
                onClick={onNavigateDashboard}
                title="Switch to Student Dashboard view"
              >
                <span className="dash-nav-icon">⚡</span>
                <span className="dash-nav-label">Student View</span>
              </button>
            </li>
            <li>
              <button
                className="dash-nav-item"
                onClick={onNavigateHome}
                title="Return to public homepage"
              >
                <span className="dash-nav-icon">🌐</span>
                <span className="dash-nav-label">Public Website</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Footer Admin profile & Sign Out */}
        <div className="dash-sidebar-footer">
          <div className="dash-user-card" title="Administrator Account">
            <div
              className="dash-user-avatar"
              style={{ background: 'linear-gradient(135deg, #e8634a, #2d1520)' }}
            >
              {getInitials(profile?.full_name || user?.email)}
            </div>
            <div className="dash-user-info">
              <div className="dash-user-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{profile?.full_name?.split(' ')[0] || 'Admin'}</span>
                <span style={{ fontSize: '0.65rem', background: '#e8634a', color: '#fff', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>
                  ADMIN
                </span>
              </div>
              <div className="dash-user-sub">{user?.email}</div>
            </div>
          </div>
          <button
            className="dash-btn-logout"
            onClick={signOut}
            title="Sign out of administrative session"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dash-main-area admin-main-area">
        {/* Top Header */}
        <header className="dash-top-header admin-top-header">
          <div className="dash-header-left">
            <button
              className="dash-menu-toggle"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <span />
              <span />
              <span />
            </button>
            <div className="dash-breadcrumb">
              <span className="dash-bc-root" onClick={onNavigateHome} style={{ cursor: 'pointer' }}>
                BrainVash
              </span>
              <span className="dash-bc-sep">/</span>
              <span style={{ color: '#e8634a', fontWeight: 600 }}>Console</span>
              <span className="dash-bc-sep">/</span>
              <span className="dash-bc-current">{getTabTitle(activeTab)}</span>
            </div>
          </div>

          <div className="dash-header-right">
            {/* Role indicator pill */}
            <div
              className="dash-score-pill"
              style={{ background: 'rgba(232, 99, 74, 0.1)', borderColor: 'rgba(232, 99, 74, 0.25)' }}
              title="Verified Administrator Session"
            >
              <span className="dash-score-icon">🛡️</span>
              <span className="dash-score-val" style={{ color: '#e8634a', fontSize: '0.85rem' }}>
                Admin
              </span>
            </div>

            {/* Switch to Student Portal */}
            <button
              className="dash-btn-site"
              onClick={onNavigateDashboard}
              title="Switch to Student Dashboard"
              style={{ background: '#faf5ef', color: '#3b1f2b' }}
            >
              <span>Student View</span>
              <span>⚡</span>
            </button>

            {/* Website Home */}
            <button
              className="dash-btn-site"
              onClick={onNavigateHome}
              title="View Public Website"
            >
              <span>Site</span>
              <span>↗</span>
            </button>
          </div>
        </header>

        {/* Body tab content */}
        <main className="dash-content-body admin-content-body">
          {activeTab === 'overview' && (
            <AdminOverview onNavigateTab={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'quizzes' && (
            <QuizManagement />
          )}

          {activeTab === 'questions' && (
            <QuestionBank />
          )}

          {activeTab === 'subjects' && (
            <SubjectManagement />
          )}

          {activeTab === 'students' && (
            <StudentManagement />
          )}
        </main>
      </div>
    </div>
  )
}
