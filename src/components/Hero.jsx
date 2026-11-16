export default function Hero({ scrollTo }) {
  return (
    <section className="hero" id="hero">
      <div className="hero-inner">
        <div className="hero-content">
          <div className="hero-badge">College Quiz Platform</div>
          <h1 className="hero-title">
            Learn, Quiz &amp;<br />Compete.
          </h1>
          <p className="hero-subtitle">
            Practice coding, test your college syllabus, sharpen your aptitude and compete with students from your college and beyond.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => scrollTo('categories')}>
              Explore Quizzes <span>→</span>
            </button>
            <button className="btn-secondary" onClick={() => scrollTo('how-it-works')}>
              <span className="play-icon" />
              How It Works
            </button>
          </div>
        </div>
        <div className="hero-illustration">
          <div className="hero-visual">
            {/* Floating icons */}
            <div className="hero-icon-float float-chart">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="#FEF0E8"/>
                <rect x="10" y="22" width="5" height="10" rx="2" fill="#e8634a"/>
                <rect x="17" y="16" width="5" height="16" rx="2" fill="#f5945e"/>
                <rect x="24" y="12" width="5" height="20" rx="2" fill="#e8634a"/>
              </svg>
            </div>
            <div className="hero-icon-float float-code-icon">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <rect width="44" height="44" rx="11" fill="#FEF0E8"/>
                <text x="22" y="28" textAnchor="middle" fill="#e8634a" fontSize="18" fontWeight="bold" fontFamily="monospace">&lt;/&gt;</text>
              </svg>
            </div>
            <div className="hero-icon-float float-trophy">
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                <rect width="38" height="38" rx="10" fill="#FEF0E8"/>
                <text x="19" y="25" textAnchor="middle" fontSize="18">🏆</text>
              </svg>
            </div>
            <div className="hero-icon-float float-check">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" rx="10" fill="#E8F5E9"/>
                <text x="18" y="24" textAnchor="middle" fontSize="18">✓</text>
              </svg>
            </div>

            {/* Laptop illustration */}
            <div className="hero-laptop">
              <div className="laptop-screen">
                <div className="laptop-header">
                  <div className="laptop-dot" />
                  <div className="laptop-dot" />
                  <div className="laptop-dot" />
                </div>
                <div className="laptop-question">Q1. What will be the output?</div>
                <div className="laptop-code">
                  <span className="code-keyword">def</span> <span className="code-function">solve</span>(arr):<br />
                  &nbsp;&nbsp;n = <span className="code-function">len</span>(arr)<br />
                  &nbsp;&nbsp;<span className="code-keyword">for</span> i <span className="code-keyword">in</span> <span className="code-function">range</span>(n):<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="code-keyword">if</span> arr[i] == i:<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-keyword">return</span> i<br />
                  &nbsp;&nbsp;<span className="code-keyword">return</span> -<span className="code-string">1</span>
                </div>
              </div>

              {/* Subject floating tags */}
              <div className="hero-floating float-dsa">DSA</div>
              <div className="hero-floating float-dbms">DBMS</div>
              <div className="hero-floating float-os">OS</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
