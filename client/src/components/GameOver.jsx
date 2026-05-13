const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameOver({ data, localPlayerId, isHost, onPlayAgain }) {
  const { scores, roundsPlayed } = data;
  const winner = scores[0];
  const isWinner = winner?.id === localPlayerId;

  return (
    <div className="center-screen gameover-screen">
      <div className="gameover-card card">
        <div className="gameover-header">
          {isWinner ? (
            <>
              <div className="trophy-icon">🏆</div>
              <h2 className="title-lg gold">You Won!</h2>
            </>
          ) : (
            <>
              <div className="trophy-icon">🎉</div>
              <h2 className="title-lg">Game Over!</h2>
              {winner && (
                <p className="winner-announce">
                  <strong>{winner.username}</strong> takes the crown!
                </p>
              )}
            </>
          )}
          <p className="muted">After {roundsPlayed} bidding round{roundsPlayed === 1 ? '' : 's'}</p>
        </div>

        <div className="final-scoreboard">
          <h3 className="section-label">Final Standings</h3>
          {scores.map((s, i) => (
            <div
              key={s.id}
              className={`final-score-row ${s.id === localPlayerId ? 'score-row-you' : ''} ${i === 0 ? 'score-row-first' : ''}`}
            >
              <span className="final-medal">{MEDALS[i] || `#${i + 1}`}</span>
              <span className="score-name">
                {s.username}
                {s.id === localPlayerId && ' (you)'}
              </span>
              <span className="score-pts">
                {s.score} pts
              </span>
            </div>
          ))}
        </div>

        <div className="gameover-footer">
          {isHost ? (
            <button className="btn btn-primary btn-lg" onClick={onPlayAgain}>
              Play Again →
            </button>
          ) : (
            <p className="muted">Waiting for the host to start a new game...</p>
          )}
        </div>
      </div>
    </div>
  );
}
