import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase project configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBGxO7eA4twaKiglU6MxeEzf9CbyOzUKgI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nexacity5g.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nexacity5g",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nexacity5g.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "618625425485",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:618625425485:web:39fa4a87d114f05ebf3c04"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
