import React, { useState, useEffect, useRef } from 'react';
import { subscribeToRoom, setRoomState, updateRoomState } from '../firebase';
import { generatePyramidBoard } from '../ai';
import { playDing, playBuzz, playSwoosh, playClick, playWin } from '../utils/sounds';

// Eagerly import all json files from the data directory
const contentModules = import.meta.glob('../../data/*.json', { eager: true });
const contentFiles = Object.keys(contentModules).reduce((acc, path) => {
  const filename = path.split('/').pop();
  acc[filename] = contentModules[path].default;
  return acc;
}, {});

// Fallback to the first found file, or content.json
const defaultFilename = Object.keys(contentFiles)[0] || 'content.json';
const categoriesData = contentFiles[defaultFilename] || [];

const DEFAULT_SETTINGS = {
  gameMode: 'classic',
  contentFile: defaultFilename,
  aiProvider: 'local',
  localUrl: 'http://localhost:11434/v1/chat/completions',
  localModel: 'mistral-small3.2:24b-instruct-2506-q4_K_M',
  geminiModel: 'gemini-1.5-flash-latest',
  geminiApiKey: '',
  timerDuration: 30,
  circleTimerDuration: 60,
  numCategories: 6,
  numWordsPerCategory: 6,
  passLimit: 'unlimited',
  difficulty: 'medium',
  tone: 'standard',
  soundEnabled: true
};

const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getRandomCategories = (settings = DEFAULT_SETTINGS) => {
  const numCategories = settings.numCategories || 6;
  const numWords = settings.numWordsPerCategory || 6;
  const chosenFile = settings.contentFile || defaultFilename;
  const data = contentFiles[chosenFile] || categoriesData;
  
  if (!data || data.length === 0) return [];
  const randomRoundIndex = Math.floor(Math.random() * data.length);
  const round = data[randomRoundIndex].Round.Categories.Category;
  
  const slicedRound = round.slice(0, numCategories);
  return slicedRound.map(cat => {
    const shuffledWords = [...cat.Word].sort(() => 0.5 - Math.random());
    return { 
      name: cat._name, 
      description: cat._description,
      words: shuffledWords.slice(0, numWords),
      completed: false, 
      owner: null 
    };
  });
};

const getRandomCircle = (settings = DEFAULT_SETTINGS) => {
  const chosenFile = settings?.contentFile || defaultFilename;
  const data = contentFiles[chosenFile] || categoriesData;

  if (!data || data.length === 0) return [];
  const randomRoundIndex = Math.floor(Math.random() * data.length);
  const phrases = data[randomRoundIndex].Round.Circle.Phrase;
  const shuffled = [...phrases].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 6).map(phrase => ({
    phrase,
    completed: false
  }));
};

