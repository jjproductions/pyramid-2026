import React from 'react';

export default function ActiveCategory({ gameState, currentTimer, startCategory, markCorrect, markPass }) {
  return (
    <div className="active-category-view" style={{ position: 'relative', width: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      
      <div className="timer" style={{ 
        position: 'absolute', 
        top: '0', 
        right: '2rem', 
        fontSize: '4rem',
        fontWeight: 'bold',
        color: currentTimer <= 10 ? '#ff3366' : '#fff'
      }}>
        0:{currentTimer < 10 ? `0${currentTimer}` : currentTimer}
      </div>

      <h2 style={{ fontSize: '3rem', color: '#a0a0a0', marginBottom: '1rem' }}>
        {gameState.board[gameState.activeCategoryIndex].name}
      </h2>
      
      {!gameState.categoryRevealed ? (
        <div style={{ marginTop: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          <h3 style={{ fontSize: '2.5rem', color: '#fff', margin: 0, lineHeight: 1.4 }}>
            {gameState.board[gameState.activeCategoryIndex].description}
          </h3>
          <button className="btn btn-primary" onClick={startCategory} style={{ fontSize: '2rem', padding: '1rem 4rem' }}>
            GO!
          </button>
        </div>
      ) : (
        <>
          <h2 className="active-word" style={{ marginTop: '2rem', color: '#FFB800', fontSize: '5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
            {gameState.board[gameState.activeCategoryIndex].words[gameState.activeWordIndex]}
          </h2>
          
          <div className="controls" style={{ marginTop: '4rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
            <button className="btn btn-success" onClick={markCorrect} style={{ fontSize: '2rem', padding: '1rem 4rem', backgroundColor: '#2E7D32', color: 'white', fontWeight: 'bold' }}>CORRECT</button>
            <button className="btn btn-danger" onClick={markPass} style={{ fontSize: '2rem', padding: '1rem 4rem', backgroundColor: '#C62828', color: 'white', fontWeight: 'bold' }}>PASS</button>
          </div>
        </>
      )}
    </div>
  );
}
