import React from 'react';

export default function RoundSummary({ gameState, nextTurn }) {
  return (
    <div className="summary-view">
      <h1>Time's Up!</h1>
      <h2>Team {gameState.currentTurn.team} scored {gameState.wordsScored} points!</h2>
      <button className="btn btn-primary" onClick={nextTurn}>Next Turn</button>
    </div>
  );
}