export default function HostScreen() {
  const [roomId, setRoomId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('game');
  const [localSettings, setLocalSettings] = useState(DEFAULT_SETTINGS);
  const [initialGivers, setInitialGivers] = useState({ 1: null, 2: null });
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
      board: getRandomCategories(DEFAULT_SETTINGS),
      currentTurn: { team: 1, role: 'giver' },
      activeCategoryIndex: null,
      activeWordIndex: 0,
      timer: DEFAULT_SETTINGS.timerDuration,
      timerActive: false,
      wordsScored: 0,
      passesUsed: 0,
      settings: DEFAULT_SETTINGS
    };
    
    setRoomState(code, initialState);
    const unsubscribe = subscribeToRoom(code, (state) => setGameState(state));
    return () => unsubscribe();
  }, []);

  // Host acts as the master timer
  useEffect(() => {
    if (gameState?.timerActive && gameState?.timer > 0) {
      timerRef.current = setTimeout(() => {
        const nextTime = gameState.timer - 1;
        updateRoomState(roomId, { timer: nextTime });
        
        // Sound warning tick in final 5 seconds
        if (gameState.settings?.soundEnabled && nextTime <= 5 && nextTime > 0) {
          playClick();
        }
      }, 1000);
    } else if (gameState?.timer === 0 && gameState?.timerActive) {
      // Time is up!
      if (gameState.settings?.soundEnabled) {
        playBuzz();
      }
      updateRoomState(roomId, { 
        timerActive: false, 
        status: 'round_summary',
        [`board/${gameState.activeCategoryIndex}/completed`]: true
      });
    }

    if (gameState?.circleTimerActive && gameState?.circleTimer > 0) {
      timerRef.current = setTimeout(() => {
        const nextTime = gameState.circleTimer - 1;
        updateRoomState(roomId, { circleTimer: nextTime });
        
        // Sound warning tick in final 5 seconds
        if (gameState.settings?.soundEnabled && nextTime <= 5 && nextTime > 0) {
          playClick();
        }
      }, 1000);
    } else if (gameState?.circleTimer === 0 && gameState?.circleTimerActive) {
      if (gameState.settings?.soundEnabled) {
        playBuzz();
      }
      updateRoomState(roomId, { 
        circleTimerActive: false, 
        status: 'winners_circle_summary'
      });
    }

    return () => clearTimeout(timerRef.current);
  }, [
    gameState?.timer, gameState?.timerActive, roomId, gameState?.activeCategoryIndex,
    gameState?.circleTimer, gameState?.circleTimerActive, gameState?.settings?.soundEnabled
  ]);

  if (!gameState) return <div className="loading">Creating Room...</div>;

  const players = Object.values(gameState.players || {});

  const startGame = async () => {
    const finalMode = gameState.settings?.gameMode || 'classic';

    // Build ordered player lists per team for rotation
    const allPlayers = Object.entries(gameState.players || {});
    const team1Order = allPlayers.filter(([,p]) => p.team === 1).map(([id]) => id);
    const team2Order = allPlayers.filter(([,p]) => p.team === 2).map(([id]) => id);

    const t1Selected = initialGivers[1] || team1Order[1] || team1Order[0];
    const t2Selected = initialGivers[2] || team2Order[1] || team2Order[0];

    const t1GiverIdx = team1Order.indexOf(t1Selected);
    const t2GiverIdx = team2Order.indexOf(t2Selected);

    const t1GuesserIdx = team1Order.length > 1 ? (t1GiverIdx - 1 + team1Order.length) % team1Order.length : 0;
    const t2GuesserIdx = team2Order.length > 1 ? (t2GiverIdx - 1 + team2Order.length) % team2Order.length : 0;

    const startingTeam = gameState.nextStartingTeam || 1;
    const activeOrder = startingTeam === 1 ? team1Order : team2Order;
    const activeGiverIdx = startingTeam === 1 ? t1GiverIdx : t2GiverIdx;
    const activeGuesserIdx = startingTeam === 1 ? t1GuesserIdx : t2GuesserIdx;

    const giverId   = activeOrder[activeGiverIdx] || null;
    const guesserId = activeOrder[activeGuesserIdx] || null;

    const rotationUpdates = {
      'teams/1/giverIndex':  t1GiverIdx !== -1 ? t1GiverIdx : 0,
      'teams/1/guesserIndex': t1GuesserIdx,
      'teams/1/playerOrder': team1Order,
      'teams/2/giverIndex':  t2GiverIdx !== -1 ? t2GiverIdx : 0,
      'teams/2/guesserIndex': t2GuesserIdx,
      'teams/2/playerOrder': team2Order,
      currentTurn: { team: startingTeam, giverId, guesserId },
      nextStartingTeam: startingTeam === 1 ? 2 : 1
    };

    if (finalMode === 'classic') {
      updateRoomState(roomId, {
        ...rotationUpdates,
        status: 'round1',
        timer: gameState.settings?.timerDuration || DEFAULT_SETTINGS.timerDuration
      });
    } else {
      updateRoomState(roomId, { status: 'generating', ...rotationUpdates });
      try {
        const interests = players.map(p => p.interest).filter(Boolean);
        const board = await generatePyramidBoard(interests, gameState.settings);
        const formattedBoard = board.map(cat => {
          const shuffledWords = [...cat.words].sort(() => 0.5 - Math.random());
          return { 
            ...cat, 
            words: shuffledWords.slice(0, gameState.settings?.numWordsPerCategory || 6), 
            completed: false, 
            owner: null 
          };
        });
        updateRoomState(roomId, { 
          status: 'round1', 
          board: formattedBoard,
          timer: gameState.settings?.timerDuration || DEFAULT_SETTINGS.timerDuration
        });
      } catch (e) {
        console.error(e);
        alert(e.message || 'AI Generation failed. Falling back to Classic Mode.');
        updateRoomState(roomId, { 
          status: 'round1', 
          board: getRandomCategories(gameState.settings),
          timer: gameState.settings?.timerDuration || DEFAULT_SETTINGS.timerDuration
        });
      }
    }
  };

  // Helper: compute next giverId / guesserId after a turn ends
  const computeNextTurn = (nextTeam) => {
    const teams = gameState.teams;
    // The team that just played advances their indices
    const justPlayedTeam = gameState.currentTurn.team;
    const order = teams[justPlayedTeam]?.playerOrder || [];
    const numPlayers = order.length;
    
    let nextGiverIdx = teams[justPlayedTeam]?.giverIndex || 0;
    let nextGuesserIdx = teams[justPlayedTeam]?.guesserIndex || 0;

    if (numPlayers > 0) {
      nextGiverIdx = (nextGiverIdx + 1) % numPlayers;
      nextGuesserIdx = (nextGuesserIdx + 1) % numPlayers;
    }

    const nextTeamOrder = teams[nextTeam]?.playerOrder || [];
    const nextTeamGiverIdx = teams[nextTeam]?.giverIndex || 0;
    const nextTeamGuesserIdx = teams[nextTeam]?.guesserIndex || 0;

    const giverId   = nextTeamOrder[nextTeamGiverIdx]  || null;
    const guesserId = nextTeamOrder[nextTeamGuesserIdx] || null;

    return {
      [`teams/${justPlayedTeam}/giverIndex`]: nextGiverIdx,
      [`teams/${justPlayedTeam}/guesserIndex`]: nextGuesserIdx,
      currentTurn: { team: nextTeam, giverId, guesserId },
    };
  };

  const nextTurn = () => {
    const nextTeam = gameState.currentTurn.team === 1 ? 2 : 1;
    updateRoomState(roomId, {
      ...computeNextTurn(nextTeam),
      status: 'round1',
      activeCategoryIndex: null,
      categoryRevealed: false,
      activeWordIndex: 0,
      timer: gameState.settings?.timerDuration || DEFAULT_SETTINGS.timerDuration,
      timerActive: false,
      wordsScored: 0,
      passesUsed: 0
    });
  };

  const startNewRound = () => {
    // Preserve indices rotation across rounds; reset board and alternate starting team
    const teams = gameState.teams;
    const startingTeam = gameState.nextStartingTeam || 1;
    
    const activeOrder = teams[startingTeam]?.playerOrder || [];
    const activeGiverIdx   = teams[startingTeam]?.giverIndex || 0;
    const activeGuesserIdx = teams[startingTeam]?.guesserIndex || 0;
    
    const giverId   = activeOrder[activeGiverIdx] || null;
    const guesserId = activeOrder[activeGuesserIdx] || null;
    
    updateRoomState(roomId, {
      board: getRandomCategories(gameState.settings),
      currentTurn: { team: startingTeam, giverId, guesserId },
      nextStartingTeam: startingTeam === 1 ? 2 : 1,
      activeCategoryIndex: null,
      categoryRevealed: false,
      activeWordIndex: 0,
      timer: gameState.settings?.timerDuration || DEFAULT_SETTINGS.timerDuration,
      timerActive: false,
      wordsScored: 0,
      passesUsed: 0
    });
  };

  const startWinnersCircle = () => {
    let winningTeam = 1;
    if (gameState.teams[2].score > gameState.teams[1].score) {
      winningTeam = 2;
    }
    const nonParticipatingTeam = winningTeam === 1 ? 2 : 1;
    
    updateRoomState(roomId, {
      status: 'winners_circle_selecting',
      currentTurn: { team: winningTeam, giverId: null, guesserId: null },
      nextStartingTeam: nonParticipatingTeam,
      'teams/1/score': 0,
      'teams/2/score': 0
    });
  };

  const confirmWinnersCirclePlayers = (giverId, guesserId) => {
    const circleBoard = getRandomCircle(gameState.settings).map(tile => ({ ...tile, summaryRevealed: false }));
    updateRoomState(roomId, {
      status: 'winners_circle',
      currentTurn: { team: gameState.currentTurn.team, giverId, guesserId },
      circleBoard,
      activeCircleIndex: 0,
      circleTimer: gameState.settings?.circleTimerDuration || DEFAULT_SETTINGS.circleTimerDuration,
      circleTimerActive: false,
      circleRevealed: false
    });
  };

  const revealCircleTile = (idx) => {
    if (gameState.status !== 'winners_circle_summary') return;
    updateRoomState(roomId, {
      [`circleBoard/${idx}/summaryRevealed`]: true
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
      timer: gameState.settings?.timerDuration || DEFAULT_SETTINGS.timerDuration,
      wordsScored: 0,
      passesUsed: 0
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
    
    if (gameState.settings?.soundEnabled) {
      playDing();
    }

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
    
    const nextPasses = (gameState.passesUsed || 0) + 1;

    if (gameState.settings?.soundEnabled) {
      playSwoosh();
    }

    updateRoomState(roomId, { 
      activeWordIndex: nextIdx,
      passesUsed: nextPasses
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

  const openSettings = () => {
    setLocalSettings(gameState.settings || DEFAULT_SETTINGS);
    setSettingsTab('game');
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    updateRoomState(roomId, { 
      settings: localSettings,
      board: getRandomCategories(localSettings),
      timer: localSettings.timerDuration
    });
    setSettingsOpen(false);
  };

  return (
    <div className="host-screen fade-in">
      {gameState.status === 'lobby' && (
        <div className="lobby-view">
          <button className="settings-btn" onClick={openSettings} title="Settings">⚙️</button>
          <h2>Room Code</h2>
          <h1 className="room-code-display">{roomId}</h1>
          <p>Join on your phone!</p>
          
          <div className="lobby-teams">
            {[1, 2].map(teamNum => {
              const teamPlayers = players.filter(p => p.team === teamNum);
              return (
                <div key={teamNum} className={`lobby-team-column team-col-${teamNum}`}>
                  <div className="lobby-team-header">Team {teamNum} ({teamPlayers.length})</div>
                  {teamPlayers.length === 0 
                    ? <div className="lobby-team-empty">Waiting...</div>
                    : teamPlayers.map((p, i) => {
                        const id = Object.keys(gameState.players).find(k => gameState.players[k] === p);
                        const isGiver = initialGivers[teamNum] === id || (!initialGivers[teamNum] && i === 1) || (teamPlayers.length === 1 && i === 0);
                        return (
                          <div key={i} className={`player-badge team-${teamNum}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', boxSizing: 'border-box' }}>
                            <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span className="player-order">#{i + 1}</span>
                              {p.name}{p.interest ? ` (${p.interest})` : ''}
                            </div>
                            <label title="Set as 1st Giver" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <input 
                                type="radio" 
                                name={`team-${teamNum}-giver`}
                                checked={isGiver}
                                onChange={() => setInitialGivers(prev => ({ ...prev, [teamNum]: id }))}
                                style={{ transform: 'scale(1.5)', cursor: 'pointer', margin: 0, accentColor: 'var(--primary)' }}
                              />
                            </label>
                          </div>
                        );
                      })
                  }
                </div>
              );
            })}
          </div>

          <div className="game-mode-display" style={{ margin: '2rem 0', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
            Current Mode: <strong style={{ color: 'var(--primary)' }}>
              {gameState.settings?.gameMode === 'ai' ? 'AI Personalized' : 'Classic (Built-in)'}
            </strong>
          </div>

          {(players.filter(p => p.team === 1).length >= 2 && players.filter(p => p.team === 2).length >= 2) ? (
            <button className="btn btn-primary start-btn" onClick={startGame}>
              Start Game
            </button>
          ) : (
            <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Need at least 2 players per team to start.</p>
          )}
        </div>
      )}

      {gameState.status === 'generating' && (
        <div className="generating-view" style={{ textAlign: 'center', marginTop: '4rem' }}>
          <h2 style={{ fontSize: '3rem', color: '#FFB800' }}>Building Pyramid...</h2>
          <p style={{ fontSize: '1.5rem', marginTop: '2rem' }}>The AI is analyzing your interests and generating custom categories...</p>
        </div>
      )}

      {gameState.status === 'round1' && gameState.activeCategoryIndex == null && (
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
      )}

      {gameState.status === 'round1' && gameState.activeCategoryIndex != null && (
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
      )}

      {gameState.status === 'round_summary' && (
        <div className="summary-view">
          <h1>Time's Up!</h1>
          <h2>Team {gameState.currentTurn.team} scored {gameState.wordsScored} points!</h2>
          <button className="btn btn-primary" onClick={nextTurn}>Next Turn</button>
        </div>
      )}

      {gameState.status === 'winners_circle_selecting' && (
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
      )}

      {['winners_circle', 'winners_circle_summary'].includes(gameState.status) && (

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
                   key={idx} 
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
                   key={idx} 
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
      )}

      {gameState.status === 'winners_circle_win' && (
        <div className="summary-view win">
          <h1 style={{ color: '#FFB800', fontSize: '5rem' }}>YOU WON!</h1>
          <h2>$25,000 Pyramid!</h2>
          <button className="btn btn-primary" onClick={() => updateRoomState(roomId, { status: 'lobby' })}>Back to Lobby</button>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-overlay">
          <div className="settings-modal fade-in">
            <div className="settings-header">
              <h2>Lobby Settings</h2>
              <button className="close-btn" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            
            <div className="settings-tabs">
              <button className={`settings-tab-btn ${settingsTab === 'game' ? 'active' : ''}`} onClick={() => setSettingsTab('game')}>Game Setup</button>
              <button className={`settings-tab-btn ${settingsTab === 'ai' ? 'active' : ''}`} onClick={() => setSettingsTab('ai')}>AI Generation</button>
            </div>
            
            <div className="settings-body">
              {settingsTab === 'game' ? (
                <div className="settings-tab-content">
                  <div className="settings-group">
                    <label>Game Mode</label>
                    <select value={localSettings.gameMode} onChange={e => {
                      setLocalSettings({...localSettings, gameMode: e.target.value});
                      setGameMode(e.target.value);
                    }} className="settings-select">
                      <option value="classic">Classic (Built-in Categories)</option>
                      <option value="ai">AI Personalized Mode</option>
                    </select>
                  </div>
                  
                  {localSettings.gameMode === 'classic' && (
                    <div className="settings-group">
                      <label>Built-in Content File</label>
                      <select value={localSettings.contentFile || defaultFilename} onChange={e => {
                        setLocalSettings({...localSettings, contentFile: e.target.value});
                      }} className="settings-select">
                        {Object.keys(contentFiles).map(filename => (
                          <option key={filename} value={filename}>{filename}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="settings-group" style={{ flex: 1 }}>
                      <label>Category Timer (seconds)</label>
                      <input type="number" min="5" max="180" value={localSettings.timerDuration} onChange={e => setLocalSettings({...localSettings, timerDuration: parseInt(e.target.value) || 30})} className="settings-input" />
                    </div>
                    <div className="settings-group" style={{ flex: 1 }}>
                      <label>Winner's Circle Timer (seconds)</label>
                      <input type="number" min="5" max="300" value={localSettings.circleTimerDuration} onChange={e => setLocalSettings({...localSettings, circleTimerDuration: parseInt(e.target.value) || 60})} className="settings-input" />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="settings-group" style={{ flex: 1 }}>
                      <label>Number of Categories</label>
                      <select value={localSettings.numCategories} onChange={e => setLocalSettings({...localSettings, numCategories: parseInt(e.target.value) || 6})} className="settings-select">
                        <option value="3">3 Categories (Short)</option>
                        <option value="6">6 Categories (Classic)</option>
                      </select>
                    </div>
                    <div className="settings-group" style={{ flex: 1 }}>
                      <label>Words per Category</label>
                      <select value={localSettings.numWordsPerCategory} onChange={e => setLocalSettings({...localSettings, numWordsPerCategory: parseInt(e.target.value) || 6})} className="settings-select">
                        <option value="5">5 Words</option>
                        <option value="6">6 Words (Classic)</option>
                        <option value="7">7 Words</option>
                      </select>
                    </div>
                  </div>

                  <div className="settings-group">
                    <label>Pass Limit</label>
                    <select value={localSettings.passLimit} onChange={e => setLocalSettings({...localSettings, passLimit: e.target.value})} className="settings-select">
                      <option value="unlimited">Unlimited Passes</option>
                      <option value="1">1 Pass per Category</option>
                      <option value="2">2 Passes per Category</option>
                      <option value="3">3 Passes per Category</option>
                    </select>
                  </div>

                  <div className="settings-group">
                    <div className="settings-checkbox-group">
                      <input type="checkbox" id="soundEnabled" checked={localSettings.soundEnabled} onChange={e => setLocalSettings({...localSettings, soundEnabled: e.target.checked})} />
                      <label htmlFor="soundEnabled">Enable sound effects (Dings, Buzzers, Ticks)</label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="settings-tab-content">
                  <div className="settings-group">
                    <label>AI Provider</label>
                    <select value={localSettings.aiProvider} onChange={e => setLocalSettings({...localSettings, aiProvider: e.target.value})} className="settings-select">
                      <option value="local">Local LLM (Ollama / LM Studio)</option>
                      <option value="gemini">Google Gemini API</option>
                    </select>
                  </div>

                  {localSettings.aiProvider === 'local' ? (
                    <>
                      <div className="settings-group">
                        <label>Local LLM URL</label>
                        <input type="text" value={localSettings.localUrl} onChange={e => setLocalSettings({...localSettings, localUrl: e.target.value})} className="settings-input" />
                      </div>
                      <div className="settings-group">
                        <label>Local LLM Model</label>
                        <input type="text" value={localSettings.localModel} onChange={e => setLocalSettings({...localSettings, localModel: e.target.value})} className="settings-input" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="settings-group">
                        <label>Gemini API Key</label>
                        <input type="password" value={localSettings.geminiApiKey} onChange={e => setLocalSettings({...localSettings, geminiApiKey: e.target.value})} className="settings-input" placeholder="AIzaSy..." />
                      </div>
                      <div className="settings-group">
                        <label>Gemini Model</label>
                        <select value={localSettings.geminiModel} onChange={e => setLocalSettings({...localSettings, geminiModel: e.target.value})} className="settings-select">
                          <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Recommended)</option>
                          <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="settings-group" style={{ flex: 1 }}>
                      <label>AI Category Difficulty</label>
                      <select value={localSettings.difficulty} onChange={e => setLocalSettings({...localSettings, difficulty: e.target.value})} className="settings-select">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div className="settings-group" style={{ flex: 1 }}>
                      <label>AI Category Tone</label>
                      <select value={localSettings.tone} onChange={e => setLocalSettings({...localSettings, tone: e.target.value})} className="settings-select">
                        <option value="standard">Standard</option>
                        <option value="witty">Witty (Puns)</option>
                        <option value="inside-joke">Inside Jokes / Personalized</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="settings-footer">
              <button className="btn btn-secondary" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSettings}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
