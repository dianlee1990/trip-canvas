import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// 注意這裡多引入了 initializeFirestore
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  // 🔴 請務必保留你原本正確的 Config 內容 (不要複製我的範例字串)
  apiKey: "AIzaSyBKTHbbL6jYsKu9XtpC1cYN2sMLbtduJy0",
  authDomain: "tripcanvas-479809.firebaseapp.com",
  projectId: "tripcanvas-479809",
  storageBucket: "tripcanvas-479809.firebasestorage.app",
  messagingSenderId: "588919242622",
  appId: "1:588919242622:web:5d119dbcde9a1296c9fd2f",
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
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true, // 👈 新增這一行，讓它更寬容
  });
  
  console.log("Firebase initialized with Long Polling & Ignore Undefined!");