export class CliffHangersGame {
  constructor(winnerId, winnerUsername, products, maxSteps = 25) {
    this.winnerId = winnerId;
    this.winnerUsername = winnerUsername;
    this.products = products; // [{product, question (includes answer + stepSize)}]
    this.maxSteps = maxSteps;
    this.totalSteps = 0;
    this.currentIndex = 0;
    this.fell = false;
    this.continuedPlayers = new Set();
  }

  get totalQuestions() {
    return this.products.length;
  }

  // Payload sent to all clients — answer and stepSize intentionally excluded
  getCurrentClientQuestion() {
    if (this.currentIndex >= this.products.length) return null;
    const { product, question } = this.products[this.currentIndex];
    return {
      qIndex: this.currentIndex,
      product,
      question: {
        text: question.text,
        unit: question.unit,
        hint: question.hint,
        isPerServing: question.isPerServing,
      },
    };
  }

  submitGuess(guess) {
    if (this.currentIndex >= this.products.length || this.fell) return null;

    const { question } = this.products[this.currentIndex];
    const diff = Math.abs(guess - question.answer);
    const stepsAdded = Math.floor(diff / question.stepSize);
    this.totalSteps += stepsAdded;

    const fell = this.totalSteps >= this.maxSteps;
    this.fell = fell;
    const prevIndex = this.currentIndex;
    this.currentIndex++;

    const hasMore = !fell && this.currentIndex < this.products.length;

    return {
      qIndex: prevIndex,
      guess,
      answer: question.answer,
      unit: question.unit,
      stepsAdded,
      totalSteps: Math.min(this.totalSteps, this.maxSteps),
      maxSteps: this.maxSteps,
      fell,
      hasMore,
    };
  }

  isComplete() {
    return this.fell || this.currentIndex >= this.products.length;
  }

  playerContinue(playerId) {
    this.continuedPlayers.add(playerId);
  }

  allContinued(totalPlayers) {
    return this.continuedPlayers.size >= totalPlayers;
  }

  getCompletionData() {
    return {
      won: !this.fell,
      totalSteps: Math.min(this.totalSteps, this.maxSteps),
      maxSteps: this.maxSteps,
      winnerId: this.winnerId,
      winnerUsername: this.winnerUsername,
    };
  }
}
