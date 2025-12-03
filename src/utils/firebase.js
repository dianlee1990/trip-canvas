import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔴 請把你在 Firebase 後台「設定 (Config)」那邊複製的內容，貼蓋掉下面這個大括號
const firebaseConfig = {
  // 這裡面的內容，請用你剛才從 Firebase 網站複製的那一整段取代
  // 它的格式應該會長得像這樣 (請填入你真實的資料)：
  apiKey: "AIzaSyBKTHbbL6jYsKu9XtpC1cYN2sMLbtduJy0",
  authDomain: "tripcanvas-479809.firebaseapp.com",
  projectId: "tripcanvas-479809",
  storageBucket: "tripcanvas-479809.firebasestorage.app",
  messagingSenderId: "588919242622",
  appId: "1:588919242622:web:5d119dbcde9a1296c9fd2f",
};

// --- 間諜程式碼 ---
console.log("=== 核彈級測試 ===");
// 🛠️ 終極防呆：Try-Catch 初始化
let app;
try {
  // 嘗試直接初始化
  app = initializeApp(firebaseConfig);
  console.log("Firebase App 初始化成功！");
} catch (error) {
  // 如果報錯說「已經存在」，那我們就直接拿現有的來用
  if (error.code === 'app/duplicate-app') {
    console.log("Firebase App 已經存在，直接使用現有實例。");
    app = getApp();
  } else {
    // 其他錯誤則印出來
    console.error("Firebase 初始化發生未知錯誤:", error);
    throw error;
  }
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);