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

/**
 * Translates raw Firebase Auth SDK errors (like auth/unauthorized-domain)
 * into actionable, user-friendly guidance.
 */
export function formatFirebaseAuthError(
  err: any,
  fallbackMessage: string = 'Authentication failed'
): { message: string; isUnauthorizedDomain: boolean; code: string } {
  const code = String(err?.code || '');
  const rawMessage = String(err?.message || '');
  const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('auth/unauthorized-domain')) {
    return {
      code: 'auth/unauthorized-domain',
      isUnauthorizedDomain: true,
      message:
        `Google / Phone OTP sign-in is not enabled yet for "${host}" (Firebase domain authorization required). ` +
        `Please sign in or create an account using "Mobile + Pass" below (works immediately), or ask Kavinash to add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`,
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      code,
      isUnauthorizedDomain: false,
      message: 'Pop-up was blocked by your browser. Please allow pop-ups or use "Mobile + Pass" below.',
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      isUnauthorizedDomain: false,
      message: 'Google Sign-In window was closed before completing sign-in.',
    };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return {
      code,
      isUnauthorizedDomain: false,
      message: 'Invalid email or password. Please double-check your credentials.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      isUnauthorizedDomain: false,
      message: 'An account already exists with this email. Please switch to Sign In.',
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      isUnauthorizedDomain: false,
      message: 'This sign-in provider is not enabled yet in Firebase Authentication. Please use "Mobile + Pass" below.',
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      code,
      isUnauthorizedDomain: false,
      message: 'Too many attempts. Please wait a minute or sign in using "Mobile + Pass".',
    };
  }
  return {
    code,
    isUnauthorizedDomain: false,
    message: rawMessage || fallbackMessage,
  };
}
