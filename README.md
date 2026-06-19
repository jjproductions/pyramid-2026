# The $25,000 Pyramid Game

An interactive, multi-screen party game modeled after the classic TV game show *The $25,000 Pyramid*. Players join on their phones, assign themselves to teams, and give clues to complete categories, while the game board is displayed on a host screen (e.g., cast to a TV).

---

## 🌟 Features

- **Double-Screen Experience**: A castable TV Host dashboard showing the main board, timer, and team scores, and a mobile Player controller for clue-givers to reveal words and submit scores.
- **Classic Gameplay**: Play with curated retro round categories loaded from a static dataset.
- **AI Personalized Mode**: Generates customized categories on the fly using player interests, connecting to Ollama, LM Studio, or Gemini.
- **Robust Real-Time Syncing**: Powered by Firebase Realtime Database with a built-in LocalStorage fallback for zero-setup local multiplayer across tabs.
- **Automated Testing**: Spawns host and player contexts inside Puppeteer to walk through the entire game flow.

---

## 📂 Documentation

Explore detailed information about how the application works, how to configure it, and how to get started:

- 🚀 **[Getting Started](file:///Users/jj/code/AI/pyramid-2026/docs/getting-started.md)**: Steps to install, set up environment variables, and run locally.
- 🏗️ **[System Architecture](file:///Users/jj/code/AI/pyramid-2026/docs/architecture.md)**: Detail on the client-server relationship, database synchronization layer, and local fallback syncing.
- 🤖 **[Game Modes and AI Integration](file:///Users/jj/code/AI/pyramid-2026/docs/game-modes-and-ai.md)**: Explanation of Classic vs. AI mode, prompt formatting, and LLM providers.
- 📊 **[Database Schema](file:///Users/jj/code/AI/pyramid-2026/docs/database-schema.md)**: Detailed JSON tree format mapping game states, team info, player roles, and timers.

---

## ⚡ Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure variables (Optional)
Copy variables to a `.env.local` file (leave empty to use mock local storage database):
```bash
cp .env.local.example .env.local # Or create a new .env.local file
```

### 3. Launch Development Server
```bash
npm run dev
```
- Open Host Screen: [http://localhost:5173/host](http://localhost:5173/host)
- Open Player Screen: [http://localhost:5173/join](http://localhost:5173/join)

### 4. Run E2E Test
Make sure your development server is active, then execute:
```bash
node test.cjs
```
