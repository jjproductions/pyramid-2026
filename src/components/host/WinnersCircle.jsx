import React from 'react';

export default function WinnersCircle({ 
  roomId, 
  gameState, 
  currentCircleTimer, 
  players, 
  updateRoomState, 
  confirmWinnersCirclePlayers, 
  startCircleClock, 
  markCircleCorrect, 
  markCirclePass, 
  revealCircleTile 
}) {
  if (gameState.status === 'winners_circle_selecting') {
    return (
      <div className="selecting-view" style={{ textAlign: 'center', width: '100%', maxWidth: '600px' }}>
        <h1 style={{ color: '#FFB800', marginBottom: '2rem' }}>Winner's Circle</h1>
        <h2>Team {gameState.currentTurn.team} Wins!</h2>
        <p style={{ marginBottom: '2rem' }}>Select who will play:</p>
        
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Giver (Back to TV)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {players.filter(p => p.team === gameState.currentTurn.team).map((p, i) => {
                const id = Object.keys(gameState.players).find(k => gameState.players[k] === p);
                return (
                  <button 
                    key={id}
                    className={`btn ${gameState.currentTurn.giverId === id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => updateRoomState(roomId, { 'currentTurn/giverId': id })}
                    style={{ padding: '0.5rem' }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Guesser</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {players.filter(p => p.team === gameState.currentTurn.team).map((p, i) => {
                const id = Object.keys(gameState.players).find(k => gameState.players[k] === p);
                return (
                  <button 
                    key={id}
                    className={`btn ${gameState.currentTurn.guesserId === id ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => updateRoomState(roomId, { 'currentTurn/guesserId': id })}
                    style={{ padding: '0.5rem', opacity: gameState.currentTurn.giverId === id ? 0.5 : 1 }}
                    disabled={gameState.currentTurn.giverId === id}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ fontSize: '2rem', padding: '1rem 3rem' }}
          disabled={!gameState.currentTurn.giverId || !gameState.currentTurn.guesserId}
          onClick={() => confirmWinnersCirclePlayers(gameState.currentTurn.giverId, gameState.currentTurn.guesserId)}
        >
          Start Winner's Circle!
        </button>
      </div>
    );
  }

  if (['winners_circle', 'winners_circle_summary'].includes(gameState.status)) {
    return (
      <div className="winners-circle-view" style={{ textAlign: 'center', width: '100%', minHeight: '60vh', position: 'relative' }}>
        <div className="timer" style={{ 
          position: 'absolute', 
          top: '0', 
          right: '2rem', 
          fontSize: '4rem',
          fontWeight: 'bold',
          color: currentCircleTimer <= 10 ? '#ff3366' : '#fff'
        }}>
          {currentCircleTimer}
        </div>

        <h1 style={{ color: '#FFB800', marginBottom: '2rem' }}>Winner's Circle</h1>
        
        <div className="circle-pyramid">
           <div className="pyramid-row top-row">
             <div 
               className={`circle-card ${gameState.circleBoard[5].completed ? 'completed' : ''} ${gameState.activeCircleIndex === 5 && gameState.circleRevealed && gameState.status === 'winners_circle' ? 'active' : ''} ${gameState.status === 'winners_circle_summary' && !gameState.circleBoard[5].completed ? 'clickable' : ''}`}
               onClick={() => revealCircleTile(5)}
               style={{ cursor: gameState.status === 'winners_circle_summary' && !gameState.circleBoard[5].completed ? 'pointer' : 'default' }}
             >
               {gameState.circleBoard[5].completed ? '' : ((gameState.circleRevealed && gameState.activeCircleIndex === 5 && gameState.status === 'winners_circle') || gameState.circleBoard[5].summaryRevealed ? gameState.circleBoard[5].phrase : '???')}
             </div>
           </div>
           <div className="pyramid-row middle-row">
             {[3, 4].map(idx => (
               <div 
                 key={gameState.circleBoard[idx]?.id || idx} 
                 className={`circle-card ${gameState.circleBoard[idx].completed ? 'completed' : ''} ${gameState.activeCircleIndex === idx && gameState.circleRevealed && gameState.status === 'winners_circle' ? 'active' : ''} ${gameState.status === 'winners_circle_summary' && !gameState.circleBoard[idx].completed ? 'clickable' : ''}`}
                 onClick={() => revealCircleTile(idx)}
                 style={{ cursor: gameState.status === 'winners_circle_summary' && !gameState.circleBoard[idx].completed ? 'pointer' : 'default' }}
               >
                 {gameState.circleBoard[idx].completed ? '' : ((gameState.circleRevealed && gameState.activeCircleIndex === idx && gameState.status === 'winners_circle') || gameState.circleBoard[idx].summaryRevealed ? gameState.circleBoard[idx].phrase : '???')}
               </div>
             ))}
           </div>
           <div className="pyramid-row bottom-row">
             {[0, 1, 2].map(idx => (
               <div 
                 key={gameState.circleBoard[idx]?.id || idx} 
                 className={`circle-card ${gameState.circleBoard[idx].completed ? 'completed' : ''} ${gameState.activeCircleIndex === idx && gameState.circleRevealed && gameState.status === 'winners_circle' ? 'active' : ''} ${gameState.status === 'winners_circle_summary' && !gameState.circleBoard[idx].completed ? 'clickable' : ''}`}
                 onClick={() => revealCircleTile(idx)}
                 style={{ cursor: gameState.status === 'winners_circle_summary' && !gameState.circleBoard[idx].completed ? 'pointer' : 'default' }}
               >
                 {gameState.circleBoard[idx].completed ? '' : ((gameState.circleRevealed && gameState.activeCircleIndex === idx && gameState.status === 'winners_circle') || gameState.circleBoard[idx].summaryRevealed ? gameState.circleBoard[idx].phrase : '???')}
               </div>
             ))}
           </div>
        </div>

        {gameState.status === 'winners_circle' && !gameState.circleRevealed && (
          <button className="btn btn-primary" onClick={startCircleClock} style={{ marginTop: '3rem', fontSize: '2rem', padding: '1rem 4rem' }}>START CLOCK</button>
        )}

        {gameState.status === 'winners_circle' && gameState.circleRevealed && (
          <div className="controls" style={{ marginTop: '4rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
            <button className="btn btn-success" onClick={markCircleCorrect} style={{ fontSize: '2rem', padding: '1rem 4rem' }}>CORRECT</button>
            <button className="btn btn-danger" onClick={markCirclePass} style={{ fontSize: '2rem', padding: '1rem 4rem' }}>PASS</button>
          </div>
        )}

        {gameState.status === 'winners_circle_summary' && (
          <div className="controls" style={{ marginTop: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <h2 style={{ color: '#ff3366', margin: 0 }}>Time's Up!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', margin: 0 }}>Tap any "???" tile to reveal the answer.</p>
            <button className="btn btn-primary" onClick={() => updateRoomState(roomId, { status: 'lobby' })} style={{ fontSize: '1.5rem', padding: '1rem 3rem' }}>Back to Lobby</button>
          </div>
        )}
      </div>
    );
  }

  if (gameState.status === 'winners_circle_win') {
    return (
      <div className="summary-view win">
        <h1 style={{ color: '#FFB800', fontSize: '5rem' }}>YOU WON!</h1>
        <h2>$25,000 Pyramid!</h2>
        <button className="btn btn-primary" onClick={() => updateRoomState(roomId, { status: 'lobby' })}>Back to Lobby</button>
      </div>
    );
  }

  return null;
}
