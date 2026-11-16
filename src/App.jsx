import { useState, useEffect, useRef } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeatureHighlights from './components/FeatureHighlights'
import QuizCategories from './components/QuizCategories'
import DailyAndLeaderboard from './components/DailyAndLeaderboard'
import TrackSection from './components/TrackSection'
import HowItWorks from './components/HowItWorks'
import Footer from './components/Footer'
import LoginModal from './components/LoginModal'
import SignUpModal from './components/SignUpModal'
import ProfileModal from './components/ProfileModal'
import ResetPasswordModal from './components/ResetPasswordModal'
import Dashboard from './components/Dashboard'
import AdminPanel from './components/admin/AdminPanel'
import { useAuth } from './contexts/useAuth'
import './App.css'

function App() {
  const { isAuthenticated, loading, passwordRecoveryMode, setPasswordRecoveryMode } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const prevAuthRef = useRef(isAuthenticated)

  // Track view: 'home' | 'dashboard' | 'admin'
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('admin')) return 'admin'
      if (window.location.hash.includes('dashboard')) return 'dashboard'
    }
    return 'home'
  })

  // Synchronize hash with view
  const switchView = (view) => {
    setCurrentView(view)
    if (typeof window !== 'undefined') {
      if (view === 'admin') {
        window.location.hash = '#admin'
      } else if (view === 'dashboard') {
        window.location.hash = '#dashboard'
      } else {
        window.location.hash = '#home'
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handle auth state transitions and session persistence
  useEffect(() => {
    if (loading) return

    const timer = setTimeout(() => {
      if (!prevAuthRef.current && isAuthenticated) {
        // User just logged in or session restored from storage
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        if (hash.includes('admin')) {
          setCurrentView('admin')
        } else if (hash.includes('dashboard')) {
          setCurrentView('dashboard')
        } else {
          setCurrentView('dashboard')
          if (typeof window !== 'undefined') {
            window.location.hash = '#dashboard'
          }
        }
      } else if (prevAuthRef.current && !isAuthenticated) {
        // User logged out
        setCurrentView('home')
        if (typeof window !== 'undefined') {
          window.location.hash = '#home'
        }
      } else if (!isAuthenticated) {
        // Unauthenticated visitor trying to access protected hash routes
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        if (hash.includes('admin') || hash.includes('dashboard')) {
          if (typeof window !== 'undefined') {
            window.location.hash = '#home'
          }
          setShowLogin(true)
        }
      }
      prevAuthRef.current = isAuthenticated
    }, 0)

    return () => clearTimeout(timer)
  }, [isAuthenticated, loading])

  // Listen to hash changes (e.g. browser back/forward or manual address bar navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash.includes('admin')) {
        if (isAuthenticated) {
          setCurrentView('admin')
        } else {
          setCurrentView('home')
          setShowLogin(true)
        }
      } else if (hash.includes('dashboard')) {
        if (isAuthenticated) {
          setCurrentView('dashboard')
        } else {
          setCurrentView('home')
          setShowLogin(true)
        }
      } else {
        setCurrentView('home')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [isAuthenticated])

  const scrollTo = (id) => {
    if (currentView !== 'home') {
      switchView('home')
      setTimeout(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } else {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Loading state when navigating directly to a protected view while session is restoring
  if (loading && (currentView === 'admin' || currentView === 'dashboard')) {
    return (
      <div className="dash-loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a', width: 36, height: 36 }} />
        <p style={{ marginTop: 16, color: '#5e4a52' }}>
          {currentView === 'admin' ? 'Verifying administrative permissions...' : 'Loading student dashboard...'}
        </p>
      </div>
    )
  }

  // If viewing admin console and authenticated, show AdminPanel
  if (currentView === 'admin' && isAuthenticated) {
    return (
      <div className="app">
        <AdminPanel
          onNavigateHome={() => switchView('home')}
          onNavigateDashboard={() => switchView('dashboard')}
        />

        {showProfile && (
          <ProfileModal
            onClose={() => setShowProfile(false)}
          />
        )}

        {passwordRecoveryMode && (
          <ResetPasswordModal
            onClose={() => setPasswordRecoveryMode(false)}
          />
        )}

        <SpeedInsights />
      </div>
    )
  }

  // If viewing dashboard and authenticated, show Dashboard
  if (currentView === 'dashboard' && isAuthenticated) {
    return (
      <div className="app">
        <Dashboard
          onNavigateHome={() => switchView('home')}
          onNavigateAdmin={() => switchView('admin')}
        />

        {showProfile && (
          <ProfileModal
            onClose={() => setShowProfile(false)}
          />
        )}

        {passwordRecoveryMode && (
          <ResetPasswordModal
            onClose={() => setPasswordRecoveryMode(false)}
          />
        )}

        <SpeedInsights />
      </div>
    )
  }

  // Otherwise render public homepage
  return (
    <div className="app">
      <Navbar
        onLogin={() => setShowLogin(true)}
        onSignUp={() => setShowSignUp(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenDashboard={() => switchView('dashboard')}
        onOpenAdmin={() => switchView('admin')}
        scrollTo={scrollTo}
      />
      <Hero scrollTo={scrollTo} />
      <FeatureHighlights />
      <QuizCategories />
      <DailyAndLeaderboard />
      <TrackSection />
      <HowItWorks />
      <Footer scrollTo={scrollTo} />

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSwitchToSignUp={() => { setShowLogin(false); setShowSignUp(true) }}
        />
      )}

      {showSignUp && (
        <SignUpModal
          onClose={() => setShowSignUp(false)}
          onSwitchToLogin={() => { setShowSignUp(false); setShowLogin(true) }}
        />
      )}

      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
        />
      )}

      {passwordRecoveryMode && (
        <ResetPasswordModal
          onClose={() => setPasswordRecoveryMode(false)}
        />
      )}

      <SpeedInsights />
    </div>
  )
}

export default App
