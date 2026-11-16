export default function StudyHubTab({ onNavigateTab }) {
  const tracks = [
    {
      title: 'Data Structures & Algorithms',
      category: 'Programming Track',
      topics: 'Arrays, Linked Lists, Trees, Graphs, Dynamic Programming',
      status: 'Coming Soon',
      icon: '💻',
    },
    {
      title: 'DBMS & SQL Mastery',
      category: 'Core CS Track',
      topics: 'Relational Model, Normalization, Indexing, Transactions & ACID',
      status: 'Coming Soon',
      icon: '🗄️',
    },
    {
      title: 'Operating Systems & Concurrency',
      category: 'Core CS Track',
      topics: 'Process Scheduling, Memory Management, Deadlocks, Paging',
      status: 'Coming Soon',
      icon: '⚙️',
    },
    {
      title: 'College Semester Syllabus Notes',
      category: 'University Curriculum',
      topics: 'Structured subject-wise question banks aligned to university exams',
      status: 'In Development',
      icon: '📖',
    },
  ]

  return (
    <div className="dash-tab-container">
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Study Hub & Curriculum Tracks</h1>
          <p className="dash-page-desc">
            Curated subject notes, cheat sheets, and targeted practice roadmaps for engineering students.
          </p>
        </div>
      </div>

      <div className="dash-study-notice-card">
        <div className="dash-study-notice-icon">📚</div>
        <div className="dash-study-notice-text">
          <h3>Curated Syllabus Tracks Under Preparation</h3>
          <p>
            We are collaborating with top college professors and subject matter experts to bring you high-yield exam notes and interview study materials. In the meantime, test your skills using the live quiz catalog.
          </p>
          <button
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => onNavigateTab('quizzes')}
          >
            Practice Available Quizzes →
          </button>
        </div>
      </div>

      <div className="dash-quizzes-grid" style={{ marginTop: 24 }}>
        {tracks.map((track) => (
          <div className="dash-quiz-card" key={track.title}>
            <div className="dash-quiz-top">
              <span className="dash-quiz-subject">{track.category}</span>
              <span className="dash-quiz-diff diff-medium">{track.status}</span>
            </div>
            <h3 className="dash-quiz-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{track.icon}</span> {track.title}
            </h3>
            <p className="dash-quiz-desc">{track.topics}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
