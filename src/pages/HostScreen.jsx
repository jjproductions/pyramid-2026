import React, { useState, useEffect, useRef } from 'react';
import { subscribeToRoom, setRoomState, updateRoomState } from '../firebase';
import categoriesData from '../content.json';
import { generatePyramidBoard } from '../ai';

const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getRandomCategories = () => {
  const randomRoundIndex = Math.floor(Math.random() * categoriesData.length);
  const round = categoriesData[randomRoundIndex].Round.Categories.Category;
  return round.map(cat => {
    const shuffledWords = [...cat.Word].sort(() => 0.5 - Math.random());
    return { 
      name: cat._name, 
      description: cat._description,
      words: shuffledWords.slice(0, 6),
      completed: false, 
      owner: null 
    };
  });
};

const getRandomCircle = () => {
  const randomRoundIndex = Math.floor(Math.random() * categoriesData.length);
  const phrases = categoriesData[randomRoundIndex].Round.Circle.Phrase;
  const shuffled = [...phrases].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 6).map(phrase => ({
    phrase,
    completed: false
  }));
};

export default function HostScreen() {
  const [roomId, setRoomId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [gameMode, setGameMode] = useState('classic');
  const timerRef = useRef(null);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomId(code);
    
    const initialState = {
      status: 'lobby',
      players: {},
      teams: {
        1: { score: 0 },
        2: { score: 0 }
      },
      board: getRandomCategories(),
      currentTurn: { team: 1, role: 'giver' },
      activeCategoryIndex: null,
      activeWordIndex: 0,
      timer: 30,
      timerActive: false,
      wordsScored: 0
    };
    
    setRoomState(code, initialState);
    const unsubscribe = subscribeToRoom(code, (state) => setGameState(state));
    return () => unsubscribe();
  }, []);

  // Host acts as the master timer
  useEffect(() => {
    if (gameState?.timerActive && gameState?.timer > 0) {
      timerRef.current = setTimeout(() => {
        updateRoomState(roomId, { timer: gameState.timer - 1 });
      }, 1000);
    } else if (gameState?.timer === 0 && gameState?.timerActive) {
      // Time is up!
      updateRoomState(roomId, { 
        timerActive: false, 
        status: 'round_summary',
        [`board/${gameState.activeCategoryIndex}/completed`]: true
      });
    }

    if (gameState?.circleTimerActive && gameState?.circleTimer > 0) {
      timerRef.current = setTimeout(() => {
        updateRoomState(roomId, { circleTimer: gameState.circleTimer - 1 });
      }, 1000);
    } else if (gameState?.circleTimer === 0 && gameState?.circleTimerActive) {
      updateRoomState(roomId, { 
        circleTimerActive: false, 
        status: 'winners_circle_summary'
      });
    }

    return () => clearTimeout(timerRef.current);
  }, [
    gameState?.timer, gameState?.timerActive, roomId, gameState?.activeCategoryIndex,
    gameState?.circleTimer, gameState?.circleTimerActive
  ]);

  if (!gameState) return <div className="loading">Creating Room...</div>;

  const players = Object.values(gameState.players || {});

  const startGame = async () => {
    if (gameMode === 'classic') {
      updateRoomState(roomId, { status: 'round1' });
    } else {
      updateRoomState(roomId, { status: 'generating' });
      try {
        const interests = players.map(p => p.interest).filter(Boolean);
        const board = await generatePyramidBoard(interests);
        const formattedBoard = board.map(cat => {
          const shuffledWords = [...cat.words].sort(() => 0.5 - Math.random());
          return { ...cat, words: shuffledWords.slice(0, 6), completed: false, owner: null };
        });
        updateRoomState(roomId, { status: 'round1', board: formattedBoard });
      } catch (e) {
        console.error(e);
        alert('AI Generation failed. Falling back to Classic Mode.');
        updateRoomState(roomId, { status: 'round1', board: getRandomCategories() });
      }
    }
  };

  const nextTurn = () => {
    const nextTeam = gameState.currentTurn.team === 1 ? 2 : 1;
    updateRoomState(roomId, {
      status: 'round1',
      currentTurn: { team: nextTeam, role: 'giver' },
      activeCategoryIndex: null,
      categoryRevealed: false,
      activeWordIndex: 0,
      timer: 30,
      timerActive: false,
      wordsScored: 0
    });
  };

  const startNewRound = () => {
    updateRoomState(roomId, {
      board: getRandomCategories(),
      currentTurn: { team: 1, role: 'giver' },
      activeCategoryIndex: null,
      categoryRevealed: false,
      activeWordIndex: 0,
      timer: 30,
      timerActive: false,
      wordsScored: 0
    });
  };

  const startWinnersCircle = () => {
    let winningTeam = 1;
    if (gameState.teams[2].score > gameState.teams[1].score) {
      winningTeam = 2;
    }
    updateRoomState(roomId, {
      status: 'winners_circle',
      currentTurn: { team: winningTeam, role: 'giver' },
      circleBoard: getRandomCircle(),
      activeCircleIndex: 0,
      circleTimer: 60,
      circleTimerActive: false,
      circleRevealed: false,
      'teams/1/score': 0,
      'teams/2/score': 0
    });
  };

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
    const teamId = gameState.currentTurn.team;
    const nextScore = gameState.teams[teamId].score + 1;
    const nextWordScored = gameState.wordsScored + 1;
    const numWords = gameState.board[gameState.activeCategoryIndex].words.length;
    
    let updates = {
      [`teams/${teamId}/score`]: nextScore,
      wordsScored: nextWordScored,
      [`wordStates/${gameState.activeWordIndex}`]: true
    };

    if (nextWordScored >= numWords) {
      updates.timerActive = false;
      updates.status = 'round_summary';
      updates[`board/${gameState.activeCategoryIndex}/completed`] = true;
    } else {
      let nextIdx = (gameState.activeWordIndex + 1) % numWords;
      // Skip already correctly guessed words
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

  const startCircleClock = () => {
    updateRoomState(roomId, {
      circleRevealed: true,
      circleTimerActive: true
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
    <div className="host-screen fade-in">
      {gameState.status === 'lobby' && (
        <div className="lobby-view">
          <h2>Room Code</h2>
          <h1 className="room-code-display">{roomId}</h1>
          <p>Join on your phone!</p>
          
          <div className="players-list">
            <div className="players-grid">
              {players.map((p, i) => (
                <div key={i} className={`player-badge team-${p.team}`}>{p.name} {p.interest ? `(${p.interest})` : ''} - Team {p.team}</div>
              ))}
            </div>
          </div>

          <div className="game-mode-selector" style={{ margin: '2rem 0' }}>
            <h3>Select Game Mode:</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button className={`btn ${gameMode === 'classic' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGameMode('classic')}>Classic (Built-in)</button>
              <button className={`btn ${gameMode === 'ai' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGameMode('ai')}>AI Personalized</button>
            </div>
          </div>

          {players.length >= 2 && (
            <button className="btn btn-primary start-btn" onClick={startGame}>
              Start Game
            </button>
          )}
        </div>
      )}

      {gameState.status === 'generating' && (
        <div className="generating-view" style={{ textAlign: 'center', marginTop: '4rem' }}>
          <h2 style={{ fontSize: '3rem', color: '#FFB800' }}>Building Pyramid...</h2>
          <p style={{ fontSize: '1.5rem', marginTop: '2rem' }}>The AI is analyzing your interests and generating custom categories...</p>
        </div>
      )}

      {gameState.status === 'round1' && gameState.activeCategoryIndex === null && (
        <div className="board-view">
          <div className="score-header">
            <div className="team-score">Team 1: {gameState.teams[1].score}</div>
            <h2>Team {gameState.currentTurn.team}'s Turn to Pick</h2>
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
                <button className="btn btn-primary" onClick={startWinnersCircle}>Go to Winner's Circle</button>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState.status === 'round1' && gameState.activeCategoryIndex !== null && (
        <div className="active-category-view" style={{ position: 'relative', width: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <div className="timer" style={{ 
            position: 'absolute', 
            top: '0', 
            right: '2rem', 
            fontSize: '4rem',
            fontWeight: 'bold',
            color: gameState.timer <= 10 ? '#ff3366' : '#fff'
          }}>
            0:{gameState.timer < 10 ? `0${gameState.timer}` : gameState.timer}
          </div>

          <h2 style={{ fontSize: '3rem', color: '#a0a0a0', marginBottom: '1rem' }}>
            {gameState.board[gameState.activeCategoryIndex].name}
          </h2>
          
          {!gameState.categoryRevealed ? (
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '2.5rem', color: '#fff', marginBottom: '3rem' }}>
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
      )}

      {gameState.status === 'round_summary' && (
        <div className="summary-view">
          <h1>Time's Up!</h1>
          <h2>Team {gameState.currentTurn.team} scored {gameState.wordsScored} points!</h2>
          <button className="btn btn-primary" onClick={nextTurn}>Next Turn</button>
        </div>
      )}

      {gameState.status === 'winners_circle' && (
        <div className="winners-circle-view" style={{ textAlign: 'center', width: '100%', minHeight: '60vh', position: 'relative' }}>
          <div className="timer" style={{ 
            position: 'absolute', 
            top: '0', 
            right: '2rem', 
            fontSize: '4rem',
            fontWeight: 'bold',
            color: gameState.circleTimer <= 10 ? '#ff3366' : '#fff'
          }}>
            {gameState.circleTimer}
          </div>

          <h1 style={{ color: '#FFB800', marginBottom: '2rem' }}>Winner's Circle</h1>
          
          <div className="circle-pyramid">
             <div className="pyramid-row top-row">
               <div className={`circle-card ${gameState.circleBoard[5].completed ? 'completed' : ''} ${gameState.activeCircleIndex === 5 && gameState.circleRevealed ? 'active' : ''}`}>
                 {gameState.circleBoard[5].completed ? '' : (gameState.circleRevealed && gameState.activeCircleIndex === 5 ? gameState.circleBoard[5].phrase : '???')}
               </div>
             </div>
             <div className="pyramid-row middle-row">
               {[3, 4].map(idx => (
                 <div key={idx} className={`circle-card ${gameState.circleBoard[idx].completed ? 'completed' : ''} ${gameState.activeCircleIndex === idx && gameState.circleRevealed ? 'active' : ''}`}>
                   {gameState.circleBoard[idx].completed ? '' : (gameState.circleRevealed && gameState.activeCircleIndex === idx ? gameState.circleBoard[idx].phrase : '???')}
                 </div>
               ))}
             </div>
             <div className="pyramid-row bottom-row">
               {[0, 1, 2].map(idx => (
                 <div key={idx} className={`circle-card ${gameState.circleBoard[idx].completed ? 'completed' : ''} ${gameState.activeCircleIndex === idx && gameState.circleRevealed ? 'active' : ''}`}>
                   {gameState.circleBoard[idx].completed ? '' : (gameState.circleRevealed && gameState.activeCircleIndex === idx ? gameState.circleBoard[idx].phrase : '???')}
                 </div>
               ))}
             </div>
          </div>

          {!gameState.circleRevealed && (
            <button className="btn btn-primary" onClick={startCircleClock} style={{ marginTop: '3rem', fontSize: '2rem', padding: '1rem 4rem' }}>START CLOCK</button>
          )}

          {gameState.circleRevealed && (
            <div className="controls" style={{ marginTop: '4rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
              <button className="btn btn-success" onClick={markCircleCorrect} style={{ fontSize: '2rem', padding: '1rem 4rem' }}>CORRECT</button>
              <button className="btn btn-danger" onClick={markCirclePass} style={{ fontSize: '2rem', padding: '1rem 4rem' }}>PASS</button>
            </div>
          )}
        </div>
      )}

      {gameState.status === 'winners_circle_summary' && (
        <div className="summary-view">
          <h1>Time's Up!</h1>
          <h2>Nice try!</h2>
          <button className="btn btn-primary" onClick={() => updateRoomState(roomId, { status: 'lobby' })}>Back to Lobby</button>
        </div>
      )}

      {gameState.status === 'winners_circle_win' && (
        <div className="summary-view win">
          <h1 style={{ color: '#FFB800', fontSize: '5rem' }}>YOU WON!</h1>
          <h2>$25,000 Pyramid!</h2>
          <button className="btn btn-primary" onClick={() => updateRoomState(roomId, { status: 'lobby' })}>Back to Lobby</button>
        </div>
      )}
    </div>
  );
}
