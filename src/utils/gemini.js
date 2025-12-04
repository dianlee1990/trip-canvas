// src/utils/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// 取得 API Key
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const runGemini = async (prompt) => {
  console.log("正在呼叫 gemini-1.5-flash...", prompt);

  try {
    // 【關鍵修正】根據你的白名單，改用 gemini-2.0-flash
    // 這個模型在你的清單中明確存在
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
    });
    
    // 發送請求
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("🎉 AI 成功回傳:", text);
    return text;
  } catch (error) {
    console.error("Gemini 連線失敗:", error);
    // 錯誤處理
    if (error.response) {
       console.error("詳細錯誤:", error.response);
    }
    return "[]";
  }
};