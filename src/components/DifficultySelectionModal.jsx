import { useState } from 'react'

export default function DifficultySelectionModal({
  quiz,
  onClose,
  onConfirmDifficulty,
}) {
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium')

  const tiers = [
    {
      id: 'easy',
      name: 'Easy',
      badge: 'Beginner / Warmup',
      icon: '🌱',
      tagColor: '#2e7d32',
      bgColor: '#e8f5e9',
      borderColor: '#a5d6a7',
      description: 'Foundational concepts, direct definitions, and quick syntax recall. Perfect for building speed and foundational confidence.',
      features: [
        'Fundamental formulas & definitions',
        'Standard conceptual questions',
        'Standard evaluation criteria'
      ]
    },
    {
      id: 'medium',
      name: 'Medium',
      badge: 'Standard / Recommended',
      icon: '⚡',
      tagColor: '#e8634a',
      bgColor: '#fdf5f0',
      borderColor: '#f6d2b8',
      description: 'Standard engineering syllabus level. Tests analytical problem-solving, code tracing, and core subject application.',
      features: [
        'Core engineering concepts',
        'Balanced code output & trace questions',
        'Standard semester exam rigor'
      ]
    },
    {
      id: 'hard',
      name: 'Hard',
      badge: 'Advanced / Competitive',
      icon: '🔥',
      tagColor: '#c2185b',
      bgColor: '#fce4ec',
      borderColor: '#f48fb1',
      description: 'Complex multi-step problems, subtle edge cases, and high-stakes algorithmic questions for top percentile performers.',
      features: [
        'Multi-concept integration',
        'Edge cases & tricky logic tracing',
        'Competitive placement test level'
      ]
    }
  ]

  const handleStart = () => {
    onConfirmDifficulty(selectedDifficulty)
  }

  const negativeMarks = Number(quiz?.negative_marks || 0)

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="auth-modal-card diff-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        <button
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close difficulty selector"
        >
          ×
        </button>

        {/* Header */}
        <div className="diff-modal-header">
          <div className="diff-header-badge">
            <span>🎯</span> Select Your Target Tier
          </div>
          <h2 className="diff-modal-title">{quiz?.title || 'Engineering Quiz'}</h2>
          <p className="diff-modal-subtitle">
            Choose your difficulty level for this session. Your questions and grading will strictly match this level.
          </p>

          <div className="diff-quiz-meta-strip">
            <span className="diff-meta-tag">
              📚 {quiz?.subjects?.name || 'General Subject'}
            </span>
            <span className="diff-meta-tag">
              ⏱️ {quiz?.time_limit_minutes || 15} Mins
            </span>
            <span className="diff-meta-tag">
              ❓ {quiz?.total_questions || 10} Questions
            </span>
            {negativeMarks > 0 ? (
              <span className="diff-meta-tag diff-meta-negative" title="Negative marks deducted for incorrect answers">
                ⚠️ -{negativeMarks} Negative Marks
              </span>
            ) : (
              <span className="diff-meta-tag" title="No penalty for wrong answers">
                🛡️ Zero Negative Marking
              </span>
            )}
          </div>
        </div>

        {/* Tier Cards */}
        <div className="diff-tier-grid">
          {tiers.map((tier) => {
            const isSelected = selectedDifficulty === tier.id
            return (
              <div
                key={tier.id}
                className={`diff-tier-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedDifficulty(tier.id)}
                style={{
                  borderColor: isSelected ? tier.tagColor : 'transparent',
                }}
              >
                <div className="diff-tier-header">
                  <div className="diff-tier-icon-wrap" style={{ background: tier.bgColor }}>
                    <span className="diff-tier-icon">{tier.icon}</span>
                  </div>
                  <div className="diff-tier-names">
                    <span className="diff-tier-title">{tier.name}</span>
                    <span
                      className="diff-tier-badge"
                      style={{ color: tier.tagColor, background: tier.bgColor }}
                    >
                      {tier.badge}
                    </span>
                  </div>
                  <div className="diff-radio-indicator">
                    <span className={`diff-custom-radio ${isSelected ? 'checked' : ''}`} />
                  </div>
                </div>

                <p className="diff-tier-desc">{tier.description}</p>

                <ul className="diff-tier-features">
                  {tier.features.map((feat, idx) => (
                    <li key={idx}>✓ {feat}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className="diff-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary diff-btn-confirm"
            onClick={handleStart}
          >
            Launch {tiers.find((t) => t.id === selectedDifficulty)?.name} Quiz →
          </button>
        </div>
      </div>
    </div>
  )
}
