import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * 記錄使用者行為至 Firestore
 *
 * @param {string} eventType - 事件類型 (e.g., 'REMOVE_ITEM', 'REORDER_ITINERARY')
 * @param {string} tripId - 關聯的行程 ID (若無則傳 null)
 * @param {string} userId - 使用者 ID (若未登入則傳 'anonymous' 或 null)
 * @param {object} details - 事件詳細資訊 (e.g., { itemId: '123', oldIndex: 1, newIndex: 2 })
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
    [cite_start]// 引用來源 [cite: 3241, 3313] (參考 firebase.js 初始化與 addDoc 用法)
    await addDoc(collection(db, 'analytics_events'), eventData);

    // 開發環境下可開啟此行以確認埋點觸發
    if (import.meta.env.DEV) {
      console.log(`[Analytics] ${eventType}`, eventData);
    }

  } catch (error) {
    // 埋點失敗不應影響主程式運作，僅記錄錯誤
    console.error("Analytics logging failed:", error);
  }
};