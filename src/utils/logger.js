import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase'; // 請確認 firebase 路徑正確

/**
 * 記錄使用者行為至 Firestore
 *
 * @param {string} eventType - 事件類型
 * @param {string} tripId - 關聯的行程 ID
 * @param {string} userId - 使用者 ID
 * @param {object} details - 事件詳細資訊
 */
export const logEvent = async (eventType, tripId, userId, details = {}) => {
  try {
    const eventData = {
      eventType,
      tripId: tripId || null,
      userId: userId || 'anonymous',
      details: details || {},
      timestamp: serverTimestamp(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    // 寫入 Firebase 'analytics_events' 集合
    await addDoc(collection(db, 'analytics_events'), eventData);

    // 開發環境下 Log 出來方便除錯
    if (import.meta.env.DEV) {
      console.log(`[Analytics] ${eventType}`, eventData);
    }

  } catch (error) {
    // 埋點失敗僅記錄錯誤，不讓程式崩潰
    console.warn("Analytics logging failed:", error);
  }
};