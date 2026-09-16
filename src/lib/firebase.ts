import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAC0_e_yfgCxGWB6Xc_XpQh1KW_rLF2Xyg",
  authDomain: "stories-prophets.firebaseapp.com",
  projectId: "stories-prophets",
  storageBucket: "stories-prophets.firebasestorage.app",
  messagingSenderId: "591771663942",
  appId: "1:591771663942:web:2ba5e99cb82fc8ded7d447",
  measurementId: "G-PZ73596G06"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

export const initAnalytics = async () => {
  if (typeof window !== 'undefined' && (await isSupported())) {
    try {
      return getAnalytics(app);
    } catch (e) {
      console.warn('Analytics initialization failed:', e);
    }
  }
  return null;
};

export default app;
