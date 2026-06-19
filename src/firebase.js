import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let db;

// Fallback for local testing if no Firebase config is provided
const isLocalMock = !firebaseConfig.apiKey;

if (!isLocalMock) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export const subscribeToRoom = (roomId, callback) => {
  if (isLocalMock) {
    // Local storage mock for testing across tabs
    const checkState = () => {
      const state = localStorage.getItem(`room_${roomId}`);
      callback(state ? JSON.parse(state) : null);
    };
    checkState();
    window.addEventListener('storage', checkState);
    const interval = setInterval(checkState, 1000);
    
    return () => {
      window.removeEventListener('storage', checkState);
      clearInterval(interval);
    };
  } else {
    const roomRef = ref(db, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      callback(data);
    });
  }
};

export const updateRoomState = async (roomId, newState) => {
  if (isLocalMock) {
    const currentState = JSON.parse(localStorage.getItem(`room_${roomId}`) || '{}');
    
    const nextState = { ...currentState };
    for (const [key, value] of Object.entries(newState)) {
      if (key.includes('/')) {
        const parts = key.split('/');
        let current = nextState;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = isNaN(parts[i+1]) ? {} : [];
          }
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
      } else {
        nextState[key] = value;
      }
    }
    
    localStorage.setItem(`room_${roomId}`, JSON.stringify(nextState));
    // Trigger storage event manually for the current tab (storage event only fires for OTHER tabs)
    window.dispatchEvent(new Event('storage'));
  } else {
    const roomRef = ref(db, `rooms/${roomId}`);
    await update(roomRef, newState);
  }
};

export const setRoomState = async (roomId, state) => {
  if (isLocalMock) {
    localStorage.setItem(`room_${roomId}`, JSON.stringify(state));
    window.dispatchEvent(new Event('storage'));
  } else {
    const roomRef = ref(db, `rooms/${roomId}`);
    await set(roomRef, state);
  }
};
