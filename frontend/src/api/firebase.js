import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialise Firebase if config values are present.
// If not set, Google/phone buttons are shown as disabled with a tooltip.
let app = null;
let auth = null;

const isConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

// Sign in with Google popup → returns a Firebase ID token string
export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase is not configured. Add VITE_FIREBASE_* keys to frontend/.env");
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken();
}

// Set up invisible reCAPTCHA for phone auth (called once, on the phone step)
export function setupRecaptcha(buttonId) {
  if (!auth) throw new Error("Firebase is not configured.");
  window._recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, { size: "invisible" });
  return window._recaptchaVerifier;
}

// Send OTP to phone number (E.164 format: +254712345678)
export async function sendOtp(phoneNumber) {
  if (!auth) throw new Error("Firebase is not configured.");
  const verifier = window._recaptchaVerifier;
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
  return confirmation; // caller must call confirmation.confirm(otp) with the code
}

export { isConfigured };
