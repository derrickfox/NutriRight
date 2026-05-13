import { useState, useEffect, useRef } from 'react';

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
      <div className="game-header">
        <div className="round-badge">Bidding Round {round}</div>
        {currentBidder && (
          <div className={`timer-display ${timerClass}`}>
            <span className="timer-value">{timeLeft}</span>
            <span className="timer-unit">sec</span>
          </div>
        )}
      </div>

      <div className="game-body">
        {/* Product */}
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

        {/* Question */}
        <div className="question-card card">
          <p className="question-label">THE QUESTION</p>
          <h3 className="question-text">{question.text}</h3>
        </div>

        {/* Live bid board */}
        <div className="bid-board card">
          <p className="question-label">BIDS</p>
          {biddingOrder.map(({ id, username }, idx) => {
            const bid = bidMap.get(id);
            const isCurrent = currentBidder?.id === id;
            const isMe = id === localPlayerId;

            let rowClass = 'bid-row';
            if (bid) rowClass += ' bid-row-done';
            else if (isCurrent) rowClass += ' bid-row-active';

            return (
              <div key={id} className={rowClass}>
                <span className="bid-order-num">#{idx + 1}</span>
                <span className="bid-player-name">
                  {username}{isMe ? ' (you)' : ''}
                </span>

                {bid ? (
                  // Bid already placed — show it
                  <span className="bid-value">
                    {bid.timedOut
                      ? <span className="bid-timed-out">⏱ no bid</span>
                      : <><strong>{bid.guess}</strong> {question.unit}</>}
                  </span>
                ) : isCurrent ? (
                  isMe && !hasSubmitted ? (
                    // It's my turn — show inline input
                    <form onSubmit={handleSubmit} className="bid-inline-form">
                      <input
                        ref={inputRef}
                        type="number"
                        className="text-input bid-input"
                        placeholder={question.hint}
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        min="0"
                        step="any"
                        disabled={timeLeft === 0}
                      />
                      <span className="unit-label">{question.unit}</span>
                      <button
                        type="submit"
                        className="btn btn-primary bid-submit-btn"
                        disabled={!guess || timeLeft === 0}
                      >
                        {timeLeft === 0 ? "Time's Up" : 'Bid!'}
                      </button>
                    </form>
                  ) : (
                    // Someone else's turn, or I already submitted (brief in-between state)
                    <span className="bid-status bidding">
                      {isMe && hasSubmitted ? '✓ locked in' : '🎙 bidding…'}
                    </span>
                  )
                ) : (
                  <span className="bid-status waiting">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
