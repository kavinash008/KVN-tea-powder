import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  User as FirebaseUser,
  onAuthStateChanged,
} from 'firebase/auth';

// Default configuration from firebase-applet-config.json
import defaultConfig from '../../firebase-applet-config.json';

const env = (import.meta as any)?.env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || defaultConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || defaultConfig.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || defaultConfig.measurementId,
};

let app: FirebaseApp;
let auth: Auth;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
} catch (err) {
  console.warn('Firebase initialization warning:', err);
}

export {
  app,
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
};

export type { ConfirmationResult, FirebaseUser };

/**
 * Check whether Firebase Authentication is configured with a valid API key.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.apiKey !== '' && firebaseConfig.projectId);
}
