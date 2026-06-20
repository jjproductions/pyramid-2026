# Database Schema

This document details the JSON schema of a Game Room state synchronized via Firebase Realtime Database or localized `localStorage`.

---

## Game Room Schema

A single room (stored under `/rooms/{roomId}` in Firebase, or key `room_{roomId}` in `localStorage`) is represented by the following structure:

```json
{
  "status": "lobby",
  "settings": {
    "gameMode": "classic",
    "contentFile": "content.json",
    "aiProvider": "local",
    "localUrl": "http://localhost:11434/v1/chat/completions",
    "localModel": "mistral-small3.2:24b-instruct-2506-q4_K_M",
    "geminiModel": "gemini-1.5-flash-latest",
    "geminiApiKey": "",
    "timerDuration": 30,
    "circleTimerDuration": 60,
    "numWordsPerCategory": 6,
    "soundEnabled": true,
    "passLimit": 0
  },
  "players": {
    "user_d73k8s9f": {
      "name": "Alice",
      "interest": "Baking",
      "team": 1
    }
  },
  "teams": {
    "1": { 
      "score": 0,
      "giverIndex": 1,
      "guesserIndex": 0,
      "playerOrder": ["user_d73k8s9f", "user_x92k1p4m"]
    },
    "2": { 
      "score": 0,
      "giverIndex": 1,
      "guesserIndex": 0,
      "playerOrder": ["user_b44m9q2a", "user_c88z7y1t"]
    }
  },
  "board": [
    {
      "name": "Category Name",
      "description": "Category Description",
      "words": ["Word1", "Word2", "Word3", "Word4", "Word5", "Word6"],
      "completed": false,
      "owner": null
    }
  ],
  "nextStartingTeam": 1,
  "currentTurn": {
    "team": 1,
    "giverId": "user_x92k1p4m",
    "guesserId": "user_d73k8s9f"
  },
  "activeCategoryIndex": null,
  "categoryRevealed": false,
  "activeWordIndex": 0,
  "wordStates": [false, false, false, false, false, false],
  "timer": 30,
  "timerActive": false,
  "wordsScored": 0,
  "passesUsed": 0,
  "circleBoard": [
    {
      "phrase": "Things in the Atlantic Ocean",
      "completed": false,
      "summaryRevealed": false
    }
  ],
  "activeCircleIndex": 0,
  "circleTimer": 60,
  "circleTimerActive": false,
  "circleRevealed": false
}
```

---

## Field Specifications

### 1. Game Status (`status`)
Controls the page routing and screen layout states.
- `"lobby"`: Initial waiting area. Players register names and interests.
- `"generating"`: AI personalized mode board generation is processing.
- `"round1"`: Normal category selection and gameplay.
- `"round_summary"`: Displays points scored after a turn completes or times out.
- `"winners_circle_selecting"`: Host selects Giver/Guesser from the winning team's roster.
- `"winners_circle"`: High-stakes Winner's Circle gameplay.
- `"winners_circle_summary"`: Displays retry options if Winner's Circle clock runs out and allows revealing missed tiles.
- `"winners_circle_win"`: Game win celebration state.

### 2. Settings (`settings`)
Global configuration driven by the Host's Settings modal. Defines game modes, AI configuration, and timer limits.

### 3. Players (`players`)
A dictionary mapping unique client IDs (`user_{random_string}`) to user profiles.
- `name` *(string)*: Display name.
- `interest` *(string)*: User's hobby or inside joke.
- `team` *(number)*: Team assignment (1 or 2). Chosen by the player during the join flow.

### 4. Teams (`teams`)
Tracks scores and per-team player rotation mechanics.
- `score` *(number)*: Increments by 1 for each correctly guessed word.
- `playerOrder` *(array of strings)*: The ordered list of player IDs on this team.
- `giverIndex` *(number)*: The index in `playerOrder` of the player currently designated as the Giver.
- `guesserIndex` *(number)*: The index in `playerOrder` of the player currently designated as the Guesser.

### 5. Board (`board`)
An array of exactly 6 category objects shown on the pyramid board:
- `name` *(string)*: Name of the category.
- `description` *(string)*: Hook or hint shown prior to starting.
- `words` *(array of strings)*: List of clue words.
- `completed` *(boolean)*: True if the category was completed/played.
- `owner` *(string|null)*: Reference to the player/team who completed it.

### 6. Clue Round State
Used to track active round logic during `"round1"`:
- `nextStartingTeam` *(number)*: Keeps track of which team starts the *next* round to ensure alternating turns.
- `currentTurn` *(object)*: Identifies the active team and the specific `giverId` and `guesserId`.
- `activeCategoryIndex` *(number|null)*: The index (0 to 5) of the currently selected category card. Null if none is selected.
- `categoryRevealed` *(boolean)*: True if the category clues are active and showing.
- `activeWordIndex` *(number)*: Index (0 to 5) of the active word in the selected category words array.
- `wordStates` *(array of booleans)*: Tracks guess progress of the active category words.
- `timer` *(number)*: Remaining seconds for the category turn.
- `timerActive` *(boolean)*: Starts/stops the countdown scheduler.
- `wordsScored` *(number)*: Count of correctly guessed words in the active category.
- `passesUsed` *(number)*: Number of times the active team has passed on a word.

### 7. Winner's Circle State (`circleBoard`)
Used to track state during `"winners_circle"` phase:
- `circleBoard` *(array of objects)*: Array of exactly 6 target phrases. Includes `summaryRevealed` to track if the host has manually revealed it post-timeout.
- `activeCircleIndex` *(number)*: Index of the current active phrase (0 to 5).
- `circleTimer` *(number)*: Seconds remaining on the clock.
- `circleTimerActive` *(boolean)*: Controls countdown scheduler logic.
- `circleRevealed` *(boolean)*: Displays/hides current Winner's Circle category.
