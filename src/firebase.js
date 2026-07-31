import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC76PuMz82dyUsaoNNq3ZDofe5zZJ3cqkk",
  authDomain: "mtworldrollcall.firebaseapp.com",
  projectId: "mtworldrollcall",
  storageBucket: "mtworldrollcall.firebasestorage.app",
  messagingSenderId: "764065953855",
  appId: "1:764065953855:web:c12d5d8218901f4f39608a",
  measurementId: "G-BPBLX9X1K5"
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export default app;