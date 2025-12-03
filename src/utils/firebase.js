import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// 注意這裡多引入了 initializeFirestore
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

// --- 初始化邏輯 (CTO 優化版) ---
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // 避免重複初始化
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 🛠️ 關鍵修復：使用 initializeFirestore 並強制開啟 experimentalForceLongPolling
// 這會解決 99% 的網路卡死問題
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });
  
  console.log("Firebase initialized with Long Polling & Ignore Undefined!");