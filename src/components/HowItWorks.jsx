const steps = [
  {
    number: 1,
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="#e8634a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="7" r="4" stroke="#e8634a" strokeWidth="2"/>
      </svg>
    ),
    title: 'Create Account',
    desc: 'Sign up and set your college & branch.',
  },
  {
    number: 2,
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <polygon points="5,3 19,12 5,21" stroke="#e8634a" strokeWidth="2" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Take Quizzes',
    desc: 'Attempt from coding, syllabus and aptitude sets.',
  },
  {
    number: 3,
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M3 20H21" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M5 20V10" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M9 20V14" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M13 20V8" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
        <path d="M17 20V4" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Analyze & Compete',
    desc: 'Get results, track performance and climb the leaderboard.',
  },
]

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="container">
        <div className="section-header">
          <h2>How BrainVash Works?</h2>
          <p>Get started in 3 simple steps.</p>
        </div>
        <div className="steps-grid">
          {steps.map((step, i) => (
            <div className="step-card" key={step.number}>
              <div className="step-number">{step.number}</div>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              {i < steps.length - 1 && <span className="step-arrow">→</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
