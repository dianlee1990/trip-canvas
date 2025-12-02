import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Map, Search, Sparkles, Heart, Plus, Loader2, DollarSign, Clock, Navigation, AlertTriangle,
  ChevronLeft, Camera, Coffee, ShoppingBag, Bed, Activity, Utensils,
  Beer, Landmark, Train, Mountain
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
    { id: 'massage', label: '按摩', icon: Activity },
    { id: 'hotel', label: '住宿', icon: Bed },
    { id: 'bar', label: '酒吧', icon: Beer },
    { id: 'temple', label: '寺廟', icon: Landmark },
    { id: 'nature', label: '自然', icon: Mountain },
    { id: 'transport', label: '車站', icon: Train },
];

const DraggableSidebarItem = ({ item, isFavoriteView, isFav, toggleFavorite, handleAddToItinerary, onPlaceSelect }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: `sidebar-${item.id}`,
      data: { type: 'sidebar-item', item: item }
  });

  const [imageSrc, setImageSrc] = useState(item.image);

  useEffect(() => { setImageSrc(item.image); }, [item.image]);

  const priceMap = { 0: '免費', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

  const handleCardClick = () => {
      const lat = item.pos?.lat || item.lat;
      const lng = item.pos?.lng || item.lng;
      if (onPlaceSelect && lat && lng) {
          // 【關鍵修復】傳遞完整 item 資訊，確保包含 url, rating, user_ratings_total
          onPlaceSelect({ ...item, lat, lng });
      }
  };

  const renderPrice = (level) => level !== undefined && level !== null && (
      <span className="flex items-center gap-1 text-xs text-gray-500"><DollarSign size={12}/> {priceMap[level] || 'N/A'}</span>
  );

  const renderOpenStatus = (isOpen) => isOpen !== undefined && isOpen !== null && (
      <span className={`flex items-center gap-1 text-xs font-medium ${isOpen ? 'text-green-600' : 'text-red-600'}`}>
          <Clock size={12}/> {isOpen ? '營業中' : '休息中'}
      </span>
  );

  return (
      <div
           ref={setNodeRef} {...listeners} {...attributes}
           className={`group flex gap-3 p-2 rounded-lg transition-all bg-white relative shadow-sm cursor-grab active:cursor-grabbing
                      ${isDragging ? 'opacity-50 ring-2 ring-teal-400' : ''}
                      ${isFavoriteView ? (isFav ? 'border-l-4 border-orange-500 bg-orange-50' : 'border border-gray-100') : 'border border-gray-100 hover:border-teal-300 hover:shadow-md'}
                      `}
           onClick={handleCardClick}
           style={{ touchAction: 'none' }}
      >
          <img src={imageSrc} onError={() => setImageSrc(PLACEHOLDER_IMAGE_URL)} className="w-16 h-16 rounded object-cover bg-gray-100 border border-gray-200" alt={item.name}/>
          <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-gray-800 truncate flex items-center gap-1"><IconByType type={item.type} size={14}/> {item.name}</h4>
              <span className="text-xs text-orange-500 font-bold">★{item.rating || 4.0}</span>
              <div className="mt-1 flex items-center gap-3">{renderPrice(item.priceLevel)}{renderOpenStatus(item.isOpen)}</div>
              {!isFavoriteView && item.aiReason && (
                  <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 bg-gray-50 px-1 rounded">{item.aiReason}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleFavorite(item); }} className={`text-xs flex items-center gap-1 font-medium px-2 py-1 rounded w-fit transition-colors ${isFav ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'}`} title={isFav ? "取消收藏" : "加入收藏"}>
                      <Heart size={12} fill={isFav ? "white" : "none"}/> {isFav ? '已收藏' : '收藏'}
                  </button>
                  {!isFavoriteView && (
                      <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleAddToItinerary({ ...item, lat: item.pos?.lat, lng: item.pos?.lng }); }} className="text-xs flex items-center gap-1 text-teal-600 font-medium hover:bg-teal-50 px-2 py-1 rounded w-fit border border-transparent hover:border-teal-100" title="直接加入行程">
                          <Plus size={12}/> 加入
                      </button>
                  )}
              </div>
          </div>
      </div>
  );
};

