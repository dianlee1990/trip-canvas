import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Map, Search, Sparkles, Heart, Plus, Loader2, DollarSign, Clock, Navigation, AlertTriangle,
  ChevronLeft, Camera, ShoppingBag, Bed, Activity, Utensils,
  Beer, Mountain, X, Car, Coffee, CheckCircle2
} from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { IconByType } from '../icons/IconByType';
import { runGemini } from '../utils/gemini';

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/64x64?text=No+Image";

const CATEGORY_FILTERS = [
  { id: 'all', label: '綜合', icon: Sparkles },
  { id: 'spot', label: '景點', icon: Camera },
  { id: 'food', label: '美食', icon: Utensils },
  { id: 'shopping', label: '購物', icon: ShoppingBag },
  { id: 'coffee', label: '咖啡', icon: Coffee },
  { id: 'massage', label: '按摩', icon: Activity },
  { id: 'hotel', label: '住宿', icon: Bed },
  { id: 'bar', label: '酒吧', icon: Beer },
  { id: 'rent', label: '租車', icon: Car },
  { id: 'nature', label: '自然', icon: Mountain },
];

// 🟢 排卡元件：介面大整形
const DraggableSidebarItem = ({ item, isFavoriteView, isFav, toggleFavorite, handleAddToItinerary, onPlaceSelect, isMobile, isInItinerary }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${item.id}`,
    data: { type: 'sidebar-item', item: item },
    disabled: isMobile
  });

  const [imageSrc, setImageSrc] = useState(item.image);

  useEffect(() => { setImageSrc(item.image); }, [item.image]);

  const handleCardClick = () => {
    const lat = item.pos?.lat || item.lat;
    const lng = item.pos?.lng || item.lng;
    if (onPlaceSelect && lat && lng) {
      onPlaceSelect({ ...item, lat, lng });
    }
  };

  const handleNativeDragStart = (e) => {
    const itemData = JSON.stringify(item);
    e.dataTransfer.setData("text/plain", itemData);
    e.dataTransfer.setData("application/json", itemData);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.dropEffect = "copy";
    window.__draggedSidebarItem = itemData;
  };

  // 判斷是否有 AI 資料可顯示
  const hasAiInfo = item.aiHighlights || item.aiCost || item.aiHours || item.aiSummary;

  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      draggable="true"
      onDragStart={handleNativeDragStart}
      className={`group flex gap-3 p-3 rounded-xl transition-all bg-white relative shadow-sm cursor-grab active:cursor-grabbing border
      ${isDragging ? 'opacity-50 ring-2 ring-teal-400' : ''}
      ${isFavoriteView ? (isFav ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100') : 'border-gray-100 hover:border-teal-300 hover:shadow-md'}
      `}
      onClick={handleCardClick}
      style={{ touchAction: isMobile ? 'auto' : 'none' }}
    >
      <img src={imageSrc} onError={() => setImageSrc(PLACEHOLDER_IMAGE_URL)} className="w-20 h-20 rounded-lg object-cover bg-gray-100 border border-gray-100 shrink-0" alt={item.name} />
      
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header: Title & Status */}
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-sm text-gray-800 truncate flex items-center gap-1.5 flex-1 pr-2">
            <IconByType type={item.type} size={15} className="text-gray-500 shrink-0" /> 
            <span className="truncate">{item.name}</span>
          </h4>
          {isInItinerary && (
              <span className="ml-auto text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-teal-100 shrink-0 font-medium">
                 <CheckCircle2 size={10} /> 已排入
              </span>
          )}
        </div>

        {/* Rating Row */}
        <div className="flex items-center gap-2 mt-1 mb-1.5">
            <span className="text-xs text-orange-500 font-bold flex items-center bg-orange-50 px-1.5 py-0.5 rounded">
              ★ {item.rating || 4.0}
            </span>
            {/* 原本的花費與時間已移除，改放入下方紫色區塊 */}
        </div>

        {/* 🟢 AI 智慧摘要區塊 (整合 亮點 / 花費 / 時間) */}
        {hasAiInfo ? (
          <div className="mt-auto bg-purple-50 border border-purple-100 rounded-lg p-2 text-[11px] leading-relaxed flex flex-col gap-1.5 animate-in fade-in">
            {/* 亮點 */}
            <div className="flex items-start gap-1.5 text-purple-900 font-medium">
              <Sparkles size={12} className="shrink-0 mt-0.5 fill-purple-300 text-purple-600" />
              <span className="line-clamp-2">{item.aiHighlights || item.aiSummary}</span>
            </div>
            
            {/* 資訊列：花費 & 時間 */}
            {(item.aiCost || item.aiHours) && (
              <div className="flex items-center gap-3 text-purple-700/80 border-t border-purple-200/50 pt-1.5 mt-0.5">
                {item.aiCost && (
                  <span className="flex items-center gap-1 truncate" title="預估花費">
                    <DollarSign size={10} /> {item.aiCost}
                  </span>
                )}
                {item.aiHours && (
                  <span className="flex items-center gap-1 truncate" title="營業時間">
                    <Clock size={10} /> {item.aiHours}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* 如果還沒有 AI 資料 (例如剛加入收藏還沒跑完)，顯示 Loading 或 靜態提示 */
          isFavoriteView && (
             <div className="mt-auto text-[10px] text-gray-400 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> 正在分析地點資訊...
             </div>
          )
        )}

        {/* Action Buttons */}
        <div className="mt-2 flex items-center gap-2 justify-end">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item);
          }} className={`text-xs flex items-center gap-1 font-medium px-2.5 py-1.5 rounded-full transition-colors ${isFav ?
            'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} title={isFav ?
              "取消收藏" : "加入收藏"}>
            <Heart size={12} fill={isFav ? "currentColor" : "none"} /> 
          </button>
          
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleAddToItinerary(item); 
              if (navigator.vibrate) navigator.vibrate(50);
            }}
            className="text-xs flex items-center gap-1 font-bold px-3 py-1.5 rounded-full bg-teal-600 text-white hover:bg-teal-700 shadow-sm hover:shadow transition-all active:scale-95"
            title="直接加入行程"
          >
            <Plus size={12} /> 加入
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Sidebar({ sidebarTab, setSidebarTab, myFavorites, toggleFavorite, handleAddToItinerary, isMapScriptLoaded, mapInstance, mapCenter, onPlaceSelect, mapBounds, onBack, onOpenAI, onOpenShare, onOpenExport, itinerary = [] }) {
  const [searchInput, setSearchInput] = useState('');
  const [textSearchResults, setTextSearchResults] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef(null);

  const [searchError, setSearchError] = useState(null);
  const [currentCityName, setCurrentCityName] = useState("");
  const [activeFilter, setActiveFilter] = useState('all');
  
  // 🟢 新增：收藏清單的 AI 資料快取
  const [favAiData, setFavAiData] = useState({});
  
  const placesServiceRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkIsAdded = useCallback((item) => {
    const rawId = item.place_id || item.id;
    const cleanId = rawId ? String(rawId).replace(/^(ai-|place-|sidebar-)/, '') : '';
    return itinerary.some(i => {
      const iId = i.place_id ? String(i.place_id).replace(/^(ai-|place-|sidebar-)/, '') : '';
      return iId === cleanId;
    });
  }, [itinerary]);

  const isSearchMode = searchInput.trim().length > 0;
  const displayList = isSearchMode ? textSearchResults : aiRecommendations;

  const runPlacesServiceRequest = useCallback((requestType, request) => {
    return new Promise((resolve, reject) => {
      if (!window.google || !window.google.maps.places || !window.google.maps.places.PlacesService) {
        return reject(new Error("PLACE_SERVICE_UNAVAILABLE"));
      }
      let service;
      try {
        const serviceContainer = (mapInstance instanceof window.google.maps.Map) ? mapInstance : placesServiceRef.current;
        if (!serviceContainer) {
          const dummyDiv = document.createElement('div');
          service = new window.google.maps.places.PlacesService(dummyDiv);
        } else {
          service = new window.google.maps.places.PlacesService(serviceContainer);
        }
      } catch (e) {
        console.error("PlacesService init error:", e);
        return reject(new Error("SERVICE_INIT_FAIL"));
      }
      let handler;
      if (requestType === 'textSearch') handler = service.textSearch;
      else if (requestType === 'findPlaceFromQuery') handler = service.findPlaceFromQuery;
      else if (requestType === 'nearbySearch') handler = service.nearbySearch;
      else return reject(new Error("INVALID_REQUEST_TYPE"));

      if (!handler) return reject(new Error("SERVICE_HANDLER_MISSING"));

      handler.call(service, request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK || status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve({ results, status });
        } else {
          reject(new Error(`API_ERROR_STATUS: ${status}`));
        }
      });
    });
  }, [mapInstance]);

  const fetchCityName = useCallback(async (lat, lng) => {
    if (!window.google || !window.google.maps.Geocoder) return "這個區域";
    const geocoder = new window.google.maps.Geocoder();
    const latLng = { lat, lng };
    try {
      const { results } = await geocoder.geocode({ location: latLng });
      if (results && results.length > 0) {
        const locality = results.find(r => r.types.includes('locality') || r.types.includes('administrative_area_level_1'));
        if (locality) {
          const comp = locality.address_components.find(c => c.types.includes('locality'));
          return comp ? comp.long_name : locality.formatted_address.split(',')[0];
        }
        return results[0].address_components[1]?.long_name || "附近地區";
      }
    } catch (e) { console.warn("Reverse geocoding failed:", e); }
    return "這個區域";
  }, []);

  const fetchAIRecommendations = useCallback(async (filterType, isLoadMore = false) => {
    if (!isMapScriptLoaded) return;
    if (!isLoadMore) {
      setIsLoading(true);
      setAiRecommendations([]);
    } else {
      setIsLoadingMore(true);
    }
    setSearchError(null);

    try {
      const lat = mapCenter ? mapCenter.lat : 35.70;
      const lng = mapCenter ? mapCenter.lng : 139.77;
      let cityName = currentCityName;
      if (!cityName || !isLoadMore) {
        cityName = await fetchCityName(lat, lng);
        setCurrentCityName(cityName);
      }

      let typePrompt = "熱門旅遊景點、必吃餐廳或特色商家";
      if (filterType === 'food') typePrompt = "必吃美食、在地小吃、熱門餐廳";
      if (filterType === 'spot') typePrompt = "熱門旅遊景點、打卡地標、歷史古蹟";
      if (filterType === 'shopping') typePrompt = "購物中心、特色商店、伴手禮店";
      if (filterType === 'massage') typePrompt = "評價好的按摩店、SPA、放鬆場所";
      if (filterType === 'hotel') typePrompt = "特色住宿、熱門飯店";
      if (filterType === 'bar') typePrompt = "熱門酒吧、夜店、居酒屋、特色調酒";
      if (filterType === 'coffee') typePrompt = "特色咖啡廳、必喝手沖、網美下午茶、甜點店";
      if (filterType === 'rent') typePrompt = "租車公司、機車租借、自行車租借服務";
      if (filterType === 'nature') typePrompt = "自然景觀、公園、登山步道、海灘";

      const existingNames = isLoadMore ? aiRecommendations.map(i => i.name).join('、') : "";
      const excludePrompt = isLoadMore ? `(非常重要：請絕對不要重複推薦以下地點： ${existingNames})` : "";

      const prompt = `
        請針對「 ${cityName} 」這個城市或區域，推薦 6 個 ${typePrompt} 。
        
        【輸出格式】
        請回傳純 JSON 陣列，每個物件包含：
        - name: 地點名稱
        - type: spot/food/shopping/etc
        - highlights: 必玩/必吃亮點 (15字內，例如: 必點海南雞飯)
        - cost: 預估花費 (例如: 約 $100 / 免費)
        - hours: 營業時間簡述 (例如: 10:00-22:00)
      `;

      const rawResponse = await runGemini(prompt);
      if (!rawResponse || rawResponse === "[]") {
        if (!isLoadMore) setSearchError("AI_ERROR");
        return;
      }
      
      const startIndex = rawResponse.indexOf('[');
      const endIndex = rawResponse.lastIndexOf(']');
      if (startIndex === -1 || endIndex === -1) throw new Error("JSON Parse Error");
      const jsonText = rawResponse.substring(startIndex, endIndex + 1);
      const aiItems = JSON.parse(jsonText);

      const enrichedItems = await Promise.all(aiItems.map(async (item) => {
        try {
          const { results } = await runPlacesServiceRequest('textSearch', { query: `${cityName} ${item.name}` });
          if (results && results.length > 0) {
            const place = results[0];
            let type = item.type;
            let isOpenStatus = undefined;
            if (place.opening_hours && typeof place.opening_hours.isOpen === 'function') {
              try { isOpenStatus = place.opening_hours.isOpen(); } catch (e) { }
            }
            const googleUrl = `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;

            return {
              id: `ai-${place.place_id}`,
              place_id: place.place_id,
              name: place.name,
              rating: place.rating || 0,
              user_ratings_total: place.user_ratings_total || 0,
              type: type,
              tags: place.types ? place.types.slice(0, 3) : [],
              image: place.photos?.[0]?.getUrl({ maxWidth: 200, maxHeight: 200 }) || PLACEHOLDER_IMAGE_URL,
              pos: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
              priceLevel: place.price_level,
              isOpen: isOpenStatus,
              url: googleUrl,
              aiHighlights: item.highlights, 
              aiCost: item.cost,             
              aiHours: item.hours            
            };
          }
        } catch (e) { console.warn("Detail fetch failed", e); }
        return null;
      }));

      const validItems = enrichedItems.filter(i => i !== null);
      if (isLoadMore) setAiRecommendations(prev => [...prev, ...validItems]);
      else setAiRecommendations(validItems);

    } catch (error) {
      console.error("AI Rec Error:", error);
      if (!isLoadMore) setSearchError("AI_ERROR");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [mapCenter, fetchCityName, runPlacesServiceRequest, isMapScriptLoaded, currentCityName, aiRecommendations]);

  // 🟢 通用 AI 補充資訊函式 (用於 搜尋 & 收藏)
  const enrichItemsWithAI = async (itemsToEnrich, source = 'search') => {
    if (itemsToEnrich.length === 0) return;
    setIsAnalyzing(true);

    const placesListStr = itemsToEnrich.map(p => `ID: ${p.place_id || p.id}, Name: ${p.name}`).join('\n');
    const prompt = `
      針對以下地點，分析其「亮點」、「花費」、「營業時間」。
      【地點清單】
      ${placesListStr}
      【輸出規則】
      回傳 JSON Array: [{"id": "...", "highlights": "...", "cost": "...", "hours": "..."}]
      1. highlights: 15字內 (例如: 必看夜景)
      2. cost: 預估金額 (例如: 門票$500 / 免費)
      3. hours: 簡述 (例如: 09:00-18:00)
    `;

    try {
      const jsonStr = await runGemini(prompt);
      if (!jsonStr || jsonStr === "[]") return;
      const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const summaryData = JSON.parse(cleanJson);

      if (source === 'search') {
        setTextSearchResults(prev => prev.map(item => {
          const aiInfo = summaryData.find(s => s.id === (item.place_id || item.id));
          return aiInfo ? { ...item, aiHighlights: aiInfo.highlights, aiCost: aiInfo.cost, aiHours: aiInfo.hours } : item;
        }));
      } else if (source === 'favorites') {
        // 更新收藏快取
        const newFavData = {};
        summaryData.forEach(info => {
            newFavData[info.id] = { aiHighlights: info.highlights, aiCost: info.cost, aiHours: info.hours };
        });
        setFavAiData(prev => ({ ...prev, ...newFavData }));
      }

    } catch (error) { console.error("Batch Summary Error:", error); } finally { setIsAnalyzing(false); }
  };

  const handleSearch = useCallback(async (query) => {
    if (!isMapScriptLoaded) { setSearchError("SERVICE_UNAVAILABLE"); return; }
    setIsLoading(true); setSearchError(null); setTextSearchResults([]); setIsAnalyzing(false);

    try {
      let currentBounds;
      try { if (mapInstance) currentBounds = mapInstance.getBounds(); } catch (e) {}
      const { results } = await runPlacesServiceRequest('textSearch', { query: query.trim(), bounds: currentBounds });

      if (results && results.length > 0) {
        const formattedResults = results.map(place => {
          let type = 'spot';
          // ... (類型判斷同前) ...
          if (place.types.includes('lodging')) type = 'hotel';
          else if (place.types.includes('restaurant') || place.types.includes('food')) type = 'food';
          else if (place.types.includes('shopping_mall') || place.types.includes('store')) type = 'shopping';

          let isOpenStatus = undefined;
          if (place.opening_hours?.isOpen) try { isOpenStatus = place.opening_hours.isOpen(); } catch (e) {}
          const googleUrl = `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;

          return {
            id: `place-${place.place_id}`,
            place_id: place.place_id,
            name: place.name,
            rating: place.rating || 0,
            user_ratings_total: place.user_ratings_total || 0,
            type: type,
            tags: place.types ? place.types.slice(0, 3) : ['景點'],
            image: place.photos?.[0]?.getUrl({ maxWidth: 200, maxHeight: 200 }) || PLACEHOLDER_IMAGE_URL,
            pos: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
            priceLevel: place.price_level,
            isOpen: isOpenStatus,
            url: googleUrl,
            aiSummary: null,
            aiHighlights: '', aiCost: '', aiHours: ''
          };
        });
        setTextSearchResults(formattedResults);
        // 觸發搜尋結果的 AI 補完
        enrichItemsWithAI(formattedResults, 'search');

      } else { setTextSearchResults([]); }
    } catch (error) { console.error("Search failed:", error); setSearchError("API_ERROR"); } finally { setIsLoading(false); }
  }, [isMapScriptLoaded, runPlacesServiceRequest, mapInstance]);

  // 🟢 監聽收藏分頁：自動觸發 AI 補完
  useEffect(() => {
    if (sidebarTab === 'favorites' && myFavorites.length > 0 && !isAnalyzing) {
        // 找出還沒有 AI 資料的收藏
        const needEnrich = myFavorites.filter(item => {
            const cached = favAiData[item.id] || favAiData[item.place_id];
            return !item.aiHighlights && !cached; // 如果本身沒有且快取也沒有
        });
        
        // 分批處理，避免一次送太多 (取前 6 個)
        if (needEnrich.length > 0) {
            enrichItemsWithAI(needEnrich.slice(0, 6), 'favorites');
        }
    }
  }, [sidebarTab, myFavorites, favAiData, isAnalyzing]);

  useEffect(() => {
    const timer = setTimeout(() => { if (searchInput.trim()) handleSearch(searchInput); else setTextSearchResults([]); }, 800);
    return () => clearTimeout(timer);
  }, [searchInput, handleSearch]);

  useEffect(() => {
    if (sidebarTab === 'search' && !searchInput.trim()) fetchAIRecommendations(activeFilter, false);
  }, [sidebarTab, activeFilter, searchInput]);

  useEffect(() => {
    if (!observerTarget.current || sidebarTab !== 'search' || isSearchMode || isLoading || isLoadingMore) return;
    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && aiRecommendations.length > 0) fetchAIRecommendations(activeFilter, true);
    }, { threshold: 1.0 });
    observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [sidebarTab, isSearchMode, isLoading, isLoadingMore, aiRecommendations, activeFilter, fetchAIRecommendations]);

  return (
    <aside className="w-full h-full flex flex-col z-20 bg-white border-r border-gray-200 relative">
      <div ref={placesServiceRef} className="absolute top-0 left-0 w-0 h-0 overflow-hidden"></div>
      
      {/* Header & Tabs (維持原樣) */}
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4 bg-white shrink-0 relative z-20">
         <div className="flex items-center flex-1 w-full">
          <button onClick={onBack} className="mr-3 p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-teal-700 transition-colors cursor-pointer shrink-0"><ChevronLeft size={24} /></button>
          <div className="flex-1 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input type="text" placeholder="搜尋地點..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-full pl-9 pr-10 py-2 bg-gray-100 rounded-lg text-sm outline-none" />
              {/* ... Clear Button ... */}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Map className="text-teal-700" size={24} /><span className="font-bold text-teal-700 text-lg">TripCanvas</span>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-gray-100">
         <div className="relative mb-3 hidden md:block">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input type="text" placeholder="搜尋地點..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-full pl-9 pr-10 py-2 bg-gray-100 rounded-lg text-sm outline-none" />
         </div>
         <div className="flex bg-gray-100 p-1 rounded-lg">
           <button onClick={() => setSidebarTab('search')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1 ${sidebarTab === 'search' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}><Sparkles size={12} /> 探索</button>
           <button onClick={() => setSidebarTab('favorites')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1 ${sidebarTab === 'favorites' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}><Heart size={12} fill={myFavorites.length>0?"#f97316":"none"} /> 收藏 ({myFavorites.length})</button>
         </div>
         {sidebarTab === 'search' && !isSearchMode && (
           <div className="mt-3 flex gap-2 pb-1 flex-nowrap overflow-x-auto scrollbar-hide md:flex-wrap">
             {CATEGORY_FILTERS.map(filter => (
               <button key={filter.id} onClick={() => setActiveFilter(filter.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${activeFilter === filter.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}><filter.icon size={12} /> {filter.label}</button>
             ))}
           </div>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide pb-24">
         {!isMapScriptLoaded && <div className="bg-red-50 p-2 text-xs text-red-600 mb-2 rounded">⚠️ 地圖載入中...</div>}
         
         {isSearchMode ? displayList.map(item => (
             <DraggableSidebarItem key={item.id} item={item} isFavoriteView={false} isFav={myFavorites.some(f=>f.id===item.id)} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} isMobile={isMobile} isInItinerary={checkIsAdded(item)} />
         )) : sidebarTab === 'search' ? (
             isLoading ? <div className="flex flex-col items-center py-10"><Loader2 className="animate-spin text-purple-500" /></div> : 
             <>
               {aiRecommendations.map(item => <DraggableSidebarItem key={item.id} item={item} isFavoriteView={false} isFav={myFavorites.some(f=>f.id===item.id)} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} isMobile={isMobile} isInItinerary={checkIsAdded(item)} />)}
               <div ref={observerTarget} className="h-10 w-full flex justify-center">{isLoadingMore && <Loader2 size={14} className="animate-spin" />}</div>
             </>
         ) : (
             // 🟢 收藏清單渲染：合併 AI 快取資料
             myFavorites.map(item => {
                const cachedAi = favAiData[item.id] || favAiData[item.place_id] || {};
                const enrichedItem = { ...item, ...cachedAi };
                return <DraggableSidebarItem key={item.id} item={enrichedItem} isFavoriteView={true} isFav={true} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} isMobile={isMobile} isInItinerary={checkIsAdded(item)} />
             })
         )}
      </div>
      
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-full px-6 pointer-events-none">
        <button onClick={onOpenAI} className="pointer-events-auto w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl shadow-lg font-bold text-sm flex justify-center items-center gap-2"><Sparkles size={18} className="animate-pulse" /> <span>AI 智慧排程</span></button>
      </div>
    </aside>
  );
}