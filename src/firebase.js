import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBkMOF2BUA6EK4WYrlRxww8_zP9sfBF9cs",
  authDomain: "expense-tracker-20c32.firebaseapp.com",
  databaseURL: "https://expense-tracker-20c32-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "expense-tracker-20c32",
  storageBucket: "expense-tracker-20c32.firebasestorage.app",
  messagingSenderId: "817674894380",
  appId: "1:817674894380:web:244d132811825d182fe589",
  measurementId: "G-VSVCPCWCWG"
};

const app = initializeApp(firebaseConfig);

// Use a named Firestore database called "mtworld" (create it first in Firebase Console)
export const db = getFirestore(app, 'mtworld');

// If you prefer the default database, use: export const db = getFirestore(app);