export default function Sidebar({ sidebarTab, setSidebarTab, myFavorites, toggleFavorite, handleAddToItinerary, isMapScriptLoaded, mapInstance, mapCenter, onPlaceSelect, mapBounds, onBack }) {
 
  const [searchInput, setSearchInput] = useState('');
  const [textSearchResults, setTextSearchResults] = useState([]); 
  const [aiRecommendations, setAiRecommendations] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [currentCityName, setCurrentCityName] = useState("");
  
  const [activeFilter, setActiveFilter] = useState('all');
 
  const placesServiceRef = useRef(null);

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
              service = new window.google.maps.places.PlacesService(serviceContainer);
          } catch (e) {
              console.error("PlacesService init error:", e);
              return reject(new Error("SERVICE_INIT_FAIL"));
          }
          let handler;
          if (requestType === 'textSearch') handler = service.textSearch;
          else if (requestType === 'findPlaceFromQuery') handler = service.findPlaceFromQuery;
          else if (requestType === 'nearbySearch') handler = service.nearbySearch;
          else return reject(new Error("INVALID_REQUEST_TYPE"));

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

  const fetchAIRecommendations = useCallback(async (filterType) => {
      if (!isMapScriptLoaded) return;
      setIsLoading(true);
      setSearchError(null);
      setAiRecommendations([]); 

      try {
          const lat = mapCenter ? mapCenter.lat : 35.70;
          const lng = mapCenter ? mapCenter.lng : 139.77;
          const cityName = await fetchCityName(lat, lng);
          setCurrentCityName(cityName);

          let typePrompt = "熱門旅遊景點、必吃餐廳或特色商家";
          if (filterType === 'food') typePrompt = "必吃美食、在地小吃、熱門餐廳";
          if (filterType === 'spot') typePrompt = "熱門旅遊景點、打卡地標、歷史古蹟";
          if (filterType === 'shopping') typePrompt = "購物中心、特色商店、伴手禮店";
          if (filterType === 'massage') typePrompt = "評價好的按摩店、SPA、放鬆場所";
          if (filterType === 'hotel') typePrompt = "特色住宿、熱門飯店";
          if (filterType === 'bar') typePrompt = "熱門酒吧、夜店、居酒屋、特色調酒";
          if (filterType === 'temple') typePrompt = "知名寺廟、神社、教堂、宗教聖地";
          if (filterType === 'nature') typePrompt = "自然景觀、公園、登山步道、海灘";
          if (filterType === 'transport') typePrompt = "主要車站、交通樞紐、特色火車站";

          const prompt = `
              請針對「${cityName}」這個城市或區域，推薦 5 到 6 個${typePrompt}。
              現在是旅遊旺季，請挑選本季最流行或評價最高的地點。
              
              請回傳純 JSON 陣列，格式如下：
              [
                  { "name": "地點名稱(請用Google Maps能搜尋到的標準名稱)", "type": "spot|food|shopping|massage|hotel", "reason": "推薦原因(10字內)" }
              ]
          `;

          const rawResponse = await runGemini(prompt);
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
                          try { isOpenStatus = place.opening_hours.isOpen(); } catch (e) {}
                      }

                      // 【修復】構建完整的資料物件
                      const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;

                      return {
                          id: `ai-${place.place_id}`,
                          place_id: place.place_id, 
                          name: place.name,
                          rating: place.rating || 0,
                          user_ratings_total: place.user_ratings_total || 0, // 確保有評論數
                          type: type,
                          tags: place.types ? place.types.slice(0, 3) : [],
                          image: place.photos?.[0]?.getUrl({maxWidth: 200, maxHeight: 200}) || PLACEHOLDER_IMAGE_URL,
                          pos: {
                              lat: place.geometry.location.lat(),
                              lng: place.geometry.location.lng()
                          },
                          priceLevel: place.price_level,
                          isOpen: isOpenStatus,
                          aiReason: item.reason,
                          url: googleUrl // 確保有 URL
                      };
                  }
              } catch (e) {
                  console.warn(`Failed to fetch details for ${item.name}`, e);
              }
              return null;
          }));

          setAiRecommendations(enrichedItems.filter(i => i !== null));

      } catch (error) {
          console.error("AI Recommendation Error:", error);
          setSearchError("AI_ERROR");
      } finally {
          setIsLoading(false);
      }
  }, [mapCenter, fetchCityName, runPlacesServiceRequest, isMapScriptLoaded]);

  const handleSearch = useCallback(async (query) => {
      if (!isMapScriptLoaded) {
          setSearchError("SERVICE_UNAVAILABLE");
          return;
      }
      setIsLoading(true);
      setSearchError(null);
      setTextSearchResults([]);

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
                      try { isOpenStatus = place.opening_hours.isOpen(); } catch (e) {}
                  }

                  // 【修復】構建完整的資料物件
                  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;

                  return {
                      id: `place-${place.place_id}`,
                      place_id: place.place_id,
                      name: place.name,
                      rating: place.rating || 0,
                      user_ratings_total: place.user_ratings_total || 0, // 確保有評論數
                      type: type,
                      tags: place.types ? place.types.slice(0, 3) : ['景點'],
                      image: place.photos?.[0]?.getUrl({maxWidth: 200, maxHeight: 200}) || PLACEHOLDER_IMAGE_URL,
                      pos: {
                          lat: place.geometry.location.lat(),
                          lng: place.geometry.location.lng()
                      },
                      priceLevel: place.price_level,
                      isOpen: isOpenStatus,
                      url: googleUrl // 確保有 URL
                  };
              });
              setTextSearchResults(formattedResults);
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
          fetchAIRecommendations(activeFilter);
      }
  }, [sidebarTab, activeFilter, fetchAIRecommendations, searchInput]);

  return (
      <aside className="w-1/4 min-w-[320px] bg-white border-r border-gray-200 flex flex-col z-20">
          <div ref={placesServiceRef} className="absolute top-0 left-0 w-0 h-0 overflow-hidden"></div>

          <div className="h-16 min-h-16 max-h-16 border-b border-gray-200 flex items-center px-4 bg-white shrink-0">
              <button onClick={onBack} className="mr-3 p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-teal-700 transition-colors cursor-pointer" title="回到儀表板">
                  <ChevronLeft size={24} />
              </button>
              <div className="flex items-center gap-2">
                  <Map className="text-teal-700" size={24}/>
                  <span className="font-bold text-teal-700 text-lg">TripCanvas</span>
              </div>
          </div>
         
          <div className="p-4 border-b border-gray-100">
              <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input 
                      type="text" 
                      placeholder="搜尋地點..." 
                      value={searchInput} 
                      onChange={(e) => setSearchInput(e.target.value)} 
                      className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-shadow" 
                  />
                  {isLoading && isSearchMode && <Loader2 size={16} className="absolute right-3 top-2.5 animate-spin text-teal-600"/>}
              </div>

              <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                      onClick={() => setSidebarTab('search')} 
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1 ${sidebarTab === 'search' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      <Sparkles size={12}/> 探索
                  </button>
                  <button 
                      onClick={() => setSidebarTab('favorites')} 
                      className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1 ${sidebarTab === 'favorites' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      <Heart size={12} fill={myFavorites.length > 0 ? "#f97316" : "none"}/>
                      收藏 ({myFavorites.length})
                  </button>
              </div>

              {sidebarTab === 'search' && !isSearchMode && (
                  <div className="mt-3 flex flex-wrap gap-2 pb-1">
                      {CATEGORY_FILTERS.map(filter => {
                          const Icon = filter.icon;
                          const isActive = activeFilter === filter.id;
                          return (
                              <button
                                  key={filter.id}
                                  onClick={() => setActiveFilter(filter.id)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${isActive ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                              >
                                  <Icon size={12} /> {filter.label}
                              </button>
                          );
                      })}
                  </div>
              )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {sidebarTab === 'search' && (
                  <>
                      {!isMapScriptLoaded && <div className="bg-red-50 p-2 text-xs text-red-600 mb-2 rounded border border-red-100">⚠️ 地圖載入中...</div>}
                      {searchError === 'API_DENIED' && <div className="bg-red-50 p-3 rounded-lg text-xs text-red-700 mb-4 border border-red-200 flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5"/><div><b>API 權限受限</b><br/>請檢查 API Key 設定。</div></div>}
                      {searchError === 'AI_ERROR' && <div className="bg-red-50 p-2 text-xs text-red-700 mb-2 rounded">AI 連線失敗，請稍後再試。</div>}

                      {!isSearchMode && (
                          <>
                              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded-lg text-xs text-indigo-900 mb-2 border border-indigo-100 flex items-center gap-2">
                                  <Sparkles size={14} className="text-purple-600 shrink-0"/>
                                  <div>AI 正在推薦 <b>{currentCityName || "此區域"}</b> 的{CATEGORY_FILTERS.find(f=>f.id===activeFilter)?.label}</div>
                              </div>
                              
                              {isLoading ? (
                                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                      <Loader2 size={24} className="animate-spin text-purple-500"/>
                                      <p className="text-xs text-gray-400">AI 正在挖掘最夯景點...</p>
                                  </div>
                              ) : (
                                  aiRecommendations.length > 0 ? (
                                      aiRecommendations.map(item => <DraggableSidebarItem key={item.id} item={item} isFavoriteView={false} isFav={myFavorites.some(f => f.id === item.id)} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} />)
                                  ) : (
                                      !searchError && <div className="text-center py-10 text-gray-400 text-xs">暫無推薦資料</div>
                                  )
                              )}
                          </>
                      )}

                      {isSearchMode && (
                          <>
                              {displayList.map(item => <DraggableSidebarItem key={item.id} item={item} isFavoriteView={false} isFav={myFavorites.some(f => f.id === item.id)} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} />)}
                              {!isLoading && displayList.length === 0 && <div className="text-center py-10 text-gray-400"><p>找不到結果</p></div>}
                          </>
                      )}
                  </>
              )}

              {sidebarTab === 'favorites' && myFavorites.map(item => <DraggableSidebarItem key={item.id} item={item} isFavoriteView={true} isFav={true} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} onPlaceSelect={onPlaceSelect} />)}
              {sidebarTab === 'favorites' && myFavorites.length === 0 && <div className="text-center py-10 text-gray-400 text-xs"><p>還沒有收藏任何地點</p></div>}
          </div>
      </aside>
  );
}