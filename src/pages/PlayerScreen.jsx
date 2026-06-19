import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeToRoom, updateRoomState } from '../firebase';

export default function PlayerScreen() {
  const { roomId } = useParams();
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState('');

  useEffect(() => {
    if (roomId && joined) {
      const unsubscribe = subscribeToRoom(roomId, (state) => {
        if (state) setGameState(state);
      });
      return () => unsubscribe();
    }
  }, [roomId, joined]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const uuid = 'user_' + Math.random().toString(36).substr(2, 9);
    setPlayerId(uuid);
    
    const currentState = JSON.parse(localStorage.getItem(`room_${roomId}`) || '{}');
    const playerCount = Object.keys(currentState.players || {}).length;
    const team = (playerCount % 2) + 1;
    const role = 'giver';
    
    await updateRoomState(roomId, { [`players/${uuid}`]: { name, interest, team, role } });
    setJoined(true);
  };

  if (!roomId) return <div className="loading">No Room ID</div>;
  if (!joined) {
    return (
      <div className="player-join-screen fade-in">
        <h2>Room: {roomId}</h2>
        <form onSubmit={handleJoin} className="join-form">
          <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className="input-code" required />
          <input type="text" placeholder="Hobby / Inside Joke" value={interest} onChange={(e) => setInterest(e.target.value)} className="input-code" style={{ marginTop: '1rem' }} />
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Join</button>
        </form>
      </div>
    );
  }
  if (!gameState) return <div className="loading">Connecting...</div>;

  const myPlayer = gameState.players?.[playerId];
  const isMyTurn = gameState.currentTurn?.team === myPlayer?.team;
  const isGiver = myPlayer?.role === 'giver';

  const selectCategory = (index) => {
    const numWords = gameState.board[index].words.length;
    updateRoomState(roomId, { 
      activeCategoryIndex: index,
      categoryRevealed: false,
      activeWordIndex: 0,
      wordStates: new Array(numWords).fill(false),
      timerActive: false,
      timer: 30,
      wordsScored: 0
    });
  };

  const startCategory = () => {
    updateRoomState(roomId, {
      categoryRevealed: true,
      timerActive: true
    });
  };

  const markCorrect = () => {
    const nextScore = gameState.teams[myPlayer.team].score + 1;
    const nextWordScored = gameState.wordsScored + 1;
    const numWords = gameState.board[gameState.activeCategoryIndex].words.length;
    
    let updates = {
      [`teams/${myPlayer.team}/score`]: nextScore,
      wordsScored: nextWordScored,
      [`wordStates/${gameState.activeWordIndex}`]: true
    };

    if (nextWordScored >= numWords) {
      // Finished category early
      updates.timerActive = false;
      updates.status = 'round_summary';
      updates[`board/${gameState.activeCategoryIndex}/completed`] = true;
    } else {
      let nextIdx = (gameState.activeWordIndex + 1) % numWords;
      const currentStates = { ...gameState.wordStates, [gameState.activeWordIndex]: true };
      while(currentStates[nextIdx] === true) {
         nextIdx = (nextIdx + 1) % numWords;
      }
      updates.activeWordIndex = nextIdx;
    }
    
    updateRoomState(roomId, updates);
  };

  const markPass = () => {
    const numWords = gameState.board[gameState.activeCategoryIndex].words.length;
    let nextIdx = (gameState.activeWordIndex + 1) % numWords;
    while(gameState.wordStates && gameState.wordStates[nextIdx] === true) {
       nextIdx = (nextIdx + 1) % numWords;
    }
    updateRoomState(roomId, { 
      activeWordIndex: nextIdx
    });
  };

  const markCircleCorrect = () => {
    const nextBoard = [...gameState.circleBoard];
    nextBoard[gameState.activeCircleIndex].completed = true;

    const allCompleted = nextBoard.every(b => b.completed);

    if (allCompleted) {
      updateRoomState(roomId, {
        circleBoard: nextBoard,
        circleTimerActive: false,
        status: 'winners_circle_win'
      });
    } else {
      let nextIdx = (gameState.activeCircleIndex + 1) % 6;
      while(nextBoard[nextIdx].completed) {
         nextIdx = (nextIdx + 1) % 6;
      }
      updateRoomState(roomId, {
        circleBoard: nextBoard,
        activeCircleIndex: nextIdx
      });
    }
  };

  const markCirclePass = () => {
    const nextBoard = [...gameState.circleBoard];
    let nextIdx = (gameState.activeCircleIndex + 1) % 6;
    while(nextBoard[nextIdx].completed) {
       nextIdx = (nextIdx + 1) % 6;
    }
    updateRoomState(roomId, { 
      activeCircleIndex: nextIdx
    });
  };

  return (
    <div className="player-screen fade-in">
      <div className="header">
        <span className="player-name">{myPlayer?.name} (Team {myPlayer?.team})</span>
      </div>

      {gameState.status === 'lobby' && (
        <div className="waiting-view">
          <h2>Waiting to start...</h2>
        </div>
      )}

      {gameState.status === 'generating' && (
        <div className="waiting-view">
          <h2>Building Pyramid...</h2>
          <p>The AI is analyzing your interests and generating custom categories!</p>
        </div>
      )}

      {gameState.status === 'round1' && !isMyTurn && (
        <div className="waiting-view">
          <h2>Team {gameState.currentTurn.team}'s Turn</h2>
          <p>Watch the TV!</p>
        </div>
      )}

      {gameState.status === 'round1' && isMyTurn && isGiver && gameState.activeCategoryIndex === null && (
        <div className="category-selection">
          <h2>Select a Category</h2>
          <div className="category-list">
            {gameState.board.map((cat, idx) => (
              !cat.completed && (
                <button key={idx} className="btn btn-secondary" onClick={() => selectCategory(idx)}>
                  {cat.name}
                </button>
              )
            ))}
          </div>
        </div>
      )}

      {gameState.status === 'round1' && isMyTurn && isGiver && gameState.activeCategoryIndex !== null && (
        <div className="word-view">
          {!gameState.categoryRevealed ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: '#a0a0a0' }}>{gameState.board[gameState.activeCategoryIndex].name}</h2>
              <h3 style={{ marginTop: '1rem', marginBottom: '2rem' }}>{gameState.board[gameState.activeCategoryIndex].description}</h3>
              <button className="btn btn-primary" onClick={startCategory}>GO!</button>
            </div>
          ) : (
            <>
              <h1 className="active-word">
                {gameState.board[gameState.activeCategoryIndex].words[gameState.activeWordIndex]}
              </h1>
              <div className="action-buttons">
                <button className="btn btn-success action-btn" onClick={markCorrect}>CORRECT</button>
                <button className="btn btn-danger action-btn" onClick={markPass}>PASS</button>
              </div>
            </>
          )}
        </div>
      )}

      {gameState.status === 'round_summary' && (
        <div className="waiting-view">
          <h2>Time's Up!</h2>
          <p>Look at the TV for scores.</p>
        </div>
      )}

      {gameState.status === 'winners_circle' && !isMyTurn && (
        <div className="waiting-view">
          <h2>Team {gameState.currentTurn.team} is in the Winner's Circle!</h2>
          <p>Watch the TV!</p>
        </div>
      )}

      {gameState.status === 'winners_circle' && isMyTurn && isGiver && (
        <div className="winners-circle-view" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#FFB800', marginBottom: '1rem' }}>Winner's Circle</h2>
          {!gameState.circleRevealed ? (
            <div style={{ marginTop: '2rem' }}>
              <h3>Ready to start the clock?</h3>
              <button className="btn btn-primary" onClick={() => updateRoomState(roomId, { circleRevealed: true, circleTimerActive: true })}>GO!</button>
            </div>
          ) : (
            <div className="word-view">
              <h2 style={{ fontSize: '3rem', color: '#fff', marginBottom: '2rem' }}>
                 {gameState.circleBoard[gameState.activeCircleIndex].phrase}
              </h2>
              <div className="action-buttons">
                <button className="btn btn-success action-btn" onClick={markCircleCorrect}>CORRECT</button>
                <button className="btn btn-danger action-btn" onClick={markCirclePass}>PASS</button>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState.status === 'winners_circle_summary' && (
        <div className="waiting-view">
          <h2>Time's Up!</h2>
          <p>Look at the TV.</p>
        </div>
      )}

      {gameState.status === 'winners_circle_win' && (
        <div className="waiting-view win">
          <h1 style={{ color: '#FFB800', fontSize: '3rem' }}>YOU WON!</h1>
          <p>$25,000 Pyramid!</p>
        </div>
      )}
    </div>
  );
}
