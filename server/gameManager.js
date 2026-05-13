export class GameManager {
  constructor() {
    this.players = new Map();
    this.hostId = null;
    this.status = 'lobby';
    this.currentRound = 0;
    this.timeLimit = 30; // seconds per bidder
    this.currentProduct = null;
    this.currentQuestion = null;
    this.answers = new Map();
    this.roundTimer = null;
    this.lastWinnerId = null;
    this.lastWinnerUsername = null;
    this.biddingOrder = [];      // player IDs in bid order (index 0 bids first)
    this.currentBidderIndex = 0;
  }

  addPlayer(id, username) {
    const joinOrder = this.players.size; // 0 = first to join
    const player = { id, username, score: 0, ready: false, joinOrder };
    this.players.set(id, player);
    if (!this.hostId) this.hostId = id;
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.hostId === id) {
      this.hostId = this.players.keys().next().value ?? null;
    }
  }

  getLobbyState() {
    return {
      players: Array.from(this.players.values()),
      hostId: this.hostId,
      status: this.status,
    };
  }

  getPlayersState() {
    return Array.from(this.players.values()).map(({ id, username, score }) => ({
      id,
      username,
      score,
    }));
  }

  startRound(product, question) {
    this.currentRound++;
    this.currentProduct = product;
    this.currentQuestion = question;
    this.answers = new Map();
    this.status = 'playing';
    for (const p of this.players.values()) p.ready = false;

    // Bidding order: reverse join order so the last player in bids first
    this.biddingOrder = [...this.players.values()]
      .sort((a, b) => b.joinOrder - a.joinOrder)
      .map((p) => p.id);
    this.currentBidderIndex = 0;
  }

  // Returns the ID of the player whose turn it is, or null if all done
  getCurrentBidderId() {
    return this.biddingOrder[this.currentBidderIndex] ?? null;
  }

  // [{id, username}, ...] in bid order — safe to send to clients
  getBiddingOrderState() {
    return this.biddingOrder.map((id) => {
      const p = this.players.get(id);
      return { id, username: p?.username ?? '?' };
    });
  }

  // Advance past any bidders who have disconnected
  skipDisconnected() {
    while (
      this.currentBidderIndex < this.biddingOrder.length &&
      !this.players.has(this.biddingOrder[this.currentBidderIndex])
    ) {
      this.currentBidderIndex++;
    }
  }

  // Accept a bid from the current active bidder only
  submitAnswer(playerId, guess) {
    if (this.status !== 'playing') return false;
    if (playerId !== this.getCurrentBidderId()) return false;
    if (this.answers.has(playerId)) return false;
    this.answers.set(playerId, { guess });
    this.currentBidderIndex++;
    return true;
  }

  // Force-advance the current bidder (timeout or disconnect)
  skipCurrentBidder() {
    this.currentBidderIndex++;
  }

  allAnswersIn() {
    if (this.biddingOrder.length === 0) return false;
    return this.currentBidderIndex >= this.biddingOrder.length;
  }

  calculateRoundResults() {
    const answer = this.currentQuestion.answer;
    const results = [];

    for (const [id, player] of this.players) {
      const submission = this.answers.get(id);
      const guess = submission?.guess ?? null;
      results.push({
        playerId: id,
        username: player.username,
        guess,
        isOver: guess !== null && guess > answer,
        diff: guess !== null ? answer - guess : null,
        absDiff: guess !== null ? Math.abs(answer - guess) : Infinity,
      });
    }

    const validGuesses = results.filter((r) => r.guess !== null);
    const underGuesses = validGuesses.filter((r) => !r.isOver);
    const allWentOver = underGuesses.length === 0 && validGuesses.length > 0;

    let winnerId = null;
    if (underGuesses.length > 0) {
      const winner = underGuesses.reduce((best, r) => (r.diff < best.diff ? r : best));
      winnerId = winner.playerId;
    } else if (validGuesses.length > 0) {
      const winner = validGuesses.reduce((best, r) =>
        r.absDiff < best.absDiff ? r : best
      );
      winnerId = winner.playerId;
    }

    if (winnerId) {
      const p = this.players.get(winnerId);
      if (p) {
        p.score++;
        this.lastWinnerId = winnerId;
        this.lastWinnerUsername = p.username;
      }
    } else {
      this.lastWinnerId = null;
      this.lastWinnerUsername = null;
    }

    this.status = 'revealing';

    return {
      round: this.currentRound,
      answer,
      question: this.currentQuestion,
      product: this.currentProduct,
      playerResults: results,
      winnerId,
      allWentOver,
      scores: [...this.players.values()]
        .map((p) => ({ id: p.id, username: p.username, score: p.score }))
        .sort((a, b) => b.score - a.score),
    };
  }

  playerReady(id) {
    const p = this.players.get(id);
    if (p) p.ready = true;
  }

  allReady() {
    if (this.players.size === 0) return false;
    return [...this.players.values()].every((p) => p.ready);
  }

  shouldRunMiniGame() {
    return this.lastWinnerId !== null;
  }

  getFinalResults() {
    return {
      scores: [...this.players.values()]
        .map((p) => ({ id: p.id, username: p.username, score: p.score }))
        .sort((a, b) => b.score - a.score),
      roundsPlayed: this.currentRound,
    };
  }

  softReset() {
    for (const p of this.players.values()) {
      p.score = 0;
      p.ready = false;
    }
    this.status = 'lobby';
    this.currentRound = 0;
    this.currentProduct = null;
    this.currentQuestion = null;
    this.answers = new Map();
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = null;
    this.lastWinnerId = null;
    this.lastWinnerUsername = null;
    this.biddingOrder = [];
    this.currentBidderIndex = 0;
  }
}
