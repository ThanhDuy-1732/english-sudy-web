import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBLCrPTRLHkbF9eyBi9x_geRb5skTcLRuQ",
  authDomain: "study-project-f9e9d.firebaseapp.com",
  projectId: "study-project-f9e9d",
  storageBucket: "study-project-f9e9d.firebasestorage.app",
  messagingSenderId: "723601123065",
  appId: "1:723601123065:web:35aff05c99ca6e09f82428",
  measurementId: "G-TE40VVSYFT",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analyticsPromise: Promise<Analytics | null> | null = null;

export function initializeFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  // Analytics is optional: offline or blocked, skip it quietly and try again when the connection returns.
  if (!navigator.onLine) {
    window.addEventListener("online", () => void initializeFirebaseAnalytics(), { once: true });
    return Promise.resolve(null);
  }

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);

  return analyticsPromise;
}
