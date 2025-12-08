import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Map, Search, Sparkles, Heart, Plus, Loader2, DollarSign, Clock, Navigation, AlertTriangle,
  ChevronLeft, Camera, ShoppingBag, Bed, Activity, Utensils,
  Beer, Mountain, X, Car, Coffee
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

const DraggableSidebarItem = ({ item, isFavoriteView, isFav, toggleFavorite, handleAddToItinerary, onPlaceSelect, isMobile }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${item.id}`,
    data: { type: 'sidebar-item', item: item },
    disabled: isMobile
  });

  const [imageSrc, setImageSrc] = useState(item.image);

  useEffect(() => { setImageSrc(item.image); }, [item.image]);

  const priceMap = { 0: '免費', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

  const handleCardClick = () => {
    const lat = item.pos?.lat || item.lat;
    const lng = item.pos?.lng || item.lng;
    if (onPlaceSelect && lat && lng) {
      onPlaceSelect({ ...item, lat, lng });
    }
  };

  const renderPrice = (level) => level !== undefined && level !== null && (
    <span className="flex items-center gap-1 text-xs text-gray-500"><DollarSign size={12} /> {priceMap[level] || 'N/A'}</span>
  );

  const renderOpenStatus = (isOpen) => isOpen !== undefined && isOpen !== null && (
    <span className={`flex items-center gap-1 text-xs font-medium ${isOpen ? 'text-green-600' : 'text-red-600'}`}>
      <Clock size={12} /> {isOpen ? '營業中' : '休息中'}
    </span>
  );

  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      className={`group flex gap-3 p-2 rounded-lg transition-all bg-white relative shadow-sm
      ${isDragging ? 'opacity-50 ring-2 ring-teal-400' : ''}
      ${isFavoriteView ? (isFav ? 'border-l-4 border-orange-500 bg-orange-50' : 'border border-gray-100') : 'border border-gray-100 hover:border-teal-300 hover:shadow-md'}
      ${isMobile ? '' : 'cursor-grab active:cursor-grabbing'}
      `}
      onClick={handleCardClick}
      style={{ touchAction: isMobile ? 'auto' : 'none' }}
    >
      <img src={imageSrc} onError={() => setImageSrc(PLACEHOLDER_IMAGE_URL)} className="w-16 h-16 rounded object-cover bg-gray-100 border border-gray-200 shrink-0" alt={item.name} />
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h4 className="font-bold text-sm text-gray-800 truncate flex items-center gap-1"><IconByType type={item.type} size={14} /> {item.name}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-orange-500 font-bold flex items-center">★{item.rating || 4.0}</span>
            {renderPrice(item.priceLevel)}
            {renderOpenStatus(item.isOpen)}
          </div>
        </div>

        {item.aiSummary ? (
          <div className="mt-1.5 bg-purple-50 border border-purple-100 rounded px-2 py-1 text-[10px] text-purple-700 leading-tight flex items-start gap-1 animate-in fade-in">
            <Sparkles size={10} className="shrink-0 mt-0.5 fill-purple-200" />
            <span>{item.aiSummary}</span>
          </div>
        ) : (
          !isFavoriteView && item.aiReason && (
            <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 bg-gray-50 px-1 rounded">{item.aiReason}</p>
          )
        )}

        <div className="mt-2 flex items-center gap-2">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item);
          }} className={`text-xs flex items-center gap-1 font-medium px-2 py-1 rounded w-fit transition-colors ${isFav ?
            'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'}`} title={isFav ?
              "取消收藏" : "加入收藏"}>
            <Heart size={12} fill={isFav ? "white" : "none"} /> {isFav ?
              '已收藏' : '收藏'}
          </button>
          {!isFavoriteView && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleAddToItinerary({ ...item, lat: item.pos?.lat, lng: item.pos?.lng, aiSummary: item.aiSummary });
                if (navigator.vibrate) navigator.vibrate(50);
              }}
              className={`text-xs flex items-center gap-1 font-medium px-2 py-1 rounded w-fit border transition-colors ${isMobile ?
                'bg-teal-50 text-teal-700 border-teal-200' : 'text-teal-600 border-transparent hover:bg-teal-50 hover:border-teal-100'}`}
              title="直接加入行程"
            >
              <Plus size={12} /> 加入
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Sidebar({ sidebarTab, setSidebarTab, myFavorites, toggleFavorite, handleAddToItinerary, isMapScriptLoaded, mapInstance, mapCenter, onPlaceSelect, mapBounds, onBack, onOpenAI, onOpenShare, onOpenExport }) {
  const [searchInput, setSearchInput] = useState('');
  const [textSearchResults, setTextSearchResults] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef(null);

  const [searchError, setSearchError] = useState(null);
  const [currentCityName, setCurrentCityName] = useState("");
  const [activeFilter, setActiveFilter] = useState('all');
  const placesServiceRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSearchMode = searchInput.trim().length > 0;
  const displayList = isSearchMode ? textSearchResults : aiRecommendations;

  // 🟢 關鍵修復：加入 dummyDiv 確保 Service 永遠能初始化
  const runPlacesServiceRequest = useCallback((requestType, request) => {
    return new Promise((resolve, reject) => {
      if (!window.google || !window.google.maps.places || !window.google.maps.places.PlacesService) {
        return reject(new Error("PLACE_SERVICE_UNAVAILABLE"));
      }
      let service;
      try {
        const serviceContainer = (mapInstance instanceof window.google.maps.Map) ? mapInstance : placesServiceRef.current;
        
        // 🟢 修正：若無容器，建立虛擬 div
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

      // 🟢 確保 handler 存在
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
        現在是旅遊旺季，請挑選本季最流行或評價最高的地點。
        ${excludePrompt}
        請回傳純 JSON 陣列，格式如下：
        [ { "name": "地點名稱(請用Google Maps能搜尋到的標準名稱)", "type": "spot|food|shopping|massage|hotel|coffee|rent", "reason": "推薦原因(10字內)" } ]
      `;

      const rawResponse = await runGemini(prompt);
      
      // 🟢 檢查 AI 回應是否有效
      if (!rawResponse || rawResponse === "[]") {
         console.warn("AI 回傳空結果");
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
              aiReason: item.reason,
              url: googleUrl
            };
          }
        } catch (e) {
          console.warn(`Failed to fetch details for ${item.name}`, e);
        }
        return null;
      }));

      const validItems = enrichedItems.filter(i => i !== null);

      if (isLoadMore) {
        setAiRecommendations(prev => [...prev, ...validItems]);
      } else {
        setAiRecommendations(validItems);
      }

    } catch (error) {
      console.error("AI Recommendation Error:", error);
      if (!isLoadMore) setSearchError("AI_ERROR");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [mapCenter, fetchCityName, runPlacesServiceRequest, isMapScriptLoaded, currentCityName, aiRecommendations]);

  const generateBatchSummaries = async (places) => {
    const targets = places.slice(0, 6);
    if (targets.length === 0) return;

    setIsAnalyzing(true);

    const placesListStr = targets.map(p => `ID: ${p.place_id}, Name: ${p.name}`).join('\n');

    const prompt = `
      請擔任旅遊美食專家。針對以下地點清單，分析其「必吃/必玩亮點」與「預估人均消費」。
      
      【地點清單】
      ${placesListStr}

      【輸出規則】
      1. 請回傳純 JSON Array。
      2. 格式：[{"id": "對應的ID", "summary": "亮點 (12字內) | 預估價格"}]
      3. 範例：[{"id": "ChIJ...", "summary": "必點辣椒螃蟹 | $1500"}]
      4. 價格請用當地貨幣或美金估算，若為景點請標註「免費」或「門票約$XX」。
      5. summary 字數請務必精簡，不要超過 20 字。
    `;

    try {
      const jsonStr = await runGemini(prompt);
      
      // 🟢 檢查 AI 回應
      if (!jsonStr || jsonStr === "[]") return;

      const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const summaryData = JSON.parse(cleanJson);

      setTextSearchResults(prev => prev.map(item => {
        const aiInfo = summaryData.find(s => s.id === item.place_id);
        if (aiInfo) {
          return { ...item, aiSummary: aiInfo.summary };
        }
        return item;
      }));

    } catch (error) {
      console.error("Batch Summary Error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSearch = useCallback(async (query) => {
    if (!isMapScriptLoaded) {
      setSearchError("SERVICE_UNAVAILABLE");
      return;
    }
    setIsLoading(true);
    setSearchError(null);
    setTextSearchResults([]);
    setIsAnalyzing(false);

    try {
      let currentBounds;
      try {
        if (mapInstance && typeof mapInstance.getBounds === 'function') {
          currentBounds = mapInstance.getBounds();
        }
      } catch (e) { console.warn("Could not get map bounds:", e); }

      const searchRequest = {
        query: query.trim(),
        bounds: currentBounds,
      };

      const { results } = await runPlacesServiceRequest('textSearch', searchRequest);

      if (results && results.length > 0) {
        const formattedResults = results.map(place => {
          let type = 'spot';
          if (place.types.includes('lodging')) type = 'hotel';
          else if (place.types.includes('restaurant') || place.types.includes('food')) type = 'food';
          else if (place.types.includes('shopping_mall') || place.types.includes('store')) type = 'shopping';

          let isOpenStatus = undefined;
          if (place.opening_hours && typeof place.opening_hours.isOpen === 'function') {
            try { isOpenStatus = place.opening_hours.isOpen(); } catch (e) { }
          }
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
            aiSummary: null
          };
        });
        setTextSearchResults(formattedResults);
        generateBatchSummaries(formattedResults);

      } else {
        setTextSearchResults([]);
      }
    } catch (error) {
      console.error("Search failed:", error.message);
      if (error.message.includes("REQUEST_DENIED")) {
        setSearchError("API_DENIED");
      } else {
        setSearchError("API_ERROR");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isMapScriptLoaded, runPlacesServiceRequest, mapInstance]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim()) {
        handleSearch(searchInput);
      } else {
        setTextSearchResults([]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchInput, handleSearch]);

  useEffect(() => {
    if (sidebarTab === 'search' && !searchInput.trim()) {
      fetchAIRecommendations(activeFilter, false);
    }
  }, [sidebarTab, activeFilter, searchInput]);

  useEffect(() => {
    if (!observerTarget.current || sidebarTab !== 'search' || isSearchMode || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && aiRecommendations.length > 0) {
          console.log("滑到底部，載入更多推薦...");
          fetchAIRecommendations(activeFilter, true);
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [sidebarTab, isSearchMode, isLoading, isLoadingMore, aiRecommendations, activeFilter, fetchAIRecommendations]);


  return (
    <aside className="w-full h-full flex flex-col z-20 bg-white border-r border-gray-200 relative">
      <div ref={placesServiceRef} className="absolute top-0 left-0 w-0 h-0 overflow-hidden"></div>

      <div className="h-16 min-h-16 max-h-16 border-b border-gray-200 flex items-center justify-between px-4 bg-white shrink-0 relative z-20">
        <div className="flex items-center flex-1 w-full">
          <button onClick={onBack} className="mr-3 p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-teal-700 transition-colors cursor-pointer shrink-0" title="回到儀表板">
            <ChevronLeft size={24} />
          </button>

          <div className="flex-1 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="搜尋地點..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-10 py-2 bg-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
              />
              <div className="absolute right-3 top-2.5 flex items-center gap-2">
                {isLoading && isSearchMode && <Loader2 size={16} className="animate-spin text-teal-600" />}
                {searchInput.length > 0 && (
                  <button
                    onClick={() => setSearchInput('')}
                    className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Map className="text-teal-700" size={24} />
            <span className="font-bold text-teal-700 text-lg">TripCanvas</span>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-gray-100">
        <div className="relative mb-3 hidden md:block">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="搜尋地點..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-10 py-2 bg-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow"
          />
          <div className="absolute right-3 top-2.5 flex items-center gap-2">
            {isLoading && isSearchMode && <Loader2 size={16} className="animate-spin text-teal-600" />}
            {searchInput.length > 0 && (
              <button
                onClick={() => setSearchInput('')}
                className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setSidebarTab('search')}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1 ${sidebarTab === 'search' ?
              'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Sparkles size={12} /> 探索
          </button>
          <button
            onClick={() => setSidebarTab('favorites')}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1 ${sidebarTab === 'favorites' ?
              'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Heart size={12} fill={myFavorites.length > 0 ? "#f97316" : "none"} />
            收藏 ({myFavorites.length})
          </button>
        </div>

        {sidebarTab === 'search' && !isSearchMode && (
          <div className="mt-3 flex gap-2 pb-1 flex-nowrap overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
            {CATEGORY_FILTERS.map(filter => {
              const Icon = filter.icon;
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${isActive ?
                    'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  <Icon size={12} /> {filter.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide pb-24 md:pb-24">
        {!isMapScriptLoaded && <div className="bg-red-50 p-2 text-xs text-red-600 mb-2 rounded border border-red-100">⚠️ 地圖載入中...</div>}

        {isSearchMode ? (
          <>
            {searchError === 'API_DENIED' && <div className="bg-red-50 p-3 rounded-lg text-xs text-red-700 mb-4 border border-red-200 flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><div><b> API 權限受限 </b><br /> 請檢查 API Key 設定。 </div></div>}

            {isAnalyzing && !isLoading && (
              <div className="text-[10px] text-purple-600 flex items-center gap-1 justify-center animate-pulse mb-2">
                <Sparkles size={12} /> AI 正在分析必吃必玩熱點與價格...
              </div>
            )}

            {displayList.map(item => (
              <DraggableSidebarItem
                key={item.id}
                item={item}
                isFavoriteView={false}
                isFav={myFavorites.some(f => f.id === item.id)}
                toggleFavorite={toggleFavorite}
                handleAddToItinerary={handleAddToItinerary}
                onPlaceSelect={onPlaceSelect}
                isMobile={isMobile}
              />
            ))}

            {!isLoading && displayList.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <p>找不到結果</p>
              </div>
            )}
          </>
        ) : (
          <>
            {sidebarTab === 'search' && (
              <>
                {searchError === 'AI_ERROR' && <div className="bg-red-50 p-2 text-xs text-red-700 mb-2 rounded"> AI 連線失敗，請稍後再試。 </div>}

                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded-lg text-xs text-indigo-900 mb-2 border border-indigo-100 flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-600 shrink-0" />
                  <div> AI 正在推薦 <b>{currentCityName || "此區域"}</b> 的 {CATEGORY_FILTERS.find(f => f.id === activeFilter)?.label}</div>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <Loader2 size={24} className="animate-spin text-purple-500" />
                    <p className="text-xs text-gray-400"> AI 正在挖掘最夯景點... </p>
                  </div>
                ) : (
                  <>
                    {aiRecommendations.length > 0 ? (
                      aiRecommendations.map(item => <DraggableSidebarItem key={item.id} item={item} isFavoriteView={false} isFav={myFavorites.some(f => f.id === item.id)} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} isMobile={isMobile} />)
                    ) : (
                      !searchError && <div className="text-center py-10 text-gray-400 text-xs"> 暫無推薦資料 </div>
                    )}

                    <div ref={observerTarget} className="h-10 flex items-center justify-center w-full">
                      {isLoadingMore && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={14} className="animate-spin" /> 載入更多中... </div>}
                    </div>
                  </>
                )}
              </>
            )}

            {sidebarTab === 'favorites' && (
              <>
                {myFavorites.map(item => <DraggableSidebarItem key={item.id} item={item} isFavoriteView={true} isFav={true} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} isMobile={isMobile} />)}
                {myFavorites.length === 0 && <div className="text-center py-10 text-gray-400 text-xs"><p> 還沒有收藏任何地點 </p></div>}
              </>
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-full px-6 pointer-events-none">
        <button
          onClick={onOpenAI}
          className="pointer-events-auto w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 font-bold text-sm border border-white/20"
        >
          <Sparkles size={18} className="animate-pulse" />
          <span> AI 智慧排程 </span>
        </button>
      </div>
    </aside>
  );
}