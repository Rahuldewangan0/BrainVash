const features = [
  {
    icon: '</>',
    title: 'Coding Quizzes',
    desc: 'C, C++, Java, Python & more',
    className: 'coding',
  },
  {
    icon: '🏛',
    title: 'Syllabus Tests',
    desc: 'Subject-wise, semester-wise',
    className: 'syllabus',
  },
  {
    icon: '🎯',
    title: 'Aptitude & Reasoning',
    desc: 'Quant, Logic, Verbal & DI',
    className: 'aptitude',
  },
  {
    icon: '⏱',
    title: 'Live Leaderboard',
    desc: 'Compete and climb ranks',
    className: 'leaderboard',
  },
]

export default function FeatureHighlights() {
  return (
    <section className="features">
      <div className="features-grid">
        {features.map((f, i) => (
          <div className="feature-card" key={i}>
            <div className={`feature-icon ${f.className}`}>
              {f.className === 'coding' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L3 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 6L21 12L15 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span>{f.icon}</span>
              )}
            </div>
            <div className="feature-info">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
