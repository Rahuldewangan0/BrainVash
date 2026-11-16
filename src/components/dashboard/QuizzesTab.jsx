import { useState, useMemo } from 'react'

export default function QuizzesTab({
  quizzes,
  onStartQuiz,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')

  const categories = [
    { id: 'all', label: 'All Subjects' },
    { id: 'programming', label: 'Programming' },
    { id: 'core_cs', label: 'Core CS' },
    { id: 'college_syllabus', label: 'College Syllabus' },
    { id: 'aptitude', label: 'Aptitude' },
    { id: 'contests', label: 'Contests' },
  ]

  const difficulties = [
    { id: 'all', label: 'All Levels' },
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Hard' },
  ]

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      // Category filter
      if (selectedCategory !== 'all' && quiz.subjects?.category !== selectedCategory) {
        return false
      }
      // Difficulty filter
      if (selectedDifficulty !== 'all' && quiz.difficulty !== selectedDifficulty) {
        return false
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const titleMatch = quiz.title?.toLowerCase().includes(query)
        const descMatch = quiz.description?.toLowerCase().includes(query)
        const subjectMatch = quiz.subjects?.name?.toLowerCase().includes(query)
        if (!titleMatch && !descMatch && !subjectMatch) return false
      }
      return true
    })
  }, [quizzes, selectedCategory, selectedDifficulty, searchQuery])

  return (
    <div className="dash-tab-container">
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Explore Available Quizzes</h1>
          <p className="dash-page-desc">
            Browse published quizzes across core subjects, curriculum modules, and technical interview tracks.
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="dash-filter-toolbar">
        <div className="dash-search-box">
          <span className="dash-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search quizzes by title, subject or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dash-search-input"
          />
          {searchQuery && (
            <button
              className="dash-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="dash-filter-group">
          {/* Difficulty Select */}
          <select
            className="dash-select"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
          >
            {difficulties.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Pills */}
      <div className="dash-category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`dash-cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Quizzes Grid */}
      {filteredQuizzes.length > 0 ? (
        <div className="dash-quizzes-grid">
          {filteredQuizzes.map((quiz) => (
            <div className="dash-quiz-card" key={quiz.id}>
              <div className="dash-quiz-top">
                <span className="dash-quiz-subject">
                  {quiz.subjects?.name || 'General Subject'}
                </span>
                <span className={`dash-quiz-diff diff-${quiz.difficulty}`}>
                  {quiz.difficulty}
                </span>
              </div>

              <h3 className="dash-quiz-title">{quiz.title}</h3>
              <p className="dash-quiz-desc">
                {quiz.description || 'Test your proficiency and subject mastery with this quiz.'}
              </p>

              <div className="dash-quiz-meta">
                <span>⏱️ {quiz.time_limit_minutes} Mins</span>
                <span>❓ {quiz.total_questions} Questions</span>
                <span>🎯 Pass: {quiz.passing_score}%</span>
              </div>

              <button
                className="btn-attempt dash-btn-start"
                onClick={() => onStartQuiz(quiz)}
              >
                Start Quiz →
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">🔍</div>
          <h3>No quizzes match your filter criteria</h3>
          <p>Try resetting the search terms or selecting another subject category.</p>
          {(searchQuery || selectedCategory !== 'all' || selectedDifficulty !== 'all') && (
            <button
              className="btn-secondary"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
                setSelectedDifficulty('all')
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
