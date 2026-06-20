import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeToRoom, updateRoomState } from '../firebase';
import { playDing, playBuzz, playSwoosh, playClick, playWin } from '../utils/sounds';

const SESSION_KEY = (roomId) => `pyramid_session_${roomId}`;

export default function PlayerScreen() {
  const { roomId } = useParams();
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningStep, setJoiningStep] = useState('info'); // 'info' or 'team'
  const [now, setNow] = useState(Date.now());
  const sessionRestored = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    const unsubscribe = subscribeToRoom(roomId, (state) => {
      setGameState(state);
      setLoading(false);

      // Try to restore session from localStorage on first load
      if (!sessionRestored.current && state) {
        sessionRestored.current = true;
        const saved = localStorage.getItem(SESSION_KEY(roomId));
        if (saved) {
          try {
            const { playerId: savedId, name: savedName, interest: savedInterest } = JSON.parse(saved);
            // Only restore if the player still exists in the room
            if (state.players && state.players[savedId]) {
              setPlayerId(savedId);
              setName(savedName);
              setInterest(savedInterest || '');
              setJoined(true);
            } else {
              // Player was removed (e.g. room reset) — clear stale session
              localStorage.removeItem(SESSION_KEY(roomId));
            }
          } catch {
            localStorage.removeItem(SESSION_KEY(roomId));
          }
        }
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    let interval;
    if (gameState?.timerActive || gameState?.circleTimerActive) {
       interval = setInterval(() => setNow(Date.now()), 250);
    }
    return () => clearInterval(interval);
  }, [gameState?.timerActive, gameState?.circleTimerActive]);

  const handleInfoSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setJoiningStep('team');
  };

  const handleTeamSelect = async (team) => {
    const uuid = 'user_' + Math.random().toString(36).substr(2, 9);
    setPlayerId(uuid);
    
    await updateRoomState(roomId, { [`players/${uuid}`]: { name, interest, team } });

    // Persist session so refreshes don't re-create the player
    localStorage.setItem(SESSION_KEY(roomId), JSON.stringify({ playerId: uuid, name, interest }));
    setJoined(true);
  };

  if (!roomId) return <div className="loading">No Room ID</div>;
  if (loading) return <div className="loading">Connecting...</div>;
  
  if (!gameState) {
    return (
      <div className="player-join-screen fade-in" style={{ textAlign: 'center' }}>
        <h2>Room Not Found</h2>
        <p style={{ margin: '1.5rem 0', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
          We couldn't find a lobby with code <strong>{roomId}</strong>.
        </p>
        <a href="/" className="btn btn-secondary">
          Back to Home
        </a>
      </div>
    );
  }

  if (!joined) {
    if (joiningStep === 'info') {
      return (
        <div className="player-join-screen fade-in">
          <h2>Room: {roomId}</h2>
          <form onSubmit={handleInfoSubmit} className="join-form">
            <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className="input-code" required />
            <input type="text" placeholder="Hobby / Inside Joke" value={interest} onChange={(e) => setInterest(e.target.value)} className="input-code" style={{ marginTop: '1rem' }} />
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Next
            </button>
          </form>
        </div>
      );
    }

    if (joiningStep === 'team') {
      const players = Object.values(gameState?.players || {});
      const team1Count = players.filter(p => p.team === 1).length;
      const team2Count = players.filter(p => p.team === 2).length;

      return (
        <div className="player-join-screen fade-in">
          <h2>Pick a Team</h2>
          <div className="team-picker">
            <button className="team-card team-1" onClick={() => handleTeamSelect(1)}>
              <div className="team-card-title">Team 1</div>
              <div className="team-card-count">{team1Count} {team1Count === 1 ? 'player' : 'players'}</div>
            </button>
            <button className="team-card team-2" onClick={() => handleTeamSelect(2)}>
              <div className="team-card-title">Team 2</div>
              <div className="team-card-count">{team2Count} {team2Count === 1 ? 'player' : 'players'}</div>
            </button>
          </div>
          <button className="btn btn-secondary" onClick={() => setJoiningStep('info')} style={{ marginTop: '2rem' }}>Back</button>
        </div>
      );
    }
  }

  let currentTimer = gameState?.timer ?? 30;
  if (gameState?.timerActive && gameState?.timerEndTime) {
     currentTimer = Math.max(0, Math.ceil((gameState.timerEndTime - now) / 1000));
  }

  let currentCircleTimer = gameState?.circleTimer ?? 60;
  if (gameState?.circleTimerActive && gameState?.circleTimerEndTime) {
     currentCircleTimer = Math.max(0, Math.ceil((gameState.circleTimerEndTime - now) / 1000));
  }

  const myPlayer = gameState.players?.[playerId];
  const isGiver = gameState.currentTurn?.giverId === playerId;
  const isGuesser = gameState.currentTurn?.guesserId === playerId;
  const isMyTurn = isGiver || isGuesser;

  const passLimit = gameState.settings?.passLimit || 'unlimited';
  const passesUsed = gameState.passesUsed || 0;
  const isPassDisabled = passLimit !== 'unlimited' && passesUsed >= parseInt(passLimit);

  const selectCategory = (index) => {
    const numWords = gameState.board[index].words.length;
    updateRoomState(roomId, { 
      activeCategoryIndex: index,
      categoryRevealed: false,
      activeWordIndex: 0,
      wordStates: new Array(numWords).fill(false),
      timerActive: false,
      timer: gameState.settings?.timerDuration || 30,
      wordsScored: 0,
      passesUsed: 0
    });
  };

  const startCategory = () => {
    const duration = gameState.timer ?? gameState.settings?.timerDuration ?? 30;
    updateRoomState(roomId, {
      categoryRevealed: true,
      timerActive: true,
      timerEndTime: Date.now() + duration * 1000
    });
  };

  const markCorrect = () => {
    const nextScore = gameState.teams[myPlayer.team].score + 1;
    const nextWordScored = gameState.wordsScored + 1;
    const numWords = gameState.board[gameState.activeCategoryIndex].words.length;
    
    if (gameState.settings?.soundEnabled) {
      playDing();
    }

    let updates = {
      [`teams/${myPlayer.team}/score`]: nextScore,
      wordsScored: nextWordScored,
      [`wordStates/${gameState.activeWordIndex}`]: true
    };

    if (nextWordScored >= numWords) {
      // Finished category early
      updates.timerActive = false;
      updates.timer = currentTimer;
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
    if (isPassDisabled) return;

    const numWords = gameState.board[gameState.activeCategoryIndex].words.length;
    let nextIdx = (gameState.activeWordIndex + 1) % numWords;
    while(gameState.wordStates && gameState.wordStates[nextIdx] === true) {
       nextIdx = (nextIdx + 1) % numWords;
    }
    
    const nextPasses = (gameState.passesUsed || 0) + 1;

    if (gameState.settings?.soundEnabled) {
      playSwoosh();
    }

    updateRoomState(roomId, { 
      activeWordIndex: nextIdx,
      passesUsed: nextPasses
    });
  };

  const markCircleCorrect = () => {
    const nextBoard = [...gameState.circleBoard];
    nextBoard[gameState.activeCircleIndex].completed = true;

    if (gameState.settings?.soundEnabled) {
      playDing();
    }

    const allCompleted = nextBoard.every(b => b.completed);

    if (allCompleted) {
      if (gameState.settings?.soundEnabled) {
        playWin();
      }
      updateRoomState(roomId, {
        circleBoard: nextBoard,
        circleTimerActive: false,
        circleTimer: currentCircleTimer,
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

    if (gameState.settings?.soundEnabled) {
      playSwoosh();
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

      {gameState.status === 'round1' && isMyTurn && !isGiver && (
        <div className="waiting-view">
          <h2>It's Your Turn to Guess!</h2>
          <p style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>Listen to your teammate's clues.</p>
        </div>
      )}

      {gameState.status === 'round1' && isMyTurn && isGiver && gameState.activeCategoryIndex == null && (
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

      {gameState.status === 'round1' && isMyTurn && isGiver && gameState.activeCategoryIndex != null && (
        <div className="word-view">
          {!gameState.categoryRevealed ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              <h2 style={{ color: '#a0a0a0', margin: 0 }}>{gameState.board[gameState.activeCategoryIndex].name}</h2>
              <h3 style={{ margin: 0, lineHeight: 1.5 }}>{gameState.board[gameState.activeCategoryIndex].description}</h3>
              <button className="btn btn-primary" onClick={startCategory}>GO!</button>
            </div>
          ) : (
            <>
              <h1 className="active-word">
                {gameState.board[gameState.activeCategoryIndex].words[gameState.activeWordIndex]}
              </h1>
              <div className="action-buttons">
                <button className="btn btn-success action-btn" onClick={markCorrect}>CORRECT</button>
                <button 
                  className="btn btn-danger action-btn" 
                  onClick={markPass}
                  disabled={isPassDisabled}
                >
                  {passLimit === 'unlimited' ? 'PASS' : `PASS (${passesUsed}/${passLimit})`}
                </button>
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

      {gameState.status === 'winners_circle_selecting' && (
        <div className="waiting-view">
          <h2>Team {gameState.currentTurn.team} is going to the Winner's Circle!</h2>
          <p>The host is selecting who will play...</p>
        </div>
      )}

      {gameState.status === 'winners_circle' && !isMyTurn && (
        <div className="waiting-view">
          <h2>Team {gameState.currentTurn.team} is in the Winner's Circle!</h2>
          <p>Watch the TV!</p>
        </div>
      )}

      {gameState.status === 'winners_circle' && isMyTurn && !isGiver && (
        <div className="waiting-view">
          <h2>Winner's Circle</h2>
          <h3>It's Your Turn to Guess!</h3>
          <p style={{ marginTop: '1rem', color: 'var(--secondary)', fontSize: '1.25rem', fontWeight: 'bold' }}>Listen to your teammate's clues.</p>
        </div>
      )}

      {gameState.status === 'winners_circle' && isMyTurn && isGiver && (
        <div className="winners-circle-view">
          <h2 style={{ color: '#FFB800', margin: 0 }}>Winner's Circle</h2>
          {!gameState.circleRevealed ? (
            <>
              <h3 style={{ margin: 0 }}>Ready to start the clock?</h3>
              <button className="btn btn-primary" onClick={() => {
                const duration = gameState.circleTimer ?? gameState.settings?.circleTimerDuration ?? 60;
                updateRoomState(roomId, { 
                  circleRevealed: true, 
                  circleTimerActive: true,
                  circleTimerEndTime: Date.now() + duration * 1000
                });
              }}>GO!</button>
            </>
          ) : (
            <div className="word-view">
              <h2 style={{ margin: 0, lineHeight: 1.2, color: '#fff', fontSize: 'clamp(1.5rem, 6vw, 3rem)' }}>
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
