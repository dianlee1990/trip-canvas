import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
// 🟢 新增：引入 Realtime Database 用於實作「線上狀態」
import { getDatabase } from "firebase/database"; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBdz5yhEVuKpgEv7OzS4NF440ai7Ld6Bso", // 建議改用環境變數
  authDomain: "tripcanvas-v2.firebaseapp.com",
  projectId: "tripcanvas-v2",
  storageBucket: "tripcanvas-v2.firebasestorage.app",
  messagingSenderId: "276763478616",
  appId: "1:276763478616:web:9039884308b8ac0902582d",
  // 🟢 必須加入 databaseURL (請確認你的 Firebase Console 是否已啟用 Realtime Database)
  // 如果你的區域不是 us-central1，網址可能會不同，請去 Firebase Console -> Realtime Database 查看
  databaseURL: "https://tripcanvas-v2-default-rtdb.firebaseio.com" 
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

// 🟢 匯出 Realtime Database 實例
export const rtdb = getDatabase(app); 

console.log("Firebase initialized!");