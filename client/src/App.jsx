import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
import GameScreen from './components/GameScreen';
import RoundReveal from './components/RoundReveal';
import GameOver from './components/GameOver';
import CliffHangers from './components/CliffHangers';

export default function App() {
  const [screen, setScreen] = useState('landing');
  const [localPlayer, setLocalPlayer] = useState(null);
  const [lobbyState, setLobbyState] = useState({ players: [], hostId: null });
  const [roundData, setRoundData] = useState(null);
  const [revealData, setRevealData] = useState(null);
  const [gameOverData, setGameOverData] = useState(null);
  const [readyCount, setReadyCount] = useState({ ready: 0, total: 0 });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  // Sequential bidding state
  const [biddingOrder, setBiddingOrder] = useState([]);  // [{id, username}]
  const [placedBids, setPlacedBids] = useState([]);      // [{playerId, username, guess, timedOut}]
  const [currentBidder, setCurrentBidder] = useState(null); // {id, username, timeLimit}
  const [isLoading, setIsLoading] = useState(false);
  const [gameInProgress, setGameInProgress] = useState(false);
  const [connected, setConnected] = useState(false);

  // Cliff Hangers state
  const [cliffStart, setCliffStart] = useState(null);
  const [cliffQuestion, setCliffQuestion] = useState(null);
  const [cliffResult, setCliffResult] = useState(null);
  const [cliffComplete, setCliffComplete] = useState(null);
  const [cliffHasContinued, setCliffHasContinued] = useState(false);
  // Cumulative step count — persists when result clears between questions
  const [cliffTotalSteps, setCliffTotalSteps] = useState(0);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      setScreen('landing');
      setLocalPlayer(null);
      setGameInProgress(false);
    });

    socket.on('joined', ({ playerId, isHost }) => {
      setLocalPlayer({ id: playerId, isHost });
      setScreen('lobby');
      setGameInProgress(false);
    });

    socket.on('game_in_progress', () => setGameInProgress(true));

    socket.on('lobby_update', (state) => {
      setLobbyState(state);
      setLocalPlayer((prev) =>
        prev ? { ...prev, isHost: state.hostId === prev.id } : prev
      );
    });

    socket.on('game_starting', () => setIsLoading(true));
    socket.on('round_loading', () => setIsLoading(true));

    socket.on('round_start', (data) => {
      setRoundData(data);
      setBiddingOrder(data.biddingOrder ?? []);
      setPlacedBids([]);
      setCurrentBidder(null);
      setHasSubmitted(false);
      setIsLoading(false);
      setScreen('game');
    });

    socket.on('bidder_turn', (data) => {
      setCurrentBidder({ id: data.bidderId, username: data.bidderUsername, timeLimit: data.timeLimit });
    });

    socket.on('bid_placed', (data) => {
      setPlacedBids((prev) => [...prev, data]);
    });

    socket.on('round_reveal', (data) => {
      setRevealData(data);
      setReadyCount({ ready: 0, total: data.scores.length });
      setScreen('reveal');
    });

    socket.on('ready_count', (data) => setReadyCount(data));

    socket.on('game_over', (data) => {
      setGameOverData(data);
      setScreen('gameover');
    });

    socket.on('game_reset', (lobbyData) => {
      setLobbyState(lobbyData);
      setRoundData(null);
      setRevealData(null);
      setGameOverData(null);
      resetCliff();
      setScreen('lobby');
    });

    // ── Cliff Hangers events ──────────────────────────────────────
    socket.on('cliff_loading', () => setIsLoading(true));

    socket.on('cliff_start', (data) => {
      resetCliff();
      setCliffStart(data);
      setIsLoading(false);
      setScreen('cliff');
    });

    socket.on('cliff_question', (data) => {
      setCliffQuestion(data);
      setCliffResult(null);
    });

    socket.on('cliff_result', (data) => {
      setCliffResult(data);
      setCliffTotalSteps(data.totalSteps);
    });

    socket.on('cliff_complete', (data) => {
      setCliffComplete(data);
    });

    // Winner disconnected mid-game — server skips to next round
    socket.on('cliff_skip', () => {
      resetCliff();
      setIsLoading(true);
    });

    return () => socket.disconnect();
  }, []);

  function resetCliff() {
    setCliffStart(null);
    setCliffQuestion(null);
    setCliffResult(null);
    setCliffComplete(null);
    setCliffHasContinued(false);
    setCliffTotalSteps(0);
  }

  const handleJoin = useCallback((username) => {
    socket.emit('join_lobby', { username });
  }, []);

  const handleStartGame = useCallback(() => {
    socket.emit('start_game');
  }, []);

  const handleSubmitAnswer = useCallback((guess) => {
    socket.emit('submit_answer', { guess });
    setHasSubmitted(true);
  }, []);

  const handleReadyNext = useCallback(() => {
    socket.emit('ready_next');
  }, []);

  const handlePlayAgain = useCallback(() => {
    socket.emit('play_again');
  }, []);

  const handleCliffSubmit = useCallback((guess) => {
    socket.emit('cliff_submit', { guess });
  }, []);

  const handleCliffContinue = useCallback(() => {
    socket.emit('cliff_continue');
    setCliffHasContinued(true);
  }, []);

  const handleEndShow = useCallback(() => {
    socket.emit('end_show');
  }, []);

  if (!connected && screen !== 'landing') {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p className="muted">Connecting to server...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="center-screen loading-screen">
        <div className="spinner" />
        <p className="muted">
          {screen === 'reveal' ? 'Loading mini-game...' : 'Loading next product...'}
        </p>
      </div>
    );
  }

  if (gameInProgress && screen === 'landing') {
    return (
      <div className="center-screen">
        <div className="card text-center">
          <h2 className="title-lg">Game In Progress</h2>
          <p className="muted">A game is already running. Please wait for the next one!</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {screen === 'landing' && <Landing onJoin={handleJoin} />}
      {screen === 'lobby' && (
        <Lobby
          players={lobbyState.players}
          hostId={lobbyState.hostId}
          localPlayerId={localPlayer?.id}
          isHost={localPlayer?.isHost}
          onStart={handleStartGame}
        />
      )}
      {screen === 'game' && roundData && (
        <GameScreen
          roundData={roundData}
          localPlayerId={localPlayer?.id}
          hasSubmitted={hasSubmitted}
          biddingOrder={biddingOrder}
          placedBids={placedBids}
          currentBidder={currentBidder}
          onSubmit={handleSubmitAnswer}
        />
      )}
      {screen === 'reveal' && revealData && (
        <RoundReveal
          data={revealData}
          localPlayerId={localPlayer?.id}
          isHost={localPlayer?.isHost}
          readyCount={readyCount}
          onReady={handleReadyNext}
          onEndShow={handleEndShow}
        />
      )}
      {screen === 'cliff' && cliffStart && (
        <CliffHangers
          startData={cliffStart}
          question={cliffQuestion}
          result={cliffResult}
          complete={cliffComplete}
          totalSteps={cliffTotalSteps}
          localPlayerId={localPlayer?.id}
          hasContinued={cliffHasContinued}
          onSubmit={handleCliffSubmit}
          onContinue={handleCliffContinue}
        />
      )}
      {screen === 'gameover' && gameOverData && (
        <GameOver
          data={gameOverData}
          localPlayerId={localPlayer?.id}
          isHost={localPlayer?.isHost}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </>
  );
}
