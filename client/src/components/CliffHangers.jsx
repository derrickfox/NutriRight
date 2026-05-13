import { useState, useEffect, useRef } from 'react';

// ── Mountain ──────────────────────────────────────────────────────────────────
// Triangle points: top (150,30), bottom-left (10,385), bottom-right (290,385)
// Climber travels up the RIGHT edge: (290,385) → (150,30)
const MTN_TOP    = { x: 150, y: 30  };
const MTN_BR     = { x: 290, y: 385 };
const EDGE_DX    = MTN_TOP.x - MTN_BR.x; // -140
const EDGE_DY    = MTN_TOP.y - MTN_BR.y; // -355
const MAX_STEPS  = 25;
// Danger zone starts at step 20 (80% up)
const DANGER_STEP = 20;

function climberPos(steps) {
  const pct = Math.min(steps / MAX_STEPS, 1);
  return {
    x: MTN_BR.x + pct * EDGE_DX,
    y: MTN_BR.y + pct * EDGE_DY,
  };
}

function Mountain({ totalSteps, fell }) {
  const pos = climberPos(totalSteps);
  const inDanger = totalSteps >= DANGER_STEP;

  // Pre-compute step tick positions along the right edge
  const ticks = Array.from({ length: MAX_STEPS + 1 }, (_, i) => {
    const p = i / MAX_STEPS;
    return {
      x: MTN_BR.x + p * EDGE_DX,
      y: MTN_BR.y + p * EDGE_DY,
      isDanger: i >= DANGER_STEP,
      isMajor: i % 5 === 0,
      label: i,
    };
  });

  return (
    <div className="mountain-wrap">
      <svg viewBox="0 0 340 420" className="mountain-svg" overflow="visible">
        <defs>
          {/* Two-tone mountain: red danger zone on top, green body below */}
          <linearGradient id="mtnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6b0000" />
            <stop offset="17%"  stopColor="#9b3400" />
            <stop offset="18%"  stopColor="#2d5a27" />
            <stop offset="100%" stopColor="#1a3812" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Mountain body */}
        <polygon
          points="150,30 10,385 290,385"
          fill="url(#mtnGrad)"
          stroke="#5a8c42"
          strokeWidth="1.5"
        />

        {/* Snow cap */}
        <polygon points="150,30 133,72 167,72" fill="white" opacity="0.9" />

        {/* Danger zone hatching overlay */}
        <polygon
          points="133,72 150,30 167,72"
          fill="rgba(255,60,0,0.18)"
        />

        {/* Step tick marks along the right edge */}
        {ticks.map(({ x, y, isDanger, isMajor, label }) => (
          <g key={label}>
            <line
              x1={x} y1={y}
              x2={x + (isMajor ? 14 : 7)} y2={y}
              stroke={isDanger ? '#ff6666' : 'rgba(255,255,255,0.35)'}
              strokeWidth={isMajor ? 2 : 1}
            />
            {isMajor && (
              <text
                x={x + 17}
                y={y + 4}
                fill={isDanger ? '#ff8888' : 'rgba(255,255,255,0.45)'}
                fontSize="9"
                textAnchor="start"
              >
                {label}
              </text>
            )}
          </g>
        ))}

        {/* CLIFF! label at peak */}
        <text
          x="150" y="18"
          fill="#ff3355"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
          letterSpacing="1.5"
        >
          ⚡ CLIFF! ⚡
        </text>

        {/* DANGER ZONE label */}
        <text x="322" y="88"  fill="#ff6666" fontSize="7.5" textAnchor="middle" opacity="0.85">DANGER</text>
        <text x="322" y="99"  fill="#ff6666" fontSize="7.5" textAnchor="middle" opacity="0.85">ZONE</text>

        {/* Climber — uses CSS transform for smooth animation */}
        {!fell && (
          <text
            x="0" y="0"
            fontSize="22"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              transition: 'transform 1.3s cubic-bezier(0.34, 1.1, 0.64, 1)',
              filter: inDanger ? 'url(#glow) drop-shadow(0 0 6px #ff2200)' : 'none',
              fontSize: '22px',
            }}
          >
            🧗
          </text>
        )}

        {/* Falling climber animation */}
        {fell && (
          <text
            x="0" y="0"
            fontSize="26"
            textAnchor="middle"
            dominantBaseline="middle"
            className="climber-falling"
            style={{ transform: `translate(${pos.x + 30}px, ${pos.y}px)` }}
          >
            😱
          </text>
        )}
      </svg>
    </div>
  );
}

