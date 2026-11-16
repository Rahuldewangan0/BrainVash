const categories = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M9 18L3 12L9 6" stroke="#e8634a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 6L21 12L15 18" stroke="#e8634a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    name: 'Programming',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="#e8634a" strokeWidth="2"/>
        <path d="M3 9H21M9 9V21" stroke="#e8634a" strokeWidth="2"/>
      </svg>
    ),
    name: 'Core CS Subjects',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5V4.5C4 3.67 4.67 3 5.5 3H18.5C19.33 3 20 3.67 20 4.5V19.5C20 20.33 19.33 21 18.5 21H5.5C4.67 21 4 20.33 4 19.5Z" stroke="#e8634a" strokeWidth="2"/>
        <path d="M8 7H16M8 11H16M8 15H13" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    name: 'College Syllabus',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#e8634a" strokeWidth="2"/>
        <path d="M12 7V12L15 15" stroke="#e8634a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    name: 'Aptitude & Reasoning',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="#e8634a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    name: 'Live Contests',
  },
]

export default function QuizCategories() {
  return (
    <section className="categories" id="categories">
      <div className="container">
        <div className="section-header">
          <h2>Explore Quiz Categories</h2>
          <p>Choose a category and start practicing.</p>
        </div>
        <div className="categories-grid">
          {categories.map((cat, i) => (
            <div className="category-card" key={i}>
              <div className="category-icon">{cat.icon}</div>
              <h3>{cat.name}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
