// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 從 .env 檔案讀取你的鑰匙
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 1. 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 2. 匯出資料庫 (db) 和 驗證模組 (auth) 供其他頁面使用
export const db = getFirestore(app);
export const auth = getAuth(app);

// --- 👇 加入這段間諜程式碼 👇 ---
console.log("=== Firebase Config 檢查 ===");
console.log("Project ID:", firebaseConfig.projectId);
console.log("API Key:", firebaseConfig.apiKey ? "有讀取到 (長度 " + firebaseConfig.apiKey.length + ")" : "⚠️ 是 undefined (沒讀到!)");
console.log("===========================");
// ------------------------------

console.log("Firebase 連線已初始化！"); // 測試用，確認有跑這段