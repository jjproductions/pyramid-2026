import React, { useState } from 'react';

export default function SettingsModal({ 
  roomId, 
  settingsOpen, 
  setSettingsOpen, 
  localSettings, 
  setLocalSettings, 
  saveSettings,
  contentFiles,
  defaultFilename
}) {
  const [settingsTab, setSettingsTab] = useState('game');

  if (!settingsOpen) return null;

  return (
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
  );
}
