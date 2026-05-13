export default function RoundReveal({ data, localPlayerId, isHost, readyCount, onReady, onEndShow }) {
  const {
    round,
    answer,
    question,
    product,
    playerResults,
    winnerId,
    allWentOver,
    scores,
  } = data;

  function formatGuess(result) {
    if (result.guess === null) return '— no answer';
    if (result.isOver) {
      return `${result.guess} ${question.unit} (OVER by ${Math.abs(result.diff).toFixed(1)})`;
    }
    return `${result.guess} ${question.unit} (${result.diff.toFixed(1)} under)`;
  }

  function rowClass(result) {
    if (result.playerId === winnerId) return 'result-row result-winner';
    if (result.isOver) return 'result-row result-over';
    if (result.guess === null) return 'result-row result-no-answer';
    return 'result-row result-under';
  }

  function rowIcon(result) {
    if (result.playerId === winnerId) return '🏆';
    if (result.isOver) return '❌';
    if (result.guess === null) return '💨';
    return '✓';
  }

  return (
    <div className="reveal-screen">
      <div className="reveal-header">
        <div className="round-badge">Bidding Round {round} Results</div>
        <h2 className="product-name-sm">{product.name}</h2>
      </div>

      <div className="reveal-body">
        <div className="answer-reveal card">
          <p className="answer-label">The answer was</p>
          <div className="answer-value">
            {answer}
            <span className="answer-unit">{question.unit}</span>
          </div>
          {allWentOver && (
            <p className="all-over-note">Everyone went over! Closest guess wins.</p>
          )}
          {!winnerId && (
            <p className="all-over-note">No one submitted an answer this round.</p>
          )}
        </div>

        <div className="results-list card">
          <h3 className="section-label">Player Guesses</h3>
          {playerResults.map((result) => (
            <div key={result.playerId} className={rowClass(result)}>
              <span className="result-icon">{rowIcon(result)}</span>
              <span className="result-name">
                {result.username}
                {result.playerId === localPlayerId && ' (you)'}
              </span>
              <span className="result-guess">{formatGuess(result)}</span>
            </div>
          ))}
        </div>

        <div className="scoreboard card">
          <h3 className="section-label">Scoreboard</h3>
          {scores.map((s, i) => (
            <div
              key={s.id}
              className={`score-row ${s.id === localPlayerId ? 'score-row-you' : ''}`}
            >
              <span className="score-rank">#{i + 1}</span>
              <span className="score-name">
                {s.username}
                {s.id === localPlayerId && ' (you)'}
              </span>
              <span className="score-pts">{s.score} pts</span>
            </div>
          ))}
        </div>
      </div>

      <div className="reveal-footer">
        <p className="ready-count muted">
          {readyCount.ready}/{readyCount.total} players ready
        </p>
        <div className="reveal-footer-btns">
          <button className="btn btn-primary btn-lg" onClick={onReady}>
            Next Round →
          </button>
          {isHost && (
            <button className="btn btn-secondary btn-lg" onClick={onEndShow}>
              End the Show
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
