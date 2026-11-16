import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/useAuth'
import DashboardSidebar from './dashboard/DashboardSidebar'
import DashboardHeader from './dashboard/DashboardHeader'
import OverviewTab from './dashboard/OverviewTab'
import QuizzesTab from './dashboard/QuizzesTab'
import ResultsTab from './dashboard/ResultsTab'
import AnalyticsTab from './dashboard/AnalyticsTab'
import LeaderboardTab from './dashboard/LeaderboardTab'
import StudyHubTab from './dashboard/StudyHubTab'
import SettingsTab from './dashboard/SettingsTab'
import QuizReviewModal from './dashboard/QuizReviewModal'
import QuizRunnerModal from './dashboard/QuizRunnerModal'
import DifficultySelectionModal from './DifficultySelectionModal'
import ProfileModal from './ProfileModal'

export default function Dashboard({ onNavigateHome, onNavigateAdmin }) {
  const { user, profile, refreshProfile, signOut, resetPassword } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Data states
  const [quizzes, setQuizzes] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Active quiz and review modal states
  const [quizForDifficulty, setQuizForDifficulty] = useState(null)
  const [activeQuizForRunner, setActiveQuizForRunner] = useState(null)
  const [activeAttemptForReview, setActiveAttemptForReview] = useState(null)

  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Fetch published quizzes and student attempts
  useEffect(() => {
    let ignore = false

    async function loadData() {
      if (!supabase || !user) return
      try {
        // 1. Fetch published quizzes with joined subjects
        const { data: quizzesData, error: quizzesError } = await supabase
          .from('quizzes')
          .select(`
            id,
            title,
            slug,
            description,
            difficulty,
            time_limit_minutes,
            total_questions,
            passing_score,
            is_daily_challenge,
            created_at,
            subjects (
              id,
              name,
              code,
              category,
              icon
            )
          `)
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        if (quizzesError) {
          console.warn('[BrainVash] Quizzes fetch notice:', quizzesError.message)
        } else if (!ignore) {
          setQuizzes(quizzesData || [])
        }

        // 2. Fetch student's own attempts
        const { data: attemptsData, error: attemptsError } = await supabase
          .from('quiz_attempts')
          .select(`
            id,
            quiz_id,
            user_id,
            status,
            score,
            total_marks,
            accuracy_percentage,
            time_taken_seconds,
            started_at,
            completed_at,
            quizzes (
              id,
              title,
              difficulty,
              time_limit_minutes,
              total_questions,
              passing_score,
              subjects (
                id,
                name,
                category
              )
            )
          `)
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })

        if (attemptsError) {
          console.warn('[BrainVash] Attempts fetch notice:', attemptsError.message)
        } else if (!ignore) {
          setAttempts(attemptsData || [])
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'An error occurred while loading dashboard records.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      ignore = true
    }
  }, [user, refreshTrigger])

  // Compute real statistics from actual attempts
  const stats = useMemo(() => {
    const totalAttempts = attempts.length
    const completed = attempts.filter((a) => a.status === 'completed')
    const completedAttempts = completed.length

    if (completedAttempts === 0) {
      return {
        totalAttempts,
        completedAttempts: 0,
        averageScore: 0,
        overallAccuracy: 0,
        accuracyGrade: 'No completed attempts yet',
        subjectBreakdown: [],
        strongestSubject: null,
        weakestSubject: null,
      }
    }

    // Average score percentage
    const totalPercent = completed.reduce((acc, curr) => {
      const marks = curr.total_marks || 0
      const score = curr.score || 0
      const pct = marks > 0 ? (score / marks) * 100 : 0
      return acc + pct
    }, 0)
    const averageScore = Math.round(totalPercent / completedAttempts)

    // Overall accuracy percentage
    const totalAcc = completed.reduce((acc, curr) => acc + Number(curr.accuracy_percentage || 0), 0)
    const overallAccuracy = Math.round((totalAcc / completedAttempts) * 100) / 100

    let accuracyGrade = 'Needs Practice'
    if (overallAccuracy >= 80) accuracyGrade = 'Excellent Mastery'
    else if (overallAccuracy >= 65) accuracyGrade = 'Strong Performance'
    else if (overallAccuracy >= 50) accuracyGrade = 'Satisfactory'

    // Subject breakdown
    const subjectMap = {}
    completed.forEach((att) => {
      const subName = att.quizzes?.subjects?.name || 'General'
      if (!subjectMap[subName]) {
        subjectMap[subName] = {
          name: subName,
          attempts: 0,
          totalScored: 0,
          totalAccuracy: 0,
        }
      }
      subjectMap[subName].attempts += 1
      subjectMap[subName].totalScored += att.score || 0
      subjectMap[subName].totalAccuracy += Number(att.accuracy_percentage || 0)
    })

    const subjectBreakdown = Object.values(subjectMap).map((s) => ({
      name: s.name,
      attempts: s.attempts,
      totalScored: s.totalScored,
      accuracy: Math.round((s.totalAccuracy / s.attempts) * 10) / 10,
    }))

    // Sort descending by accuracy
    subjectBreakdown.sort((a, b) => b.accuracy - a.accuracy)

    const strongestSubject = subjectBreakdown.length > 0 ? subjectBreakdown[0] : null
    const weakestSubject =
      subjectBreakdown.length > 1
        ? subjectBreakdown[subjectBreakdown.length - 1]
        : null

    return {
      totalAttempts,
      completedAttempts,
      averageScore,
      overallAccuracy,
      accuracyGrade,
      subjectBreakdown,
      strongestSubject,
      weakestSubject,
    }
  }, [attempts])

  const handleStartQuiz = (quiz) => {
    setQuizForDifficulty(quiz)
  }

  const handleConfirmDifficulty = (difficulty) => {
    const q = quizForDifficulty
    setQuizForDifficulty(null)
    setActiveQuizForRunner({ quiz: q, difficulty })
  }

  const handleViewResult = (attempt) => {
    setActiveAttemptForReview(attempt)
  }

  const handleQuizCompleted = async () => {
    setRefreshTrigger((prev) => prev + 1)
    await refreshProfile()
  }

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <DashboardSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        onNavigateHome={onNavigateHome}
        onNavigateAdmin={onNavigateAdmin}
        profile={profile}
        user={user}
        onLogout={signOut}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {/* Main Content Area */}
      <div className="dash-main-area">
        {/* Top Header */}
        <DashboardHeader
          activeTab={activeTab}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onNavigateHome={onNavigateHome}
          onNavigateAdmin={onNavigateAdmin}
          onOpenProfile={() => setShowProfileModal(true)}
          profile={profile}
          user={user}
        />

        {/* Tab Content */}
        <main className="dash-content-body">
          {error && (
            <div className="auth-message auth-error" style={{ marginBottom: 20 }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="dash-loading-container">
              <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
              <p>Loading your student dashboard records...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  profile={profile}
                  user={user}
                  quizzes={quizzes}
                  attempts={attempts}
                  stats={stats}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onOpenProfile={() => setShowProfileModal(true)}
                  onStartQuiz={handleStartQuiz}
                  onViewResult={handleViewResult}
                />
              )}

              {activeTab === 'quizzes' && (
                <QuizzesTab
                  quizzes={quizzes}
                  onStartQuiz={handleStartQuiz}
                />
              )}

              {activeTab === 'results' && (
                <ResultsTab
                  attempts={attempts}
                  onViewResult={handleViewResult}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsTab
                  stats={stats}
                  attempts={attempts}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'leaderboard' && (
                <LeaderboardTab
                  profile={profile}
                  user={user}
                />
              )}

              {activeTab === 'study-hub' && (
                <StudyHubTab
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  profile={profile}
                  user={user}
                  onOpenProfile={() => setShowProfileModal(true)}
                  onLogout={signOut}
                  onResetPassword={resetPassword}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Quiz Review Modal */}
      {activeAttemptForReview && (
        <QuizReviewModal
          attempt={activeAttemptForReview}
          onClose={() => setActiveAttemptForReview(null)}
        />
      )}

      {/* Difficulty Selection Modal */}
      {quizForDifficulty && (
        <DifficultySelectionModal
          quiz={quizForDifficulty}
          onClose={() => setQuizForDifficulty(null)}
          onConfirmDifficulty={handleConfirmDifficulty}
        />
      )}

      {/* Quiz Runner Modal */}
      {activeQuizForRunner && (
        <QuizRunnerModal
          quiz={activeQuizForRunner.quiz}
          selectedDifficulty={activeQuizForRunner.difficulty}
          onClose={() => setActiveQuizForRunner(null)}
          onQuizCompleted={handleQuizCompleted}
        />
      )}

      {/* Student Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  )
}
