export default function TrackSection() {
  return (
    <section className="track" id="track">
      <div className="container">
        <div className="track-inner">
          <div className="track-left">
            <h2>Track. Improve. Grow.</h2>
            <p>Get detailed performance insights, identify your weak topics and focus on what matters.</p>
            <button className="btn-progress" onClick={() => alert('Performance tracking coming soon!')}>
              View My Progress →
            </button>
          </div>
          <div className="track-features">
            <div className="track-feature">
              <div className="track-feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M3 20H21" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M5 20V14L9 10L13 14L19 4" stroke="#e8634a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Performance Analysis</h3>
              <p>Subject &amp; topic-wise</p>
            </div>
            <div className="track-feature">
              <div className="track-feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#e8634a" strokeWidth="2"/>
                  <path d="M12 8V12" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="16" r="1" fill="#e8634a"/>
                </svg>
              </div>
              <h3>Weakness Detection</h3>
              <p>Know what to improve</p>
            </div>
            <div className="track-feature">
              <div className="track-feature-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M4 18L8 14L12 17L20 6" stroke="#e8634a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 6H20V11" stroke="#e8634a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Points &amp; Rankings</h3>
              <p>Track your growth</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
