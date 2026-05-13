import { useState } from 'react';

export default function Landing({ onJoin }) {
  const [username, setUsername] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 1) return;
    onJoin(trimmed);
  }

  return (
    <div className="center-screen landing-bg">
      <div className="landing-card card">
        <div className="logo-area">
          <span className="logo-icon">🥦</span>
          <h1 className="logo-title">NutriRight</h1>
          <p className="logo-sub">The Nutrition Game Show</p>
        </div>

        <div className="game-rules">
          <p>Guess nutritional facts from real food products.</p>
          <p>
            <strong>Price is Right rules:</strong> closest guess without going over wins!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="join-form">
          <label htmlFor="username" className="field-label">
            Enter your player name
          </label>
          <input
            id="username"
            className="text-input"
            type="text"
            placeholder="Your name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={!username.trim()}
          >
            Join the Lobby →
          </button>
        </form>
      </div>
    </div>
  );
}
