class ScoreService {

  static calculate(matchSummary) {

    let score = 0;

    const {
      turnNumber,
      boardSize,
    } = matchSummary;

    score += boardSize * 10;


    score += Math.max(0, 50 - turnNumber);

    return Math.round(score);
  }
}

module.exports =  ScoreService;