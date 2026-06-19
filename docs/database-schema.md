# Database Schema

This document details the JSON schema of a Game Room state synchronized via Firebase Realtime Database or localized `localStorage`.

---

## Game Room Schema

A single room (stored under `/rooms/{roomId}` in Firebase, or key `room_{roomId}` in `localStorage`) is represented by the following structure:

```json
{
  "status": "lobby",
  "players": {
    "user_d73k8s9f": {
      "name": "Alice",
      "interest": "Baking",
      "team": 1,
      "role": "giver"
    }
  },
  "teams": {
    "1": { "score": 0 },
    "2": { "score": 0 }
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
  "currentTurn": {
    "team": 1,
    "role": "giver"
  },
  "activeCategoryIndex": null,
  "categoryRevealed": false,
  "activeWordIndex": 0,
  "wordStates": [false, false, false, false, false, false],
  "timer": 30,
  "timerActive": false,
  "wordsScored": 0,
  "circleBoard": [
    {
      "phrase": "Things in the Atlantic Ocean",
      "completed": false
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
- `"winners_circle"`: High-stakes Winner's Circle gameplay.
- `"winners_circle_summary"`: Displays retry options if Winner's Circle clock runs out.
- `"winners_circle_win"`: Game win celebration state.

### 2. Players (`players`)
A dictionary mapping unique client IDs (`user_{random_string}`) to user profiles.
- `name` *(string)*: Display name.
- `interest` *(string)*: User's hobby or inside joke.
- `team` *(number)*: Team assignment (1 or 2). Automatically toggles based on join sequence.
- `role` *(string)*: Role in the game (defaults to `"giver"`).

### 3. Teams (`teams`)
Main score tracker mapping `"1"` and `"2"` to team scores.
- `score` *(number)*: Increments by 1 for each correctly guessed word.

### 4. Board (`board`)
An array of exactly 6 category objects shown on the pyramid board:
- `name` *(string)*: Name of the category.
- `description` *(string)*: Hook or hint shown prior to starting.
- `words` *(array of strings)*: List of clue words (exactly 6 words are selected and shuffled from source).
- `completed` *(boolean)*: True if the category was completed/played.
- `owner` *(string|null)*: Reference to the player/team who completed it.

### 5. Clue Round State
Used to track active round logic during `"round1"`:
- `currentTurn` *(object)*: Identifies whose turn it is (`team`, `role`).
- `activeCategoryIndex` *(number|null)*: The index (0 to 5) of the currently selected category card. Null if none is selected.
- `categoryRevealed` *(boolean)*: True if the category clues are active and showing.
- `activeWordIndex` *(number)*: Index (0 to 5) of the active word in the selected category words array.
- `wordStates` *(array of booleans)*: Tracks guess progress of the active category words.
- `timer` *(number)*: Remaining seconds for the category turn (starts at 30).
- `timerActive` *(boolean)*: Starts/stops the countdown scheduler.
- `wordsScored` *(number)*: Count of correctly guessed words in the active category.

### 6. Winner's Circle State (`circleBoard`)
Used to track state during `"winners_circle"` phase:
- `circleBoard` *(array of objects)*: Array of exactly 6 target phrases.
- `activeCircleIndex` *(number)*: Index of the current active phrase (0 to 5).
- `circleTimer` *(number)*: Seconds remaining on the clock (starts at 60).
- `circleTimerActive` *(boolean)*: Controls countdown scheduler logic.
- `circleRevealed` *(boolean)*: Displays/hides current Winner's Circle category.
