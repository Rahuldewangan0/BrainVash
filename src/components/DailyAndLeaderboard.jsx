const leaderboardData = [
  { rank: 1, name: 'Aman Verma', college: 'LNCT&S, Bhopal', points: '3,250', color: '#e8634a', initials: 'AV' },
  { rank: 2, name: 'Priya Sharma', college: 'NIT Trichy', points: '3,120', color: '#f5945e', initials: 'PS' },
  { rank: 3, name: 'Rohit Patel', college: 'MANIT, Bhopal', points: '3,080', color: '#f9b88a', initials: 'RP' },
]

export default function DailyAndLeaderboard() {
  return (
    <section className="daily-leaderboard" id="leaderboard">
      <div className="container">
        <div className="daily-leaderboard-grid">
          {/* Daily Challenge */}
          <div>
            <h2 className="section-title">Daily Challenge</h2>
            <p className="section-subtitle">A new quiz every day to keep your skills sharp.</p>
            <div className="challenge-card">
              <div className="challenge-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="#e8634a" strokeWidth="2"/>
                  <path d="M16 2V6M8 2V6M3 10H21" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M8 14H10M14 14H16M8 18H10" stroke="#e8634a" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="challenge-info">
                <p className="challenge-label">Today's Challenge</p>
                <h3 className="challenge-name">DSA – Arrays & Strings</h3>
                <div className="challenge-meta">
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#9a8a90" strokeWidth="2"/><path d="M12 7V12L15 15" stroke="#9a8a90" strokeWidth="2" strokeLinecap="round"/></svg>
                    15 Questions
                  </span>
                  <span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#9a8a90" strokeWidth="2"/><path d="M12 7V12L15 10" stroke="#9a8a90" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    15 Minutes
                  </span>
                </div>
              </div>
              <button className="btn-attempt" onClick={() => alert('Starting quiz... (This feature will be available soon!)')}>
                Attempt Now →
              </button>
            </div>
          </div>

          {/* Live Leaderboard */}
          <div>
            <div className="leaderboard-header">
              <div>
                <h2 className="section-title">Live Leaderboard</h2>
                <p className="section-subtitle">Top performers this week.</p>
              </div>
              <button className="view-full" onClick={() => alert('Full leaderboard coming soon!')}>View Full →</button>
            </div>
            <div className="leaderboard-list">
              {leaderboardData.map((entry) => (
                <div className="leaderboard-item" key={entry.rank}>
                  <div className={`rank-badge rank-${entry.rank}`}>{entry.rank}</div>
                  <div className="leaderboard-avatar" style={{ background: entry.color }}>
                    {entry.initials}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{entry.name}</div>
                    <div className="leaderboard-college">{entry.college}</div>
                  </div>
                  <div className="leaderboard-points">
                    {entry.points} <small>pts</small>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#9a8a90', marginTop: 12, textAlign: 'center', fontStyle: 'italic' }}>
              * Sample data for illustration purposes
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
