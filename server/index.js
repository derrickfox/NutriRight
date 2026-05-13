import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fetchRandomProduct } from './foodApi.js';
import { GameManager } from './gameManager.js';
import { CliffHangersGame } from './cliffHangers.js';
import { PlinkoGame, SLOT_VALUES } from './plinkoGame.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5176',
    methods: ['GET', 'POST'],
  },
});

const game = new GameManager();
let cliffGame = null;
let plinkoGame = null;

// ── Product pre-fetch queue ────────────────────────────────────
// Keeps products ready so round starts are instant instead of
// making players wait for the Open Food Facts API.
const productQueue = [];
const QUEUE_TARGET = 5; // keep 5 products warm at all times
let queueRefilling = false;

async function refillQueue() {
  if (queueRefilling) return;
  queueRefilling = true;
  while (productQueue.length < QUEUE_TARGET) {
    try {
      const item = await fetchRandomProduct();
      productQueue.push(item);
      console.log(`[queue] +1 product (${productQueue.length}/${QUEUE_TARGET})`);
    } catch (err) {
      console.warn('[queue] pre-fetch failed:', err.message);
      // Brief pause before retrying so we don't hammer the API
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  queueRefilling = false;
}

// Pull from the queue if available, fire-and-forget refill, fall back to direct fetch
async function getNextProduct() {
  if (productQueue.length > 0) {
    const item = productQueue.shift();
    refillQueue(); // replenish in background — intentionally not awaited
    return item;
  }
  console.warn('[queue] empty — fetching directly');
  return fetchRandomProduct();
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Lobby ──────────────────────────────────────────────────────
  socket.on('join_lobby', ({ username }) => {
    if (game.status !== 'lobby') {
      socket.emit('game_in_progress');
      return;
    }
    const trimmed = String(username || '').trim().slice(0, 20);
    if (!trimmed) return;

    game.addPlayer(socket.id, trimmed);
    socket.emit('joined', {
      playerId: socket.id,
      isHost: game.hostId === socket.id,
    });
    io.emit('lobby_update', game.getLobbyState());
  });

  socket.on('start_game', async () => {
    if (socket.id !== game.hostId) return;
    if (game.status !== 'lobby') return;
    if (game.players.size < 1) return;

    game.status = 'loading';
    io.emit('game_starting');
    await startNewRound();
  });

  // ── Main game ──────────────────────────────────────────────────
  socket.on('submit_answer', ({ guess }) => {
    if (game.status !== 'playing') return;
    // Only the current bidder may submit
    if (socket.id !== game.getCurrentBidderId()) return;

    const num = parseFloat(guess);
    if (isNaN(num) || num < 0) return;

    const bidderPlayer = game.players.get(socket.id);
    const accepted = game.submitAnswer(socket.id, num);
    if (!accepted) return;

    clearTimeout(game.roundTimer);

    // Broadcast the bid to everyone in real-time
    io.emit('bid_placed', {
      playerId: socket.id,
      username: bidderPlayer?.username ?? '?',
      guess: num,
      timedOut: false,
    });

    startNextBidderTurn();
  });

  socket.on('ready_next', () => {
    if (game.status !== 'revealing') return;
    game.playerReady(socket.id);
    io.emit('ready_count', {
      ready: [...game.players.values()].filter((p) => p.ready).length,
      total: game.players.size,
    });

    if (game.allReady()) {
      game.status = 'loading'; // lock against double-trigger
      if (game.shouldRunMiniGame()) {
        startMiniGame();
      } else {
        startNewRound();
      }
    }
  });

  // ── Cliff Hangers ──────────────────────────────────────────────
  socket.on('cliff_submit', ({ guess }) => {
    if (!cliffGame || socket.id !== cliffGame.winnerId) return;
    const num = parseFloat(guess);
    if (isNaN(num) || num < 0) return;

    const result = cliffGame.submitGuess(num);
    if (!result) return;

    io.emit('cliff_result', result);

    if (cliffGame.isComplete()) {
      setTimeout(() => {
        io.emit('cliff_complete', cliffGame.getCompletionData());
      }, 2200);
    } else {
      setTimeout(() => {
        io.emit('cliff_question', cliffGame.getCurrentClientQuestion());
      }, 3000);
    }
  });

  socket.on('cliff_continue', () => {
    if (!cliffGame) return;
    cliffGame.playerContinue(socket.id);

    if (cliffGame.allContinued(game.players.size)) {
      cliffGame = null;
      startNewRound();
    }
  });

  // ── Plinko ─────────────────────────────────────────────────────
  socket.on('plinko_drop', ({ startCol }) => {
    if (!plinkoGame || socket.id !== plinkoGame.winnerId) return;
    const col = parseInt(startCol, 10);
    if (isNaN(col) || col < 0 || col >= 9) return;

    const chip = plinkoGame.dropChip(col);
    if (!chip) return;

    io.emit('plinko_chip', chip);

    if (plinkoGame.isComplete()) {
      // Wait for animation to finish before sending complete
      const completionData = plinkoGame.getCompletionData();
      setTimeout(() => {
        io.emit('plinko_complete', completionData);
      }, 3500);
    }
  });

  socket.on('plinko_continue', () => {
    if (!plinkoGame) return;
    plinkoGame.playerContinue(socket.id);

    if (plinkoGame.allContinued(game.players.size)) {
      plinkoGame = null;
      startNewRound();
    }
  });

  // ── Meta ───────────────────────────────────────────────────────
  socket.on('end_show', () => {
    if (socket.id !== game.hostId) return;
    if (game.status !== 'revealing') return;
    io.emit('game_over', game.getFinalResults());
    game.softReset();
  });

  socket.on('play_again', () => {
    if (socket.id !== game.hostId) return;
    cliffGame = null;
    plinkoGame = null;
    game.softReset();
    io.emit('game_reset', game.getLobbyState());
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const wasPlaying = game.status === 'playing';
    const wasCurrentBidder = game.getCurrentBidderId() === socket.id;

    game.removePlayer(socket.id);

    if (game.players.size === 0 && game.status !== 'lobby') {
      clearTimeout(game.roundTimer);
      cliffGame = null;
      plinkoGame = null;
      game.softReset();
    }

    io.emit('lobby_update', game.getLobbyState());

    // If the disconnecting player was the active bidder, advance to the next
    if (wasPlaying && wasCurrentBidder && game.players.size > 0) {
      clearTimeout(game.roundTimer);
      startNextBidderTurn();
    }

    if (game.status === 'revealing' && game.players.size > 0 && game.allReady()) {
      game.status = 'loading';
      if (game.shouldRunMiniGame()) {
        startMiniGame();
      } else {
        startNewRound();
      }
    }

    // If winner disconnected mid-cliff, skip to next round
    if (cliffGame && socket.id === cliffGame.winnerId) {
      cliffGame = null;
      io.emit('cliff_skip');
      startNewRound();
    }

    // If winner disconnected mid-plinko, skip to next round
    if (plinkoGame && socket.id === plinkoGame.winnerId) {
      plinkoGame = null;
      io.emit('plinko_skip');
      startNewRound();
    }
  });
});

// ── Game functions ─────────────────────────────────────────────

async function startNewRound() {
  io.emit('round_loading');
  try {
    const { product, question } = await getNextProduct();
    game.startRound(product, question);

    io.emit('round_start', {
      round: game.currentRound,
      product,
      question: {
        text: question.text,
        unit: question.unit,
        hint: question.hint,
        isPerServing: question.isPerServing,
      },
      timeLimit: game.timeLimit,
      biddingOrder: game.getBiddingOrderState(), // [{id, username}, ...] reverse join order
      players: game.getPlayersState(),
    });

    // Kick off the first bidder's turn
    startNextBidderTurn();
  } catch (err) {
    console.error('Failed to load product:', err.message);
    setTimeout(startNewRound, 3000);
  }
}

// Advance past disconnected players, then either reveal or start next bidder's timer
function startNextBidderTurn() {
  game.skipDisconnected();

  if (game.allAnswersIn()) {
    revealRound();
    return;
  }

  const bidderId = game.getCurrentBidderId();
  const bidderPlayer = game.players.get(bidderId);

  io.emit('bidder_turn', {
    bidderId,
    bidderUsername: bidderPlayer?.username ?? '?',
    timeLimit: game.timeLimit,
  });

  // Per-bidder countdown — on expiry, skip them and move on
  game.roundTimer = setTimeout(() => {
    if (game.status !== 'playing' || game.getCurrentBidderId() !== bidderId) return;

    game.skipCurrentBidder();
    io.emit('bid_placed', {
      playerId: bidderId,
      username: bidderPlayer?.username ?? '?',
      guess: null,
      timedOut: true,
    });
    startNextBidderTurn();
  }, game.timeLimit * 1000);
}

function revealRound() {
  clearTimeout(game.roundTimer);
  const results = game.calculateRoundResults();
  io.emit('round_reveal', results);
}

// ── Mini-game dispatcher — picks randomly between Cliff Hangers and Plinko ──
function startMiniGame() {
  if (Math.random() < 0.5) {
    startCliffHangers();
  } else {
    startPlinko();
  }
}

async function startCliffHangers() {
  io.emit('cliff_loading');
  try {
    const products = [];
    for (let i = 0; i < 3; i++) products.push(await getNextProduct());
    cliffGame = new CliffHangersGame(
      game.lastWinnerId,
      game.lastWinnerUsername,
      products
    );

    io.emit('cliff_start', {
      winnerId: game.lastWinnerId,
      winnerUsername: game.lastWinnerUsername,
      totalQuestions: cliffGame.totalQuestions,
      maxSteps: cliffGame.maxSteps,
    });

    setTimeout(() => {
      if (cliffGame) io.emit('cliff_question', cliffGame.getCurrentClientQuestion());
    }, 2500);
  } catch (err) {
    console.error('Failed to load Cliff Hangers:', err.message);
    cliffGame = null;
    startNewRound();
  }
}

function startPlinko() {
  plinkoGame = new PlinkoGame(game.lastWinnerId, game.lastWinnerUsername);
  console.log(`[plinko] starting for ${game.lastWinnerUsername}`);
  io.emit('plinko_start', {
    winnerId: game.lastWinnerId,
    winnerUsername: game.lastWinnerUsername,
    totalChips: 3,
    chipsRemaining: 3,
    slotValues: SLOT_VALUES,
  });
}

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`NutriRight server → http://localhost:${PORT}`);
  // Start warming the product queue immediately so the first round is instant
  refillQueue();
});