// ── CliffHangers ──────────────────────────────────────────────────────────────
export default function CliffHangers({
  startData,
  question,
  result,
  complete,
  totalSteps,      // cumulative from App.jsx — persists between questions
  localPlayerId,
  hasContinued,
  onSubmit,
  onContinue,
}) {
  const isPlayer = localPlayerId === startData.winnerId;
  const [guess, setGuess] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const inputRef = useRef(null);

  // Reset input when a new question arrives
  useEffect(() => {
    if (question) {
      setGuess('');
      setHasSubmitted(false);
    }
  }, [question?.qIndex]);

  useEffect(() => {
    if (!hasSubmitted && isPlayer && question && !result && inputRef.current) {
      inputRef.current.focus();
    }
  }, [question, result, hasSubmitted]);

  const maxSteps = startData.maxSteps;
  const fell = result?.fell ?? false;
  const inDanger = totalSteps >= DANGER_STEP;

  function handleSubmit(e) {
    e.preventDefault();
    const num = parseFloat(guess);
    if (isNaN(num) || num < 0) return;
    onSubmit(num);
    setHasSubmitted(true);
  }

  // Progress dots: filled for completed questions
  const completedCount = result ? result.qIndex + 1 : 0;

  return (
    <div className="cliff-screen">
      {/* Header */}
      <div className="cliff-header">
        <div className="cliff-title-row">
          <h2 className="cliff-title">CLIFF HANGERS</h2>
          <span className="yodel-badge">🎵 yodel-ay-ee-oooh 🎵</span>
        </div>
        <p className="cliff-subtitle">
          {isPlayer
            ? "You won Round 1 — climb without falling off!"
            : `${startData.winnerUsername} is climbing the mountain!`}
        </p>
      </div>

      <div className="cliff-body">
        {/* ── Left: Mountain ── */}
        <div className="cliff-mountain-side">
          <Mountain totalSteps={totalSteps} fell={fell} />

          <div className={`cliff-steps-counter ${inDanger ? 'steps-danger' : ''}`}>
            <span className="steps-label">STEPS</span>
            <span className="steps-value">{totalSteps}<span className="steps-max">/{maxSteps}</span></span>
          </div>

          <div className="cliff-q-dots">
            {Array.from({ length: startData.totalQuestions }, (_, i) => (
              <div
                key={i}
                className={`q-dot ${i < completedCount ? 'q-dot-done' : 'q-dot-pending'}`}
              />
            ))}
          </div>
          <p className="muted cliff-q-label">
            Question {Math.min(completedCount + (complete ? 0 : 1), startData.totalQuestions)} / {startData.totalQuestions}
          </p>
        </div>

        {/* ── Right: Game area ── */}
        <div className="cliff-game-side">

          {/* Intro — waiting for first question */}
          {!complete && !question && (
            <div className="cliff-intro card">
              <div className="trophy-icon">🏔️</div>
              <h3 className="title-lg">
                {isPlayer ? 'Get Ready!' : `Watch ${startData.winnerUsername}!`}
              </h3>
              <p className="muted">
                {isPlayer
                  ? 'Guess 3 nutritional facts. Stay within 25 steps or fall!'
                  : 'Every wrong unit moves the climber up. Fall at 25 steps!'}
              </p>
              <div className="waiting-dots" style={{ marginTop: '1rem' }}>
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Active question */}
          {!complete && question && (
            <div className="cliff-question-card card">
              <div className="cliff-product-row">
                <div className="cliff-product-img-wrap">
                  <img
                    src={question.product.image}
                    alt={question.product.name}
                    className="cliff-product-img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div className="cliff-product-info">
                  <h3 className="cliff-product-name">{question.product.name}</h3>
                  {question.product.brand && (
                    <p className="product-brand">by {question.product.brand}</p>
                  )}
                  {question.product.servingSize && (
                    <p className="serving-size-label">
                      Serving: <strong>{question.product.servingSize}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="cliff-question-text">
                <p className="question-label">
                  QUESTION {question.qIndex + 1} / {startData.totalQuestions}
                </p>
                <h4 className="question-text">{question.question.text}</h4>
              </div>

              {/* Result reveal (shown after guess is submitted) */}
              {result && result.qIndex === question.qIndex && (
                <div className={`cliff-result-banner ${result.fell ? 'result-fell' : result.stepsAdded === 0 ? 'result-exact' : result.stepsAdded <= 5 ? 'result-good' : 'result-bad'}`}>
                  <div className="cliff-result-row">
                    <span>Your guess: <strong>{result.guess} {result.unit}</strong></span>
                    <span>Answer: <strong className="gold">{result.answer} {result.unit}</strong></span>
                  </div>
                  <div className="cliff-steps-added">
                    {result.stepsAdded === 0
                      ? '🎯 Exact! No steps added!'
                      : `+${result.stepsAdded} step${result.stepsAdded === 1 ? '' : 's'}`}
                  </div>
                  {result.fell && <div className="cliff-fell-msg">😱 OFF THE CLIFF!</div>}
                  {result.hasMore && !result.fell && (
                    <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      Next question loading...
                    </p>
                  )}
                </div>
              )}

              {/* Input — only for the winner, only before submitting */}
              {!result && isPlayer && !hasSubmitted && (
                <form onSubmit={handleSubmit} className="answer-form">
                  <div className="input-row">
                    <input
                      ref={inputRef}
                      type="number"
                      className="text-input answer-input"
                      placeholder={question.question.hint}
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      min="0"
                      step="any"
                    />
                    <span className="unit-label">{question.question.unit}</span>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={!guess}
                  >
                    Submit Guess
                  </button>
                </form>
              )}

              {/* Waiting for result after submit */}
              {!result && isPlayer && hasSubmitted && (
                <div className="submitted-state">
                  <div className="spinner" />
                  <p className="muted">Revealing answer...</p>
                </div>
              )}

              {/* Spectator view */}
              {!result && !isPlayer && (
                <div className="spectator-watching">
                  👀 Waiting for <strong>{startData.winnerUsername}</strong> to guess...
                </div>
              )}
            </div>
          )}

          {/* Complete screen */}
          {complete && (
            <div className="cliff-complete-card card">
              {complete.won ? (
                <>
                  <div className="trophy-icon">🎉</div>
                  <h3 className="title-lg gold">MADE IT!</h3>
                  <p>
                    <strong>{complete.winnerUsername}</strong> stayed on the mountain!
                  </p>
                  <p className="muted">
                    Finished with {complete.maxSteps - complete.totalSteps} step{complete.maxSteps - complete.totalSteps === 1 ? '' : 's'} to spare.
                  </p>
                </>
              ) : (
                <>
                  <div className="trophy-icon" style={{ filter: 'grayscale(0.5)' }}>😱</div>
                  <h3 className="title-lg" style={{ color: 'var(--red)' }}>OFF THE CLIFF!</h3>
                  <p>
                    <strong>{complete.winnerUsername}</strong> didn't make it this time.
                  </p>
                  <p className="muted">The mountain wins this round.</p>
                </>
              )}

              {!hasContinued ? (
                <button className="btn btn-primary btn-lg" onClick={onContinue}>
                  Back to the Show →
                </button>
              ) : (
                <div className="waiting-msg" style={{ marginTop: '1rem' }}>
                  <div className="waiting-dots"><span /><span /><span /></div>
                  <p className="muted">Waiting for all players to continue...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
