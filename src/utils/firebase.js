import { initializeApp } from "firebase/app";
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
  measurementId: "G-PL6300GNHL"
};

// --- 間諜程式碼 (核彈級測試) ---
console.log("=== 核彈級測試 ===");
console.log("正在連線到 Project ID:", firebaseConfig.projectId);
console.log("===================");

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);