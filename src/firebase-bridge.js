import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let app;
let db;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
} catch (e) {
    console.error("Firebase initialization failed. Make sure to paste your firebaseConfig in src/firebase-bridge.js");
    // console.error(e);
}

/**
 * Serializes the local context for handoff to Firebase Realtime Database.
 * @param {string} sessionId The ID for the session node in Firebase.
 * @param {any} sessionData The local REPL state to serialize.
 * @returns {Promise<boolean>} True if the handoff was successful.
 */
export async function handoffToFirebase(sessionId, sessionData) {
    if (!db) {
        console.error('Firebase Database is not initialized. Cannot perform handoff.');
        return false;
    }
    try {
        const sessionRef = ref(db, `sessions/${sessionId}`);
        await set(sessionRef, {
            ...sessionData,
            timestamp: Date.now(),
            status: 'active'
        });
        return true;
    } catch (e) {
        console.error('Firebase Handoff Failed:', e.message);
        return false;
    }
}
