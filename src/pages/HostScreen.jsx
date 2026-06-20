import React, { useState, useEffect, useRef } from 'react';
import { subscribeToRoom, setRoomState, updateRoomState } from '../firebase';
import { generatePyramidBoard } from '../ai';
import { playDing, playBuzz, playSwoosh, playClick, playWin } from '../utils/sounds';

import LobbyView from '../components/host/LobbyView';
import GameBoard from '../components/host/GameBoard';
import ActiveCategory from '../components/host/ActiveCategory';
import RoundSummary from '../components/host/RoundSummary';
import WinnersCircle from '../components/host/WinnersCircle';
import SettingsModal from '../components/host/SettingsModal';

// Lazily import all json files from the data directory
const contentModules = import.meta.glob('../../data/*.json');
const contentFiles = Object.keys(contentModules).reduce((acc, path) => {
  const filename = path.split('/').pop();
  acc[filename] = contentModules[path];
  return acc;
}, {});

// Fallback to the first found file, or content.json
const defaultFilename = Object.keys(contentFiles)[0] || 'content.json';

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

const getRandomCategories = async (settings = DEFAULT_SETTINGS) => {
  const numCategories = settings.numCategories || 6;
  const numWords = settings.numWordsPerCategory || 6;
  const chosenFile = settings.contentFile || defaultFilename;
  
  let data;
  if (contentFiles[chosenFile]) {
    const module = await contentFiles[chosenFile]();
    data = module.default || module;
  } else {
    data = [];
  }
  
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

const getRandomCircle = async (settings = DEFAULT_SETTINGS) => {
  const chosenFile = settings?.contentFile || defaultFilename;
  let data;
  if (contentFiles[chosenFile]) {
    const module = await contentFiles[chosenFile]();
    data = module.default || module;
  } else {
    data = [];
  }

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
  const [pairingModes, setPairingModes] = useState({ 1: false, 2: false });
  const [teamPairs, setTeamPairs] = useState({ 1: {}, 2: {} });
  const [settingsTab, setSettingsTab] = useState('game');
  const [localSettings, setLocalSettings] = useState(DEFAULT_SETTINGS);
  const [initialGivers, setInitialGivers] = useState({ 1: null, 2: null });
  const [now, setNow] = useState(Date.now());
  const prevTimerRef = useRef(null);
  const prevCircleTimerRef = useRef(null);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomId(code);
    let unsubscribe;
    
    getRandomCategories(DEFAULT_SETTINGS).then(initialBoard => {
      const initialState = {
        status: 'lobby',
        players: {},
        teams: {
          1: { score: 0 },
          2: { score: 0 }
        },
        board: initialBoard,
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
      unsubscribe = subscribeToRoom(code, (state) => setGameState(state));
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    let interval;
    if (gameState?.timerActive || gameState?.circleTimerActive) {
       interval = setInterval(() => setNow(Date.now()), 250);
    }
    return () => clearInterval(interval);
  }, [gameState?.timerActive, gameState?.circleTimerActive]);

  let currentTimer = gameState?.timer ?? 30;
  if (gameState?.timerActive && gameState?.timerEndTime) {
     currentTimer = Math.max(0, Math.ceil((gameState.timerEndTime - now) / 1000));
  }

  let currentCircleTimer = gameState?.circleTimer ?? 60;
  if (gameState?.circleTimerActive && gameState?.circleTimerEndTime) {
     currentCircleTimer = Math.max(0, Math.ceil((gameState.circleTimerEndTime - now) / 1000));
  }

  // Host acts as the master timer
  useEffect(() => {
    if (gameState?.timerActive && currentTimer !== prevTimerRef.current) {
      if (currentTimer <= 5 && currentTimer > 0 && gameState.settings?.soundEnabled) {
         playClick();
      }
      if (currentTimer === 0) {
        if (gameState.settings?.soundEnabled) playBuzz();
        updateRoomState(roomId, { 
          timerActive: false, 
          timer: 0,
          status: 'round_summary',
          [`board/${gameState.activeCategoryIndex}/completed`]: true
        });
      }
    }
    prevTimerRef.current = currentTimer;

    if (gameState?.circleTimerActive && currentCircleTimer !== prevCircleTimerRef.current) {
      if (currentCircleTimer <= 5 && currentCircleTimer > 0 && gameState.settings?.soundEnabled) {
         playClick();
      }
      if (currentCircleTimer === 0) {
        if (gameState.settings?.soundEnabled) playBuzz();
        updateRoomState(roomId, { 
          circleTimerActive: false, 
          circleTimer: 0,
          status: 'winners_circle_summary'
        });
      }
    }
    prevCircleTimerRef.current = currentCircleTimer;
  }, [currentTimer, currentCircleTimer, gameState?.timerActive, gameState?.circleTimerActive, roomId, gameState?.activeCategoryIndex, gameState?.settings?.soundEnabled]);

  if (!gameState) return <div className="loading">Creating Room...</div>;

  const players = Object.values(gameState.players || {});

  const startGame = async () => {
    // Validate pairs if pairing mode is enabled
    for (const tNum of [1, 2]) {
      if (pairingModes[tNum]) {
        const teamPlayerIds = Object.keys(gameState.players).filter(id => gameState.players[id].team === tNum);
        const pairsCount = {};
        for (const pId of teamPlayerIds) {
          const pairId = teamPairs[tNum][pId];
          if (pairId === undefined || pairId === '') {
            alert(`Team ${tNum} has unassigned players in pairing mode.`);
            return;
          }
          pairsCount[pairId] = (pairsCount[pairId] || 0) + 1;
        }
        if (Object.values(pairsCount).some(c => c !== 2)) {
          alert(`Team ${tNum} pairs are invalid. Each pair must have exactly 2 players.`);
          return;
        }
      }
    }

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

    let giverId   = activeOrder[activeGiverIdx] || null;
    let guesserId = activeOrder[activeGuesserIdx] || null;

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

    [1, 2].forEach(tNum => {
      if (pairingModes[tNum]) {
        const pairArray = [];
        Object.entries(teamPairs[tNum]).forEach(([pId, pairId]) => {
          if (!pairArray[pairId]) pairArray[pairId] = [];
          pairArray[pairId].push(pId);
        });
        rotationUpdates[`teams/${tNum}/isPairingMode`] = true;
        rotationUpdates[`teams/${tNum}/pairs`] = pairArray;
        rotationUpdates[`teams/${tNum}/activePairIndex`] = 0;
        rotationUpdates[`teams/${tNum}/pairRoleSwap`] = false;

        if (startingTeam === tNum) {
           const p = pairArray[0];
           rotationUpdates.currentTurn.giverId = p[1];
           rotationUpdates.currentTurn.guesserId = p[0];
        }
      } else {
        rotationUpdates[`teams/${tNum}/isPairingMode`] = false;
        rotationUpdates[`teams/${tNum}/pairs`] = null;
      }
    });

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
    const justPlayedTeam = gameState.currentTurn.team;
    
    let nextGiverIdx = teams[justPlayedTeam]?.giverIndex || 0;
    let nextGuesserIdx = teams[justPlayedTeam]?.guesserIndex || 0;
    let nextActivePairIdx = teams[justPlayedTeam]?.activePairIndex || 0;
    let nextPairRoleSwap = teams[justPlayedTeam]?.pairRoleSwap || false;

    if (teams[justPlayedTeam]?.isPairingMode) {
      const pairsCount = teams[justPlayedTeam].pairs?.length || 1;
      nextActivePairIdx = nextActivePairIdx + 1;
      if (nextActivePairIdx >= pairsCount) {
        nextActivePairIdx = 0;
        nextPairRoleSwap = !nextPairRoleSwap;
      }
    } else {
      const numPlayers = teams[justPlayedTeam]?.playerOrder?.length || 0;
      if (numPlayers > 0) {
        nextGiverIdx = (nextGiverIdx + 1) % numPlayers;
        nextGuesserIdx = (nextGuesserIdx + 1) % numPlayers;
      }
    }

    let giverId = null;
    let guesserId = null;

    if (teams[nextTeam]?.isPairingMode) {
      const activePairIdx = teams[nextTeam].activePairIndex || 0;
      const roleSwap = teams[nextTeam].pairRoleSwap || false;
      const pair = teams[nextTeam].pairs?.[activePairIdx];
      if (pair) {
        giverId = roleSwap ? pair[0] : pair[1];
        guesserId = roleSwap ? pair[1] : pair[0];
      }
    } else {
      const nextTeamOrder = teams[nextTeam]?.playerOrder || [];
      const nextTeamGiverIdx = teams[nextTeam]?.giverIndex || 0;
      const nextTeamGuesserIdx = teams[nextTeam]?.guesserIndex || 0;
      giverId   = nextTeamOrder[nextTeamGiverIdx]  || null;
      guesserId = nextTeamOrder[nextTeamGuesserIdx] || null;
    }

    const updates = {
      currentTurn: { team: nextTeam, giverId, guesserId },
    };

    if (teams[justPlayedTeam]?.isPairingMode) {
      updates[`teams/${justPlayedTeam}/activePairIndex`] = nextActivePairIdx;
      updates[`teams/${justPlayedTeam}/pairRoleSwap`] = nextPairRoleSwap;
    } else {
      updates[`teams/${justPlayedTeam}/giverIndex`] = nextGiverIdx;
      updates[`teams/${justPlayedTeam}/guesserIndex`] = nextGuesserIdx;
    }
    return updates;
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

  const startNewRound = async () => {
    // Preserve indices rotation across rounds; reset board and alternate starting team
    const teams = gameState.teams;
    const startingTeam = gameState.nextStartingTeam || 1;
    
    let giverId = null;
    let guesserId = null;

    if (teams[startingTeam]?.isPairingMode) {
      const activePairIdx = teams[startingTeam].activePairIndex || 0;
      const roleSwap = teams[startingTeam].pairRoleSwap || false;
      const pair = teams[startingTeam].pairs?.[activePairIdx];
      if (pair) {
        giverId = roleSwap ? pair[0] : pair[1];
        guesserId = roleSwap ? pair[1] : pair[0];
      }
    } else {
      const activeOrder = teams[startingTeam]?.playerOrder || [];
      const activeGiverIdx   = teams[startingTeam]?.giverIndex || 0;
      const activeGuesserIdx = teams[startingTeam]?.guesserIndex || 0;
      giverId   = activeOrder[activeGiverIdx] || null;
      guesserId = activeOrder[activeGuesserIdx] || null;
    }
    
    const newBoard = await getRandomCategories(gameState.settings);
    updateRoomState(roomId, {
      board: newBoard,
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

  const confirmWinnersCirclePlayers = async (giverId, guesserId) => {
    const rawCircle = await getRandomCircle(gameState.settings);
    const circleBoard = rawCircle.map(tile => ({ ...tile, summaryRevealed: false }));
    updateRoomState(roomId, {
      status: 'winners_circle',
      currentTurn: { team: gameState.currentTurn.team, giverId, guesserId },
      circleBoard,
      activeCircleIndex: 0,
      circleTimer: gameState.settings?.circleTimerDuration || DEFAULT_SETTINGS.circleTimerDuration,
      circleTimerActive: false,
      circleTimerEndTime: null,
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
    const duration = gameState.timer ?? gameState.settings?.timerDuration ?? DEFAULT_SETTINGS.timerDuration;
    updateRoomState(roomId, {
      categoryRevealed: true,
      timerActive: true,
      timerEndTime: Date.now() + duration * 1000
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
      updates.timer = currentTimer;
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
    const duration = gameState.circleTimer ?? gameState.settings?.circleTimerDuration ?? DEFAULT_SETTINGS.circleTimerDuration;
    updateRoomState(roomId, {
      circleRevealed: true,
      circleTimerActive: true,
      circleTimerEndTime: Date.now() + duration * 1000
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

  const openSettings = () => {
    setLocalSettings(gameState.settings || DEFAULT_SETTINGS);
    setSettingsTab('game');
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    const newBoard = await getRandomCategories(localSettings);
    updateRoomState(roomId, { 
      settings: localSettings,
      board: newBoard,
      timer: localSettings.timerDuration
    });
    setSettingsOpen(false);
  };

  return (
    <div className="host-screen fade-in">
      {gameState.status === 'lobby' && (
        <LobbyView 
          roomId={roomId}
          gameState={gameState}
          players={players}
          pairingModes={pairingModes}
          setPairingModes={setPairingModes}
          teamPairs={teamPairs}
          setTeamPairs={setTeamPairs}
          initialGivers={initialGivers}
          setInitialGivers={setInitialGivers}
          startGame={startGame}
          openSettings={openSettings}
        />
      )}

      {gameState.status === 'generating' && (
        <div className="generating-view" style={{ textAlign: 'center', marginTop: '4rem' }}>
          <h2 style={{ fontSize: '3rem', color: '#FFB800' }}>Building Pyramid...</h2>
          <p style={{ fontSize: '1.5rem', marginTop: '2rem' }}>The AI is analyzing your interests and generating custom categories...</p>
        </div>
      )}

      {gameState.status === 'round1' && gameState.activeCategoryIndex == null && (
        <GameBoard 
          gameState={gameState}
          selectCategory={selectCategory}
          startNewRound={startNewRound}
          startWinnersCircle={startWinnersCircle}
        />
      )}

      {gameState.status === 'round1' && gameState.activeCategoryIndex != null && (
        <ActiveCategory 
          gameState={gameState}
          currentTimer={currentTimer}
          startCategory={startCategory}
          markCorrect={markCorrect}
          markPass={markPass}
        />
      )}

      {gameState.status === 'round_summary' && (
        <RoundSummary 
          gameState={gameState}
          nextTurn={nextTurn}
        />
      )}

      {['winners_circle_selecting', 'winners_circle', 'winners_circle_summary', 'winners_circle_win'].includes(gameState.status) && (
        <WinnersCircle 
          roomId={roomId}
          gameState={gameState}
          currentCircleTimer={currentCircleTimer}
          players={players}
          updateRoomState={updateRoomState}
          confirmWinnersCirclePlayers={confirmWinnersCirclePlayers}
          startCircleClock={startCircleClock}
          markCircleCorrect={markCircleCorrect}
          markCirclePass={markCirclePass}
          revealCircleTile={revealCircleTile}
        />
      )}

      <SettingsModal 
        roomId={roomId}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        localSettings={localSettings}
        setLocalSettings={setLocalSettings}
        saveSettings={saveSettings}
        contentFiles={contentFiles}
        defaultFilename={defaultFilename}
      />
    </div>
  );
}
