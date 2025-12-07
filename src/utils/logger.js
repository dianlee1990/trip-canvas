import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export const logEvent = async (eventType, tripId, userId, details = {}) => {
  // 1. 先 Log，確保函式有被呼叫
  console.log(`[Logger] 準備記錄事件: ${eventType}`, details); 

  try {
    // 2. 改用較中性的集合名稱 'trip_actions'
    const eventsRef = collection(db, 'artifacts', appId, 'trip_actions');
    
    await addDoc(eventsRef, {
      eventType,
      tripId,
      userId,
      details,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
    
    console.log(`[Logger] 資料庫寫入成功: ${eventType}`);
  } catch (error) {
    console.error("[Logger] 寫入失敗:", error);
  }
};