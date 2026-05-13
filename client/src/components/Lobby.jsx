export default function Lobby({ players, hostId, localPlayerId, isHost, onStart }) {
  return (
    <div className="center-screen">
      <div className="lobby-card card">
        <div className="lobby-header">
          <span className="logo-icon-sm">🥦</span>
          <h2 className="title-lg">Waiting Lobby</h2>
          <p className="muted">Share this URL so others can join!</p>
        </div>

        <div className="player-list">
          <h3 className="section-label">Players ({players.length})</h3>
          {players.length === 0 && (
            <p className="muted text-center">No players yet...</p>
          )}
          {players.map((p) => (
            <div key={p.id} className="player-row">
              <span className="player-avatar">
                {p.username.charAt(0).toUpperCase()}
              </span>
              <span className="player-name">
                {p.username}
                {p.id === localPlayerId && (
                  <span className="badge badge-you">You</span>
                )}
              </span>
              {p.id === hostId && (
                <span className="badge badge-host">Host</span>
              )}
            </div>
          ))}
        </div>

        <div className="lobby-footer">
          {isHost ? (
            <>
              <p className="muted lobby-hint">
                {players.length < 2
                  ? 'Invite at least one more player for full fun, or start solo!'
                  : `${players.length} players ready — let's go!`}
              </p>
              <button
                className="btn btn-primary btn-lg"
                onClick={onStart}
                disabled={players.length < 1}
              >
                Start Game ({players.length}{' '}
                {players.length === 1 ? 'player' : 'players'})
              </button>
            </>
          ) : (
            <div className="waiting-msg">
              <div className="waiting-dots">
                <span /><span /><span />
              </div>
              <p className="muted">Waiting for the host to start the game...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
