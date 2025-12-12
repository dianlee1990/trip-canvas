import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Sparkles, Tag,
  FileText, Calendar, AlertCircle,
  Plane, Camera, Coffee, Map, Sun, Music, Car,
  ShoppingBag, Utensils, Hotel, Users, Heart, Baby, Armchair, Smile
} from 'lucide-react';
import { runGemini } from '../../utils/gemini';
import { Autocomplete } from '@react-google-maps/api';

const TRAVEL_STYLES = [
  { id: 'shopping', label: '逛街購物', emoji: '🛍️' },
  { id: 'spot', label: '熱門踩點', emoji: '📸' },
  { id: 'relax', label: '慢活漫遊', emoji: '☕' },
  { id: 'food', label: '美食探索', emoji: '🍜' },
  { id: 'nature', label: '自然風景', emoji: '🌲' },
  { id: 'culture', label: '人文歷史', emoji: '⛩️' },
  { id: 'drive', label: '自駕兜風', emoji: '🚗' },
];

const TRIP_PURPOSES = [
  { id: 'couple', label: '浪漫蜜月', emoji: '💍' },
  { id: 'family', label: '新婚/親子', emoji: '👨‍👩‍👧‍👦' },
  { id: 'friends', label: '朋友出遊', emoji: '🍻' },
  { id: 'retired', label: '退休漫遊', emoji: '🧓' },
  { id: 'solo', label: '獨自探索', emoji: '🎒' },
];

const TRIP_MOODS = [
  { id: 'excited', label: '刺激冒險', emoji: '🎢' },
  { id: 'fresh', label: '新鮮探索', emoji: '✨' },
  { id: 'healing', label: '療傷放鬆', emoji: '🌿' },
  { id: 'positive', label: '正能量', emoji: '💪' },
  { id: 'chill', label: '慵懶隨性', emoji: '🛌' },
  { id: 'romantic', label: '浪漫氛圍', emoji: '🌹' },
];

const LOADING_MESSAGES = [
  "正在分析您目前的行程空檔...",
  "正在優先檢索您的收藏清單...",
  "正在計算最佳路線順序...",
  "正在避開您已安排的行程...",
  "AI 正在進行地理位置分群...",
  "正在確認景點營業時間...",
  "正在為您縫合行程空隙..."
];

const LOADING_ICONS = [Plane, Map, Camera, Utensils, ShoppingBag, Coffee, Car, Sun, Music];

