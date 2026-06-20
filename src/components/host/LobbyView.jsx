import React from 'react';

export default function LobbyView({
  roomId,
  gameState,
  players,
  pairingModes,
  setPairingModes,
  teamPairs,
  setTeamPairs,
  initialGivers,
  setInitialGivers,
  startGame,
  openSettings
}) {
  return (
    <div className="lobby-view">
      <button className="settings-btn" onClick={openSettings} title="Settings">⚙️</button>
      <h2>Room Code</h2>
      <h1 className="room-code-display">{roomId}</h1>
      <p>Join on your phone!</p>
      
      <div className="lobby-teams">
        {[1, 2].map(teamNum => {
          const teamPlayers = players.filter(p => p.team === teamNum);
          const canPair = teamPlayers.length >= 4 && teamPlayers.length % 2 === 0;

          return (
            <div key={teamNum} className={`lobby-team-column team-col-${teamNum}`}>
              <div className="lobby-team-header">
                Team {teamNum} ({teamPlayers.length})
              </div>
              {canPair && (
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <input 
                    type="checkbox" 
                    id={`pair-mode-${teamNum}`}
                    checked={pairingModes[teamNum]}
                    onChange={(e) => setPairingModes(prev => ({ ...prev, [teamNum]: e.target.checked }))}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <label htmlFor={`pair-mode-${teamNum}`} style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Enable Pairing Mode</label>
                </div>
              )}

              {teamPlayers.length === 0 
                ? <div className="lobby-team-empty">Waiting...</div>
                : teamPlayers.map((p, i) => {
                    const id = Object.keys(gameState.players).find(k => gameState.players[k] === p);
                    const isGiver = initialGivers[teamNum] === id || (!initialGivers[teamNum] && i === 1) || (teamPlayers.length === 1 && i === 0);
                    return (
                      <div key={id} className={`player-badge team-${teamNum}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', boxSizing: 'border-box' }}>
                        <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span className="player-order">#{i + 1}</span>
                          {p.name}{p.interest ? ` (${p.interest})` : ''}
                        </div>
                        
                        {pairingModes[teamNum] ? (
                          <select 
                            value={teamPairs[teamNum][id] || ''} 
                            onChange={(e) => setTeamPairs(prev => ({ ...prev, [teamNum]: { ...prev[teamNum], [id]: e.target.value } }))}
                            style={{ padding: '0.25rem', borderRadius: '4px', background: 'var(--bg-main)', color: 'white', border: '1px solid var(--secondary)' }}
                          >
                            <option value="">Pair...</option>
                            {Array.from({ length: teamPlayers.length / 2 }).map((_, idx) => (
                              <option key={idx} value={idx}>Pair {idx + 1}</option>
                            ))}
                          </select>
                        ) : (
                          <label title="Set as 1st Giver" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="radio" 
                              name={`team-${teamNum}-giver`}
                              checked={isGiver}
                              onChange={() => setInitialGivers(prev => ({ ...prev, [teamNum]: id }))}
                              style={{ transform: 'scale(1.5)', cursor: 'pointer', margin: 0, accentColor: 'var(--primary)' }}
                            />
                          </label>
                        )}
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
  );
}
