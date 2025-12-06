import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBdz5yhEVuKpgEv7OzS4NF440ai7Ld6Bso", 
  authDomain: "tripcanvas-v2.firebaseapp.com",
  projectId: "tripcanvas-v2",
  storageBucket: "tripcanvas-v2.firebasestorage.app",
  messagingSenderId: "276763478616",
  appId: "1:276763478616:web:9039884308b8ac0902582d",
  
  // 🔴 關鍵修正：請刪除原本的網址，貼上你從 Firebase Console 複製的正確 Realtime Database 網址
  // 格式範例： "https://tripcanvas-v2-default-rtdb.asia-southeast1.firebasedatabase.app"
  // 注意：最後面不要有斜線 /
  databaseURL: "https://tripcanvas-v2-default-rtdb.asia-southeast1.firebasedatabase.app" 
};

// --- 初始化邏輯 ---
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore 初始化 (解決網路卡頓問題)
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

// Realtime Database 初始化
export const rtdb = getDatabase(app); 

console.log("Firebase initialized (Auth, Firestore, RTDB)!");