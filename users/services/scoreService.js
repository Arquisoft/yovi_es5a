class ScoreService {

  static calculate(matchSummary) {

    let score = 0;

    const {
      turnNumber,
      boardSize,
    } = matchSummary;
    console.log("Calculating score with turnNumber:", turnNumber, "boardSize:", boardSize);
    score += boardSize * 10;


    score += Math.max(0, 50 - turnNumber);

    return Math.round(score);
  }
}

module.exports =  ScoreService;