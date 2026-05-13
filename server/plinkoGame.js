const ROWS = 8;
const SLOTS = 9;
const CHIPS = 3;

export const SLOT_VALUES = [100, 500, 1000, 2000, 5000, 2000, 1000, 500, 100];

export class PlinkoGame {
  constructor(winnerId, winnerUsername) {
    this.winnerId = winnerId;
    this.winnerUsername = winnerUsername;
    this.chipsRemaining = CHIPS;
    this.totalPoints = 0;
    this.droppedChips = [];
    this.continuedPlayers = new Set();
  }

  dropChip(startCol) {
    if (this.chipsRemaining <= 0) return null;
    if (startCol < 0 || startCol >= SLOTS) return null;

    const path = [startCol];
    let col = startCol;

    for (let i = 0; i < ROWS; i++) {
      let next = col + (Math.random() < 0.5 ? -1 : 1);
      // Bounce off walls
      if (next < 0) next = 1;
      if (next >= SLOTS) next = SLOTS - 2;
      col = next;
      path.push(col);
    }

    const points = SLOT_VALUES[col];
    this.totalPoints += points;
    this.chipsRemaining--;

    const chip = {
      startCol,
      path,
      landingSlot: col,
      points,
      chipsRemaining: this.chipsRemaining,
      totalPoints: this.totalPoints,
    };

    this.droppedChips.push(chip);
    return chip;
  }

  isComplete() {
    return this.chipsRemaining <= 0;
  }

  playerContinue(playerId) {
    this.continuedPlayers.add(playerId);
  }

  allContinued(totalPlayers) {
    return this.continuedPlayers.size >= totalPlayers;
  }

  getCompletionData() {
    return {
      winnerId: this.winnerId,
      winnerUsername: this.winnerUsername,
      totalPoints: this.totalPoints,
      slotValues: SLOT_VALUES,
    };
  }
}
