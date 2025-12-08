import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';

/**
 * 資料清洗工具：移除 Firestore Raw Format (mapValue, fields...)
 */
const cleanFirestoreData = (data) => {
  if (!data) return null;

  // 1. 如果是陣列，遞迴處理
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }

  // 2. 如果是物件，檢查是否為 Firestore 特殊結構
  if (typeof data === 'object') {
    if ('fields' in data) return cleanFirestoreData(data.fields);
    if ('mapValue' in data) return cleanFirestoreData(data.mapValue.fields || {});
    if ('arrayValue' in data) return (data.arrayValue.values || []).map(cleanFirestoreData);
    if ('stringValue' in data) return data.stringValue;
    if ('integerValue' in data) return parseInt(data.integerValue, 10);
    if ('doubleValue' in data) return parseFloat(data.doubleValue);
    if ('booleanValue' in data) return data.booleanValue;
    if ('timestampValue' in data) return data.timestampValue;
    if ('nullValue' in data) return null;

    // 一般物件則遞迴清洗每個屬性
    const cleaned = {};
    Object.keys(data).forEach(key => {
      cleaned[key] = cleanFirestoreData(data[key]);
    });
    return cleaned;
  }

  // 3. 基本型別直接回傳
  return data;
};

/**
 * 記錄使用者行為至 Firestore
 */
export const logEvent = async (eventType, tripId, userId, details = {}) => {
  try {
    // 寫入前先清洗資料
    const cleanedDetails = cleanFirestoreData(details);

    const eventData = {
      eventType,
      tripId: tripId || null,
      userId: userId || 'anonymous',
      details: cleanedDetails || {},
      timestamp: serverTimestamp(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    await addDoc(collection(db, 'analytics_events'), eventData);

    if (import.meta.env.DEV) {
      console.log(`[Analytics] ${eventType}`, eventData);
    }
  } catch (error) {
    console.warn("Analytics logging failed:", error);
  }
};