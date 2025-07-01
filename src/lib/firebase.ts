import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCUSKAtGC28Q3s40fDOKDEyjyGrTG3tAuI",
  authDomain: "tip-sarasota.firebaseapp.com",
  projectId: "tip-sarasota",
  storageBucket: "tip-sarasota.firebasestorage.app",
  messagingSenderId: "760143844705",
  appId: "1:760143844705:web:7669ab86941b2260bf6120",
  measurementId: "G-HJD9966ZSC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Analytics (only in production)
export const analytics = typeof window !== 'undefined' && getAnalytics(app);

// Connect to emulators in development
if (process.env.NODE_ENV === 'development') {
  // Only connect to emulators if not already connected
  try {
    // Auth emulator
    if (!auth.config.emulator) {
      connectAuthEmulator(auth, 'http://localhost:9099');
    }
    
    // Firestore emulator
    if (!(db as any)._delegate._databaseId.database.includes('localhost')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    
    // Storage emulator
    if (!storage._location.bucket.includes('localhost')) {
      connectStorageEmulator(storage, 'localhost', 9199);
    }
  } catch (error) {
    console.log('Emulator connection failed:', error);
  }
}

export default app;