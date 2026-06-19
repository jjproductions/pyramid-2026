import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import HostScreen from './pages/HostScreen';
import PlayerScreen from './pages/PlayerScreen';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/host" element={<HostScreen />} />
          <Route path="/join" element={<PlayerScreen />} />
          <Route path="/join/:roomId" element={<PlayerScreen />} />
        </Routes>
      </div>
    </Router>
  );
}

function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = React.useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomCode.trim()) {
      navigate(`/join/${roomCode.toUpperCase()}`);
    }
  };

  return (
    <div className="home-screen">
      <h1 className="title">The $25,000 Pyramid</h1>
      <div className="home-actions">
        <div className="host-section">
          <h2>Play on TV</h2>
          <Link to="/host" className="btn btn-primary">Start as Host</Link>
          <p className="subtitle">Cast this screen to a TV</p>
        </div>
        
        <div className="join-section">
          <h2>Play on Phone</h2>
          <form onSubmit={handleJoin} className="join-form">
            <input 
              type="text" 
              placeholder="Room Code" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              maxLength={4}
              className="input-code"
            />
            <button type="submit" className="btn btn-secondary">Join Game</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
