# Getting Started

Welcome to the **$25,000 Pyramid Game** setup guide! Follow these instructions to run the application locally on your machine and execute end-to-end (E2E) tests.

---

## 1. Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (version 18+ is recommended).

## 2. Installation

Clone the repository and install dependencies using `npm`:

```bash
# Install package dependencies
npm install
```

## 3. Environment Configuration

The application supports both Firebase-backed multiplayer syncing and a local mock mode for development/testing across multiple tabs without external services.

Create or update a `.env.local` file in the root directory:

```ini
# --- AI Provider Settings ---
# Choose either 'local' or 'gemini'
VITE_AI_PROVIDER="local"

# --- Local LLM Configurations (Ollama / LM Studio) ---
# Endpoint to connect to local OpenAI-compatible chat API
VITE_LOCAL_LLM_URL="http://localhost:11434/v1/chat/completions"
# Model ID deployed in your local runner (e.g., Llama, Mistral)
VITE_LOCAL_LLM_MODEL="mistral-small3.2:24b-instruct-2506-q4_K_M"

# --- Gemini Configuration (Google AI) ---
# Set VITE_AI_PROVIDER="gemini" and add API Key to use Gemini Flash API
VITE_GEMINI_API_KEY=""

# --- Firebase Realtime Database Configurations ---
# If left empty, the app will automatically fall back to LocalStorage-based state syncing.
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_DATABASE_URL=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
```

## 4. Running the Development Server

To launch the local web server:

```bash
npm run dev
```

By default, Vite will start the development server at [http://localhost:5173/](http://localhost:5173/).

- **Host View**: Open [http://localhost:5173/host](http://localhost:5173/host) to initiate a room and render the game board (usually cast to a TV).
- **Player View**: Open [http://localhost:5173/join](http://localhost:5173/join) or enter the generated 4-letter room code to play as a player using a smartphone or secondary screen.

## 5. Gameplay Mechanics

### The Join Flow
Players join the game from their mobile devices using the 4-letter room code.
1. The player enters their Name and an "Interest" (used if the Host selects AI Personalized mode).
2. The player manually selects to join **Team 1** or **Team 2**.
3. In the Host Lobby, the Host can use radio buttons to manually select who will be the "1st Giver" for each team. The game requires at least 2 players per team to start.

### Turn Rotation
During the game, turns strictly rotate between Team 1 and Team 2.
- The game engine pairs up players from the same team, assigning one as the **Giver** and another as the **Guesser**.
- When a team's turn ends, the roles advance automatically to the next players in the roster.
- Every new round alternates which team starts. If coming off a Winner's Circle, the team that *did not* participate gets to start the next match.

### Winner's Circle
If a team wins, they proceed to the Winner's Circle.
- The Host manually selects the Giver and Guesser from the winning team's roster.
- If the 60-second timer expires, the board stays up, and the Host can manually tap "???" tiles to reveal the missed phrases to the room.

## 6. Running End-to-End Tests

The repository includes a Puppeteer script (`test.cjs`) that tests the entire game flow automatically by spawning a host tab and two player tabs, joining the room, clicking the start game button, and playing the first round.

Ensure your development server is running on `http://localhost:5173` in a background terminal, then run:

```bash
node test.cjs
```

The script output should log milestones and end with:
```
TEST PASSED SUCCESSFULLY!
```
