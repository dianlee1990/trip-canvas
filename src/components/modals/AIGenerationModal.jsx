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

// 🟢 新增：心情選項
const TRIP_MOODS = [
  { id: 'excited', label: '刺激冒險', emoji: '🎢' },
  { id: 'fresh', label: '新鮮探索', emoji: '✨' },
  { id: 'healing', label: '療傷放鬆', emoji: '🌿' },
  { id: 'positive', label: '正能量', emoji: '💪' },
  { id: 'chill', label: '慵懶隨性', emoji: '🛌' },
  { id: 'romantic', label: '浪漫氛圍', emoji: '🌹' },
];

const LOADING_MESSAGES = [
  "正在掃描當地熱門打卡點...",
  "正在計算最佳美食路線...",
  "正在分析您目前的行程空檔...",
  "AI 正在搜尋必吃招牌菜...",
  "正在為您尋找順路的隱藏版景點...",
  "正在確認營業時間...",
  "正在打包虛擬行李...",
  "正在挖掘商圈內的熱門好店..."
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
  const [selectedMood, setSelectedMood] = useState('fresh'); // 🟢 預設心情
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
      const moodLabel = TRIP_MOODS.find(m => m.id === selectedMood)?.label || "愉快"; // 🟢 心情標籤
      const daysToPlan = selectedDays.join('、');
      const favoriteNames = userFavorites.length > 0 ? userFavorites.map(f => f.name).join('、') : "無";

      // 🟢 關鍵修正：只傳送「source !== 'ai'」的項目給 AI 當參考
      // 這樣 AI 就不會看到舊的 AI 行程，只會看到用戶手動加的
      const manualItems = existingItinerary.filter(i => i.source !== 'ai');
      const allExistingNames = existingItinerary.map(item => item.name).join(', ');

      const flightOut = currentTrip?.flightOut || {};
      const flightIn = currentTrip?.flightIn || {};

      let hotelPrompt = "";

      tripDays.forEach((d) => {
        if (!selectedDays.includes(d.day)) return;

        const isFirstDay = d.day === 1;
        const isLastDay = d.day === tripDays.length;
        const tonightHotel = dailyHotels[d.day] || defaultHotel || "市中心";
        const lastNightHotel = dailyHotels[d.day - 1] || defaultHotel || "市中心";

        let startPoint = isFirstDay
          ? (flightOut.airport ? `${flightOut.airport} 機場 (抵達 ${flightOut.time || '未定'})` : tonightHotel)
          : lastNightHotel;

        let endPoint = isLastDay && flightIn.airport
          ? `${flightIn.airport} 機場 (起飛 ${flightIn.time || '未定'})`
          : tonightHotel;

        let timeConstraint = "";
        if (isLastDay && flightIn.time) {
          timeConstraint = `(需在 ${flightIn.time} 前 2.5 小時抵達機場)`;
        } else if (isFirstDay && flightOut.time) {
          timeConstraint = `(行程開始於 ${flightOut.time} 後)`;
        }

        const currentDayManualItems = manualItems
          .filter(i => Number(i.day) === d.day)
          .sort((a, b) => {
            const timeA = a.startTime ? parseInt(a.startTime.replace(':', '')) : 0;
            const timeB = b.startTime ? parseInt(b.startTime.replace(':', '')) : 0;
            return timeA - timeB;
          });

        let existingContext = "";
        let existingItemsList = "無";

        if (currentDayManualItems.length > 0) {
          existingItemsList = currentDayManualItems.map(i => `[${i.startTime || '時間未定'}] ${i.name} (${i.type === 'food' ? '餐飲' : '景點'})`).join(' -> ');
          existingContext = `
            ★ 【重要：該日既有固定行程 (用戶手動加入)】
            目前該日使用者已手動安排：${existingItemsList}。
            
            請遵守以下「填空排程」規則：
            1. **保留固定點**：請將上述地點保留在行程中，不可移除。
            2. **填補空檔**：請分析上述行程的時間點，找出「空檔」並插入適合的新景點或餐廳。
            3. **順路安排**：新插入的點必須與固定點地理位置順路。
          `;
        }

        hotelPrompt += `- Day ${d.day} : 起點 [${startPoint}] -> 終點 [${endPoint}] ${timeConstraint}${existingContext}\n`;
      });

      const prompt = `
        你是一位旅遊規劃大師。請針對「${destination}」規劃第 [${daysToPlan}] 天行程。

        【本次旅行目的：${purposeLabel} (Critical)】
        請務必根據此目的調整景點選擇與節奏：
        - 若為「浪漫蜜月」：請多安排氣氛佳的餐廳、夜景、放鬆行程。
        - 若為「新婚/親子」：請安排適合推車、有育嬰室、小孩感興趣的樂園或公園，避免太累的爬山。
        - 若為「退休漫遊」：請安排少走路、有電梯、步調緩慢的景點，多安排休息時間。
        - 若為「朋友出遊」：可以安排熱鬧、適合拍照打卡、逛街或夜生活的行程。
        - 若為「獨自探索」：可以安排深度文化、咖啡廳發呆或特色小店。

        【本次旅行心情：${moodLabel} (New)】
        請根據此心情選擇景點氛圍：
        - 刺激冒險：遊樂園、戶外活動、新奇體驗。
        - 新鮮探索：非觀光客主流景點、在地人才知道的店。
        - 療傷放鬆：大自然、溫泉、安靜的咖啡廳、海邊。
        - 正能量：陽光充足的地方、有活力的市集、神社祈福。
        - 慵懶隨性：睡到飽、不用排隊的點、野餐。
        - 浪漫氛圍：夜景、燈飾、高級餐廳。

        【區域規劃策略 (Critical - 防止繞圈圈)】
        為了讓行程更順暢且豐富，請嚴格遵守以下「區域集中」與「每日差異化」原則：
        1. **每日一區 (One Zone Per Day)**：
           - 每一天的行程必須 **集中在同一個主要區域或商圈**。
           - 例如 Day 1 專攻「區域A」，Day 2 專攻「區域B」。
           - **嚴禁** 為了填滿時間而在不同大區域間反覆穿梭。
        
        2. **區域不重疊 (Distinct Zones)**：
           - 不同天數的行程，應盡量選擇 **完全不同** 的地理區域。

        3. **城鄉搭配 (Mix Urban & Nature)**：
           - 若規劃天數超過 3 天，請至少安排 1 天前往 **稍微遠離市中心** 的近郊景點。

        【最高優先級：住宿串聯與順路邏輯】
        請務必根據以下每日的「起點」與「終點」來安排中間的景點，確保行程順暢，不要折返跑：
        ${hotelPrompt}

        【移動日特別指令：A點到B點的沿途旅遊 (Critical)】
        若當日的「起點」與「終點」不同（例如從 A城市 移動到 B城市）：
        1. 該日行程 **必須** 呈現為「A點 -> 沿途景點 -> B點」的線性路徑。
        2. 請根據地理位置，安排 **起點與終點之間** 的順路景點。

        【強制規則：起訖點必列入】
        請務必將每日的「起點」與「終點」明確列入行程中，生成對應的 JSON 物件。

        【三餐保障規則 (Critical)】
        AI 必須檢查每日行程是否包含早、中、晚三餐。
        1. **檢查現有行程**：若「既有行程」中已包含餐廳、夜市或標記為 'food' 的地點，則視為該餐已解決。
        2. **補充缺漏**：若發現某餐有空檔且未安排，**必須** 插入一個推薦餐廳或特色小吃。

        【最高優先級：營業時間與時段邏輯】
        請嚴格遵守各類型景點的營業時間，並反映在 "startTime" 欄位中。

        【使用者偏好】
        - 風格：${stylesLabels}
        - 必遊/收藏(優先安排)：${favoriteNames}
        - 備註：${userNote || "無"}
        - 全域避雷(已排過)：${allExistingNames}

        【aiSummary 欄位撰寫規則】：請用繁體中文，控制在 30 字以內，不要有前言後語。

        【格式規範】
        回傳純 JSON 陣列。
        [
          {
            "day": number,
            "name": string,
            "type": "spot"|"food"|"hotel"|"transport",
            "aiSummary": string,
            "tags": string[],
            "startTime": string (HH:MM),
            "suggestedTimeSlot": "morning"|"afternoon"|"evening",
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

      onGenerate(generatedData, selectedDays);

    } catch (error) {
      console.error("AI Error:", error);
      let friendlyError = "AI 連線或解析失敗，請再試一次。";
      if (error.message.includes("429") || error.message.includes("Resource exhausted")) {
        friendlyError = "⚠️ AI 目前流量雍塞 (429)，請休息 1 分鐘後再試。";
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
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Heart size={16} /> 旅行目的 (AI 將為此優化)</label>
                <div className="flex flex-wrap gap-2">
                  {TRIP_PURPOSES.map(purpose => (
                    <button key={purpose.id} onClick={() => setSelectedPurpose(purpose.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${selectedPurpose === purpose.id ?
                      'bg-pink-100 border-pink-300 text-pink-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                      <span>{purpose.emoji}</span> {purpose.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 🟢 新增：旅行心情 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Smile size={16} /> 旅行心情 (想體驗什麼氛圍)</label>
                <div className="flex flex-wrap gap-2">
                  {TRIP_MOODS.map(mood => (
                    <button key={mood.id} onClick={() => setSelectedMood(mood.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${selectedMood === mood.id ?
                      'bg-yellow-100 border-yellow-300 text-yellow-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                      <span>{mood.emoji}</span> {mood.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 旅行風格 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Tag size={16} /> 旅行風格</label>
                <div className="flex flex-wrap gap-2">
                  {TRAVEL_STYLES.map(style => (
                    <button key={style.id} onClick={() => toggleStyle(style.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${selectedStyles.includes(style.id) ?
                      'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                      <span>{style.emoji}</span> {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ... (其餘部分保持不變) ... */}
              {/* 選擇天數 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Calendar size={16} /> 選擇要重排的天數</label>
                <div className="text-xs text-gray-500 mb-2">⚠️ 注意：選擇的天數將會<b>清除舊的 AI 行程</b>並重新安排，您手動加入的行程會被保留。</div>
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

              {/* 每日住宿設定 */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Hotel size={16} /> 每日住宿</label>
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-1">主要住宿 (輸入後將自動填入所有天數)</div>
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
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2"><FileText size={16} /> 特別備註</label>
                <textarea className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50" rows={2} placeholder="例如：有帶長輩、想吃海鮮..." value={userNote} onChange={(e) => setUserNote(e.target.value)} />
              </div>

              {errorMsg && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2"><AlertCircle size={16} /> {errorMsg}</div>}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-8 text-center">
              {/* Animation */}
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
                <p className="text-gray-400 text-xs">正在為您的 {currentTrip?.destination} 之旅打造最佳行程</p>
              </div>
              <div className="w-64 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 w-full animate-progress origin-left"></div>
              </div>
            </div>
          )}
        </div>

        {step === 'preferences' && (
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl">取消</button>
            <button onClick={handleGenerateClick} className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg flex items-center gap-2"><Sparkles size={18} /> 開始生成</button>
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