export default function AIGenerationModal({
  isOpen,
  onClose,
  onGenerate,
  userFavorites = [],
  isGenerating,
  setIsGenerating,
  setAiStatus,
  currentTrip,
  existingItinerary = []
}) {
  const [step, setStep] = useState('preferences');
  const [selectedStyles, setSelectedStyles] = useState(['spot', 'food']);
  const [selectedPurpose, setSelectedPurpose] = useState('couple');
  const [selectedMoods, setSelectedMoods] = useState(['fresh']);
  const [userNote, setUserNote] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const [dailyHotels, setDailyHotels] = useState({});
  const [defaultHotel, setDefaultHotel] = useState('');

  const autocompleteRefs = useRef({});

  const [msgIndex, setMsgIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);

  useEffect(() => {
    if (isGenerating) {
      const msgTimer = setInterval(() => {
        setMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
      const iconTimer = setInterval(() => {
        setIconIndex(prev => (prev + 1) % LOADING_ICONS.length);
      }, 1800);
      return () => {
        clearInterval(msgTimer);
        clearInterval(iconTimer);
      };
    }
  }, [isGenerating]);

  const tripDays = useMemo(() => {
    if (!currentTrip?.startDate || !currentTrip?.endDate) return [];
    const start = new Date(currentTrip.startDate);
    const end = new Date(currentTrip.endDate);
    const days = [];
    let current = new Date(start);
    let dayCount = 1;
    while (current <= end) {
      days.push({ day: dayCount, date: current.toISOString().split('T')[0] });
      current.setDate(current.getDate() + 1);
      dayCount++;
    }
    return days;
  }, [currentTrip]);

  useEffect(() => {
    if (isOpen && tripDays.length > 0) {
      setSelectedDays(tripDays.map(d => d.day));
      setStep('preferences');
      setErrorMsg('');
      setDailyHotels(prev => {
        const newHotels = { ...prev };
        tripDays.forEach(d => {
          if (!newHotels[d.day]) newHotels[d.day] = "";
        });
        return newHotels;
      });
    }
  }, [isOpen, tripDays]);

  if (!isOpen) return null;

  const toggleStyle = (id) => setSelectedStyles(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleMood = (id) => setSelectedMoods(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleDay = (dayNum) => setSelectedDays(prev => prev.includes(dayNum) ? prev.filter(d => d !== dayNum) : [...prev, dayNum]);

  const handleDefaultHotelChange = (val) => {
    setDefaultHotel(val);
    setDailyHotels(prev => {
      const next = { ...prev };
      tripDays.forEach(d => { next[d.day] = val; });
      return next;
    });
  };

  const handleDailyHotelChange = (day, val) => {
    setDailyHotels(prev => ({ ...prev, [day]: val }));
  };

  const onDefaultPlaceChanged = () => {
    if (autocompleteRefs.current['default']) {
      const place = autocompleteRefs.current['default'].getPlace();
      if (place && place.name) {
        handleDefaultHotelChange(place.name);
      }
    }
  };

  const onDailyPlaceChanged = (day) => {
    if (autocompleteRefs.current[day]) {
      const place = autocompleteRefs.current[day].getPlace();
      if (place && place.name) {
        handleDailyHotelChange(day, place.name);
      }
    }
  };

  const handleGenerateClick = async () => {
    if (selectedDays.length === 0) {
      setErrorMsg("請至少選擇一天");
      return;
    }

    setStep('generating');
    setIsGenerating(true);
    setAiStatus("正在啟動...");

    try {
      const destination = currentTrip?.destination || "旅遊目的地";
      const stylesLabels = TRAVEL_STYLES.filter(s => selectedStyles.includes(s.id)).map(s => s.label).join('、');
      const purposeLabel = TRIP_PURPOSES.find(p => p.id === selectedPurpose)?.label || "一般旅遊";
      const moodsLabels = TRIP_MOODS.filter(m => selectedMoods.includes(m.id)).map(m => m.label).join('、');
      const daysToPlan = selectedDays.join('、');

      const existingIds = new Set(existingItinerary.map(i => {
        return i.place_id ? String(i.place_id).replace(/^(ai-|place-|sidebar-)/, '') : '';
      }));
      const existingNames = new Set(existingItinerary.map(i => i.name));

      const availableFavorites = userFavorites.filter(fav => {
        const rawId = fav.place_id || fav.id;
        const cleanId = rawId ? String(rawId).replace(/^(ai-|place-|sidebar-)/, '') : '';
        const isIdExist = cleanId && existingIds.has(cleanId);
        const isNameExist = existingNames.has(fav.name);
        return !isIdExist && !isNameExist;
      });

      const favoritesContext = availableFavorites.length > 0
        ? availableFavorites.map(f => {
          const lat = f.lat || f.pos?.lat;
          const lng = f.lng || f.pos?.lng;
          return `- ${f.name} ${lat && lng ? `(座標: ${lat}, ${lng})` : ''}`;
        }).join('\n')
        : "無 (請完全依賴 AI 推薦)";

      const manualItems = existingItinerary.filter(i => i.source !== 'ai' && i.source !== undefined);
      const manualItemNames = manualItems.map(i => i.name).join('、');

      const flightOut = currentTrip?.flightOut || {};
      const flightIn = currentTrip?.flightIn || {};

      let hotelPrompt = "";

      tripDays.forEach((d) => {
        if (!selectedDays.includes(d.day)) return;

        const isFirstDay = d.day === 1;
        const isLastDay = d.day === tripDays.length;
        const tonightHotel = dailyHotels[d.day] || defaultHotel || "市中心";
        const lastNightHotel = dailyHotels[d.day - 1] || defaultHotel || "市中心";

        // 🟢 修正邏輯：明確定義起點與終點的描述字串
        let startPoint = isFirstDay
          ? (flightOut.airport ? `${flightOut.airport} 機場 (抵達 ${flightOut.time || '未定'})` : tonightHotel)
          : lastNightHotel;

        let endPoint = isLastDay && flightIn.airport
          ? `${flightIn.airport} 機場 (起飛 ${flightIn.time || '未定'})`
          : tonightHotel;

        const currentDayManualItems = manualItems
          .filter(i => Number(i.day) === d.day)
          .sort((a, b) => {
            const timeA = a.startTime ? parseInt(a.startTime.replace(':', '')) : 0;
            const timeB = b.startTime ? parseInt(b.startTime.replace(':', '')) : 0;
            return timeA - timeB;
          });

        let existingScheduleText = "目前無手動固定行程";
        if (currentDayManualItems.length > 0) {
          existingScheduleText = currentDayManualItems.map(i => {
             const duration = i.suggestedDuration || i.duration || 60;
             const time = i.startTime || "時間未定(請視為全天佔用)";
             return `   - [已鎖定] ${time} : ${i.name} (停留約 ${duration} 分鐘)`;
          }).join('\n');
        }

        hotelPrompt += `
        【Day ${d.day} 行程現況】
        - **起點**：${startPoint}
        - **終點**：${endPoint}
        - **該日既有手動行程 (絕對不可刪除，不可重疊，不可重複推薦)**：
        ${existingScheduleText}
        - 請找出上述時間表中的「空檔」，並插入合適的行程。
        \n`;
      });

      // 🟢 修正：在 Prompt 中加入「住宿與起訖點強制規則」
      const prompt = `
        你是一位旅遊規劃大師。請針對「${destination}」規劃第 [${daysToPlan}] 天行程。

        【關鍵指令：填補空檔與時間排序 (Fix Bug 2 & 3)】
        目前使用者已經安排了一些「固定行程」(列在下方)。
        你的任務是：
        1. **分析時間軸**：找出固定行程之間的「空檔時間」。
        2. **插入新行程**：在空檔中填入收藏清單的點或新推薦點。
        3. **絕對禁止**：
           - 不要把所有新行程都塞在最後面。
           - 不要讓新行程的時間與固定行程重疊。
           - 如果空檔不夠，就不要硬塞。
           - **絕對不要** 推薦 "既有手動行程" 列表中已存在的地點。
        4. **時間格式**：請務必為每個推薦點生成合理的 "startTime" (例如 "10:30")，確保整天行程順序合理。
        
        【重要：起訖點與住宿規則 (Fix Bug 4)】
        - 每日行程 **必須** 考慮該日的「起點」與「終點」位置。
        - **第一站**建議安排在該日「起點」(如住宿點) 附近的景點或早餐。
        - **最後一站**建議安排在該日「終點」(如住宿點) 附近，或預留交通時間返回。
        - 若起點或終點是機場，請務必計算前往或離開機場的交通時間。

        【最高指導原則：收藏清單優先 (Priority 1)】
        使用者有一份「待訪收藏清單」，請務必 **優先** 將這些地點排入行程。
        待訪清單：
        ${favoritesContext}

        【排程核心策略】
        1. **地理分群**：請將距離相近的地點排在一起，避免折返跑。
        2. **合理密度**：每個景點停留約 1-2 小時，餐廳約 1.5 小時，請預留交通時間。

        【每日詳細資訊與既有行程 (AI 需填空)】
        ${hotelPrompt}

        【絕對避雷名單 (用戶手動加入，禁止重複)】
        ${manualItemNames}

        【本次旅行設定】
        - 目的：${purposeLabel}
        - 心情：${moodsLabels}
        - 風格：${stylesLabels}
        - 備註：${userNote || "無"}

        【輸出格式】
        回傳純 JSON 陣列。
        [
          {
            "day": number,
            "name": "地點名稱",
            "type": "spot"|"food"|"shopping",
            "aiSummary": "推薦理由(30字內)",
            "tags": ["標籤"],
            "startTime": "HH:MM" (請務必填寫，依據既有行程的空檔計算),
            "duration": number (停留分鐘數),
            "pos": { "lat": number, "lng": number }
          }
        ]
      `;

      const rawResponse = await runGemini(prompt);
      const startIndex = rawResponse.indexOf('[');
      const endIndex = rawResponse.lastIndexOf(']');
      if (startIndex === -1 || endIndex === -1) throw new Error("JSON Error");
      const jsonText = rawResponse.substring(startIndex, endIndex + 1);
      const generatedData = JSON.parse(jsonText);

      onGenerate(generatedData, selectedDays, {
        purpose: selectedPurpose,
        moods: selectedMoods,
        styles: selectedStyles
      });

    } catch (error) {
      console.error("AI Error:", error);
      let friendlyError = "AI 連線或解析失敗，請再試一次。";
      if (error.message.includes("429")) {
        friendlyError = "⚠️ AI 目前流量雍塞，請稍後再試。";
      }
      setAiStatus("發生錯誤");
      setTimeout(() => { setIsGenerating(false); setStep('preferences'); setErrorMsg(friendlyError); }, 2000);
    }
  };

  const CurrentIcon = LOADING_ICONS[iconIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Sparkles size={20} className="text-purple-600" /> {step === 'preferences' ?
            'AI 行程客製化' : 'AI 正在工作中'}</h3>
          {!isGenerating && <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>}
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {step === 'preferences' ? (
            <div className="space-y-6">
              {/* 旅行目的 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Heart size={16} /> 旅行目的 (AI 將為此優化) </label>
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                  {TRIP_PURPOSES.map(purpose => (
                    <button key={purpose.id} onClick={() => setSelectedPurpose(purpose.id)} className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${selectedPurpose === purpose.id ?
                      'bg-pink-100 border-pink-300 text-pink-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                      <span className="text-lg sm:text-base">{purpose.emoji}</span>
                      <span className="text-xs sm:text-sm">{purpose.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 旅行心情 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Smile size={16} /> 旅行心情 (可複選) </label>
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                  {TRIP_MOODS.map(mood => (
                    <button key={mood.id} onClick={() => toggleMood(mood.id)} className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${selectedMoods.includes(mood.id) ?
                      'bg-yellow-100 border-yellow-300 text-yellow-700 ring-2 ring-yellow-200' : 'bg-white border-gray-200 text-gray-600'}`}>
                      <span className="text-lg sm:text-base">{mood.emoji}</span>
                      <span className="text-xs sm:text-sm">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 旅行風格 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Tag size={16} /> 旅行風格 (可複選) </label>
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                  {TRAVEL_STYLES.map(style => (
                    <button key={style.id} onClick={() => toggleStyle(style.id)} className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${selectedStyles.includes(style.id) ?
                      'bg-purple-100 border-purple-300 text-purple-700 ring-2 ring-purple-200' : 'bg-white border-gray-200 text-gray-600'}`}>
                      <span className="text-lg sm:text-base">{style.emoji}</span>
                      <span className="text-xs sm:text-sm">{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 選擇天數 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Calendar size={16} /> 選擇要重排的天數 </label>
                <div className="text-xs text-gray-500 mb-2">⚠️ 注意：選擇的天數將會<b> 清除舊的 AI 行程 </b> 並重新安排，您手動加入的行程會被保留。 </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {tripDays.map((d) => (
                    <div key={d.day} onClick={() => toggleDay(d.day)} className={`cursor-pointer rounded-lg border p-2 flex flex-col items-center justify-center transition-all ${selectedDays.includes(d.day) ?
                      'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-500'}`}>
                      <span className="text-xs opacity-80">{d.date.slice(5)}</span>
                      <span className="font-bold text-sm">D{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 每日住宿 */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Hotel size={16} /> 每日住宿 </label>
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-1"> 主要住宿 (輸入後將自動填入所有天數) </div>
                  <Autocomplete onLoad={(ref) => autocompleteRefs.current['default'] = ref} onPlaceChanged={onDefaultPlaceChanged}>
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" placeholder="搜尋飯店..." value={defaultHotel} onChange={(e) => handleDefaultHotelChange(e.target.value)} />
                  </Autocomplete>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                  {tripDays.filter(d => selectedDays.includes(d.day)).map((d) => (
                    <div key={d.day} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-12 text-gray-600">Day {d.day}</span>
                      <div className="flex-1">
                        <Autocomplete onLoad={(ref) => autocompleteRefs.current[d.day] = ref} onPlaceChanged={() => onDailyPlaceChanged(d.day)}>
                          <input type="text" className="w-full border border-gray-200 rounded p-2 text-xs focus:ring-1 focus:ring-purple-500 outline-none" value={dailyHotels[d.day] ||
                            ''} placeholder={`Day ${d.day} 住宿地點`} onChange={(e) => handleDailyHotelChange(d.day, e.target.value)} />
                        </Autocomplete>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 特別備註 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2"><FileText size={16} /> 特別備註 </label>
                <textarea className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50" rows={2} placeholder="例如：有帶長輩、想吃海鮮..." value={userNote} onChange={(e) => setUserNote(e.target.value)} />
              </div>

              {errorMsg && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2"><AlertCircle size={16} /> {errorMsg}</div>}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-8 text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-200 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-40 delay-150"></div>
                <div className="w-24 h-24 bg-gradient-to-tr from-purple-50 to-white rounded-full flex items-center justify-center relative z-10 shadow-lg border-2 border-purple-100">
                  <div key={iconIndex} className="icon-drawing-container text-purple-600">
                    <CurrentIcon size={48} strokeWidth={1.5} />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 text-yellow-400 animate-bounce" size={24} />
                </div>
              </div>
              <div className="space-y-3 max-w-xs mx-auto">
                <h4 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2">
                  AI 正在施展魔法
                  <span className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-0"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-300"></span>
                  </span>
                </h4>
                <p className="text-purple-600 text-sm font-medium h-6 animate-in slide-in-from-bottom-2 fade-in duration-500 key={msgIndex}">
                  {LOADING_MESSAGES[msgIndex]}
                </p>
                <p className="text-gray-400 text-xs"> 正在為您的 {currentTrip?.destination} 之旅打造最佳行程 </p>
              </div>
              <div className="w-64 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 w-full animate-progress origin-left"></div>
              </div>
            </div>
          )}
        </div>

        {step === 'preferences' && (
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl"> 取消 </button>
            <button onClick={handleGenerateClick} className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg flex items-center gap-2"><Sparkles size={18} /> 開始生成 </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes progress { 0% { transform: translateX(-100%); } 50% { transform: translateX(0%); } 100% { transform: translateX(100%); } }
        .animate-progress { animation: progress 2s infinite linear; }
        @keyframes draw-lines { 0% { stroke-dasharray: 100; stroke-dashoffset: 100; opacity: 0; } 10% { opacity: 1;
        } 100% { stroke-dasharray: 100; stroke-dashoffset: 0; opacity: 1; } }
        .icon-drawing-container svg path, .icon-drawing-container svg circle, .icon-drawing-container svg line, .icon-drawing-container svg polyline, .icon-drawing-container svg rect { stroke-dasharray: 100; stroke-dashoffset: 100;
        animation: draw-lines 1.5s ease-out forwards; }
      `}</style>
    </div>
  );
}