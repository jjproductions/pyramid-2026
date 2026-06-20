import React from 'react';

export default function GameBoard({ gameState, selectCategory, startNewRound, startWinnersCircle }) {
  return (
    <div className="board-view">
      <div className="score-header">
        <div className="team-score">Team 1: {gameState.teams[1].score}</div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>Team {gameState.currentTurn.team}'s Turn</h2>
          {(() => {
            const giver   = gameState.players?.[gameState.currentTurn?.giverId];
            const guesser = gameState.players?.[gameState.currentTurn?.guesserId];
            return (giver || guesser) ? (
              <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', color: 'var(--text-muted)' }}>
                🎤 {giver?.name || '?'} &nbsp;→&nbsp; 🤔 {guesser?.name || '?'}
              </p>
            ) : null;
          })()}
        </div>
        <div className="team-score">Team 2: {gameState.teams[2].score}</div>
      </div>
      
      <div className="pyramid-board">
        {gameState.board.map((cat, index) => (
          <div 
            key={index} 
            className={`category-card ${cat.completed ? 'completed' : 'clickable'}`}
            onClick={() => !cat.completed && selectCategory(index)}
            style={{ cursor: cat.completed ? 'default' : 'pointer' }}
          >
            {cat.completed ? '' : cat.name}
          </div>
        ))}
      </div>
      
      {gameState.board.every(cat => cat.completed) && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', color: '#00E5FF' }}>Round Complete!</h2>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={startNewRound}>Start Next Round</button>
            {(gameState.teams?.[1]?.score !== gameState.teams?.[2]?.score) && (
              <button className="btn btn-primary" onClick={startWinnersCircle}>Go to Winner's Circle</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
