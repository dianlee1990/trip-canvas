import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// 注意這裡多引入了 initializeFirestore
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBdz5yhEVuKpgEv7OzS4NF440ai7Ld6Bso",
    authDomain: "tripcanvas-v2.firebaseapp.com",
    projectId: "tripcanvas-v2",
    storageBucket: "tripcanvas-v2.firebasestorage.app",
    messagingSenderId: "276763478616",
    appId: "1:276763478616:web:9039884308b8ac0902582d"
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