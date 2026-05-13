import { useState, useEffect, useRef } from 'react';

const PODIUM_COLORS = [
  'var(--pod-0)',
  'var(--pod-1)',
  'var(--pod-2)',
  'var(--pod-3)',
  'var(--pod-4)',
  'var(--pod-5)',
];

export default function GameScreen({
  roundData,
  localPlayerId,
  hasSubmitted,
  biddingOrder,
  placedBids,
  currentBidder,
  onSubmit,
}) {
  const { round, product, question } = roundData;
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const isMyTurn = currentBidder?.id === localPlayerId && !hasSubmitted;

  // Reset and run timer whenever the active bidder changes
  useEffect(() => {
    clearInterval(timerRef.current);
    if (currentBidder) {
      setTimeLeft(currentBidder.timeLimit);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [currentBidder?.id]);

  // Focus + clear input when it becomes my turn
  useEffect(() => {
    if (isMyTurn) {
      setGuess('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isMyTurn]);

  function handleSubmit(e) {
    e.preventDefault();
    const num = parseFloat(guess);
    if (isNaN(num) || num < 0) return;
    onSubmit(num);
    clearInterval(timerRef.current);
  }

  const pct = currentBidder && timeLeft !== null ? timeLeft / currentBidder.timeLimit : 1;
  const timerClass = pct > 0.5 ? 'timer-green' : pct > 0.25 ? 'timer-yellow' : 'timer-red';

  // Build a map for O(1) bid lookup by playerId
  const bidMap = new Map(placedBids.map((b) => [b.playerId, b]));

  const servingLabel = question.isPerServing
    ? product.servingSize ? `1 serving (${product.servingSize})` : '1 serving'
    : '100g';

  return (
    <div className="game-screen">

      {/* ── Stage header: marquee banner + timer ── */}
      <div className="show-stage-header">
        <div className="show-banner">
          <span className="show-round-title">Bidding Round {round}</span>
        </div>

        {currentBidder && timeLeft !== null && (
          <div className={`show-timer ${timerClass}`}>
            <span className="show-timer-value">{timeLeft}</span>
            <span className="show-timer-unit">sec</span>
          </div>
        )}
      </div>

      {/* ── Product + question ── */}
      <div className="show-product-stage">
        <div className="product-card card">
          <div className="product-image-wrap">
            <img
              src={product.image}
              alt={product.name}
              className="product-image"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div className="product-info">
            <h2 className="product-name">{product.name}</h2>
            {product.brand && <p className="product-brand">by {product.brand}</p>}
            <p className="serving-size-label">
              Serving size: <strong>{servingLabel}</strong>
            </p>
          </div>
        </div>

        <div className="question-card card">
          <p className="question-label">THE QUESTION</p>
          <h3 className="question-text">{question.text}</h3>
        </div>
      </div>

      {/* ── Contestant podiums ── */}
      <div className="podiums-row">
        {biddingOrder.map(({ id, username }, idx) => {
          const bid = bidMap.get(id);
          const isCurrent = currentBidder?.id === id;
          const isMe = id === localPlayerId;

          let podiumClass = 'podium';
          if (bid) podiumClass += ' podium-done';
          else if (isCurrent) podiumClass += ' podium-active';

          return (
            <div
              key={id}
              className={podiumClass}
              style={{ '--podium-color': PODIUM_COLORS[idx % PODIUM_COLORS.length] }}
            >
              {/* Name band */}
              <div className="podium-name-band">
                <span className="podium-name-text">
                  {username}{isMe ? ' ★' : ''}
                </span>
              </div>

              {/* Display area */}
              <div className="podium-display">
                {bid ? (
                  // Bid placed — show value
                  bid.timedOut ? (
                    <span className="podium-bid-value timed-out">⏱ no bid</span>
                  ) : (
                    <>
                      <span className="podium-bid-value">{bid.guess}</span>
                      <span className="podium-unit">{question.unit}</span>
                    </>
                  )
                ) : isCurrent ? (
                  isMe && !hasSubmitted ? (
                    // My turn — show input form
                    <form onSubmit={handleSubmit} className="podium-form">
                      <input
                        ref={inputRef}
                        type="number"
                        className="podium-input"
                        placeholder={question.hint}
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        min="0"
                        step="any"
                        disabled={timeLeft === 0}
                      />
                      <span className="podium-unit-hint">{question.unit}</span>
                      <button
                        type="submit"
                        className="podium-bid-btn"
                        disabled={!guess || timeLeft === 0}
                      >
                        {timeLeft === 0 ? "⏱" : 'Bid!'}
                      </button>
                    </form>
                  ) : (
                    <span className="podium-bidding-text">
                      {isMe && hasSubmitted ? '✓ locked' : '🎙 bidding…'}
                    </span>
                  )
                ) : (
                  <span className="podium-waiting-dash">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
