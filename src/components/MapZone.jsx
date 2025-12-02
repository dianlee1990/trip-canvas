import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Wallet, Loader2, AlertTriangle, Star, Plus, Heart, Search, MapPin, Sparkles } from 'lucide-react';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
// 引入 AI 工具
import { runGemini } from '../utils/gemini';

const containerStyle = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 35.700, lng: 139.770 };

const getFallbackLatLng = (pos) => {
  const BASE_LAT = 35.71;
  const BASE_LNG = 139.78;
  const LAT_RANGE = 0.04;
  const LNG_RANGE = 0.08;
  const lat = BASE_LAT + (50 - pos.top) / 100 * LAT_RANGE;
  const lng = BASE_LNG + (pos.left - 50) / 100 * LNG_RANGE;
  return { lat, lng };
};

export default function MapZone({
    sidebarTab, itinerary, handleAddToItinerary, isMapScriptLoaded,
    setMapInstance, setMapCenter, mapCenter,
    selectedPlace, onMapPoiClick, setMapBounds,
    onPlaceSelect,
    myFavorites = [],
    toggleFavorite = () => {},
    activeDay
}) {
  const mapRef = useRef(null);
  const [poiInfo, setPoiInfo] = useState(null);
  const [showSearchButton, setShowSearchButton] = useState(false);
  
  // 新增：控制 AI 分析的 Loading 狀態
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const onPlaceSelectRef = useRef(onPlaceSelect);
  const handleAddToItineraryRef = useRef(handleAddToItinerary);
  // 使用 Ref 追蹤 itinerary，避免在 Event Listener 中讀到舊資料
  const itineraryRef = useRef(itinerary);

  useEffect(() => {
      onPlaceSelectRef.current = onPlaceSelect;
      handleAddToItineraryRef.current = handleAddToItinerary;
      itineraryRef.current = itinerary;
  }, [onPlaceSelect, handleAddToItinerary, itinerary]);

  const [resolvedLocations, setResolvedLocations] = useState([]);
  const [mapError, setMapError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const initialCenter = (mapCenter && mapCenter.lat) ? mapCenter : DEFAULT_CENTER;
  const [centerState, setCenterState] = useState(initialCenter);
  const [zoomState, setZoomState] = useState(14);

  useEffect(() => {
      if (mapRef.current && mapCenter && mapCenter.lat && mapCenter.lng) {
          mapRef.current.panTo(mapCenter);
          setShowSearchButton(false);
      }
  }, [mapCenter]);

  const handleSearchAreaClick = useCallback(() => {
      if (mapRef.current) {
          const center = mapRef.current.getCenter();
          const bounds = mapRef.current.getBounds();
          if (center && setMapCenter) setMapCenter({ lat: center.lat(), lng: center.lng() });
          if (bounds && setMapBounds) {
              setMapBounds({
                  north: bounds.getNorthEast().lat(), south: bounds.getSouthWest().lat(),
                  east: bounds.getNorthEast().lng(), west: bounds.getSouthWest().lng()
              });
          }
          setShowSearchButton(false);
      }
  }, [setMapCenter, setMapBounds]);

  const onLoad = useCallback((map) => {
      mapRef.current = map;
      if (setMapInstance) setMapInstance(map);
      map.addListener('idle', () => setShowSearchButton(true));
      map.addListener('dragstart', () => setShowSearchButton(false));
      map.addListener('click', (event) => {
          setPoiInfo(null);
          setIsAnalyzing(false); // 重置分析狀態
          if (event.placeId) {
              event.stop();
              const placeId = event.placeId;
              const service = new window.google.maps.places.PlacesService(map);
              service.getDetails({
                  placeId: placeId,
                  fields: ['name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total', 'url', 'price_level', 'opening_hours', 'photos', 'types']
              }, async (place, status) => {
                  if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                      // 使用 ref 取得最新的 itinerary
                      const currentItinerary = itineraryRef.current || [];
                      // 檢查這個點是否已經在行程中且有 AI 摘要
                      const existingItem = currentItinerary.find(item => 
                          (item.place_id === placeId) || 
                          (item.name === place.name) // 簡易 fallback 比對
                      );

                      const hasExistingSummary = !!existingItem?.aiSummary;

                      setPoiInfo({ 
                          position: place.geometry.location, 
                          data: { ...place, place_id: placeId },
                          // 如果行程中已經有摘要，直接帶入
                          aiSummary: hasExistingSummary ? existingItem.aiSummary : null 
                      });

                      if (onPlaceSelectRef.current) {
                          onPlaceSelectRef.current({
                              id: `place-${placeId}`, name: place.name,
                              pos: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }, isPoi: true
                          });
                      }

                      // 若無摘要，則自動觸發 AI 分析
                      if (!hasExistingSummary) {
                          setIsAnalyzing(true);
                          try {
                              const prompt = `請用繁體中文，30字以內簡短介紹「${place.name}」的主要特色、用途或氛圍。`;
                              const summary = await runGemini(prompt);
                              
                              // 確保使用者還在看同一個點才更新 State
                              setPoiInfo(prev => {
                                  if (prev && prev.data.place_id === placeId) {
                                      return { ...prev, aiSummary: summary };
                                  }
                                  return prev;
                              });
                          } catch (error) {
                              console.error("AI Analysis Failed:", error);
                              setPoiInfo(prev => {
                                  if (prev && prev.data.place_id === placeId) {
                                      return { ...prev, aiSummary: "暫時無法分析此地點。" };
                                  }
                                  return prev;
                              });
                          } finally {
                              setIsAnalyzing(false);
                          }
                      }
                  }
              });
          }
      });
  }, [setMapInstance]); // 移除 itinerary 依賴，改用 ref

  const onUnmount = useCallback(() => {
      if (mapRef.current) window.google.maps.event.clearInstanceListeners(mapRef.current);
      mapRef.current = null;
      if (setMapInstance) setMapInstance(null);
  }, [setMapInstance]);
  
  const geocodePlace = useCallback((query, map) => {
      return new Promise((resolve, reject) => {
          if (!map || !window.google || !window.google.maps.Geocoder) return reject(new Error("Service unavailable"));
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: `${query}` }, (results, status) => {
              if (status === 'OK' && results[0]) {
                  const loc = results[0].geometry.location;
                  resolve({ lat: loc.lat(), lng: loc.lng(), name: query });
              } else reject(new Error("Not found"));
          });
      });
  }, []);

  useEffect(() => {
      if (!isMapScriptLoaded || !mapRef.current) return;
      const itemsToGeocode = itinerary.filter(item => item.type !== 'connection' && (!item.lat || !item.lng));
      Promise.all(itemsToGeocode.map(async (item) => {
          try {
              const { lat, lng } = await geocodePlace(item.name, mapRef.current);
              return { ...item, lat, lng };
          } catch (e) { return item; }
      })).then(newLocations => {
          const newResolvedMap = new Map();
          newLocations.filter(item => item.lat).forEach(item => newResolvedMap.set(item.id, item));
          itinerary.filter(item => item.type !== 'connection' && item.lat).forEach(item => newResolvedMap.set(item.id, item));
          setResolvedLocations(Array.from(newResolvedMap.values()));
      });
  }, [itinerary, isMapScriptLoaded, geocodePlace]);
  
  // Fit Bounds & Zoom Logic
  useEffect(() => {
      if (!mapRef.current || resolvedLocations.length === 0) return;
      const dayLocations = resolvedLocations.filter(item => {
          const itemDay = Number(item.day || 1);
          return item.lat && item.lng && itemDay === activeDay;
      });
      if (dayLocations.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          dayLocations.forEach(item => bounds.extend(new window.google.maps.LatLng(item.lat, item.lng)));
          if (!bounds.isEmpty()) {
              mapRef.current.fitBounds(bounds);
              const listener = window.google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
                  if (mapRef.current.getZoom() > 16) mapRef.current.setZoom(16);
              });
              setIsInitialLoad(false);
              setShowSearchButton(false);
          }
      }
  }, [resolvedLocations, isInitialLoad, activeDay]);

  // 修改：當左側選單點擊時 (selectedPlace 改變)，直接顯示 POI 資訊卡
  useEffect(() => {
      if (!selectedPlace || !selectedPlace.lat || !selectedPlace.lng) return;
      
      // 1. 移動地圖
      setCenterState({ lat: selectedPlace.lat, lng: selectedPlace.lng });
      setZoomState(15);
      setShowSearchButton(false);

      // 2. 顯示 POI 資訊卡 (使用左側傳來的完整資料)
      const placeId = selectedPlace.id;
      const currentItinerary = itineraryRef.current || [];
      const existingItem = currentItinerary.find(i => i.id === placeId);
      
      // 優先權：行程中的摘要 > 左側 AI 列表的摘要
      const hasSummary = existingItem?.aiSummary || selectedPlace.aiReason;

      setPoiInfo({
          position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
          data: {
              ...selectedPlace, // 包含 name, rating, image (Sidebar 傳的)
              place_id: placeId,
          },
          aiSummary: hasSummary || null
      });

      // 3. 如果完全沒有摘要，才觸發即時分析
      if (!hasSummary) {
          setIsAnalyzing(true);
          runGemini(`請用繁體中文，30字以內簡短介紹「${selectedPlace.name}」的主要特色、用途或氛圍。`)
            .then(res => {
                setPoiInfo(prev => {
                    // 確保還在看同一個地點才更新
                    if (prev && prev.data.place_id === placeId) {
                        return { ...prev, aiSummary: res };
                    }
                    return prev;
                });
            })
            .catch(e => {
                console.error("Auto-analyze failed", e);
                setPoiInfo(prev => prev && prev.data.place_id === placeId ? { ...prev, aiSummary: "暫時無法分析" } : prev);
            })
            .finally(() => setIsAnalyzing(false));
      } else {
          setIsAnalyzing(false);
      }

  }, [selectedPlace]);

  // 修改：在 useMemo 中計算 polylineKey，確保順序變更時 key 會改變
  const { mapElements, pathCoordinates, polylineKey } = useMemo(() => {
      const elements = [];
      const path = [];
      
      let itineraryPins = resolvedLocations.filter(item => {
          const itemDay = Number(item.day || 1);
          return item.lat && item.lng && itemDay === activeDay;
      });

      itineraryPins.sort((a, b) => (a.order || 0) - (b.order || 0));

      const currentPolylineKey = itineraryPins.map(p => p.id).join('-');

      itineraryPins.forEach((item, idx) => {
          const position = { lat: item.lat, lng: item.lng };
          path.push(position);
          let iconColor = '#0d9488';
          if (item.type === 'food') iconColor = '#f97316';
          if (item.type === 'hotel') iconColor = '#4f46e5';

          elements.push({
              type: 'itinerary', 
              id: item.id, 
              position: position, 
              iconColor: iconColor, 
              label: (idx + 1).toString(), 
              title: item.name, 
              zIndex: 2,
              onClick: () => {
                   setPoiInfo({
                       position: position,
                       data: { 
                           name: item.name, 
                           rating: item.rating, 
                           place_id: item.place_id,
                       },
                       aiSummary: item.aiSummary
                   });
              }
          });
      });
      
      if (selectedPlace?.lat) {
          if (!itineraryPins.some(p => p.id === selectedPlace.id)) {
              elements.push({ 
                  type: 'selected', 
                  id: selectedPlace.id, 
                  position: {lat: selectedPlace.lat, lng: selectedPlace.lng}, 
                  iconColor: '#a855f7', 
                  label: null, 
                  title: selectedPlace.name, 
                  zIndex: 3, 
                  onClick: () => handleAddToItinerary({ ...selectedPlace, type: 'spot', pos: {lat: selectedPlace.lat, lng: selectedPlace.lng} }) 
              });
          }
      }
      return { mapElements: elements, pathCoordinates: path, polylineKey: currentPolylineKey };
  }, [resolvedLocations, sidebarTab, handleAddToItinerary, selectedPlace, activeDay]);

  const renderStars = (r) => <div className="flex text-yellow-500"><span className="font-bold text-gray-900 mr-1">{r}</span><Star size={12} fill="currentColor"/></div>;
  const renderPrice = (l) => l ? <div className="flex text-gray-600 text-xs">{[...Array(4)].map((_, i) => <span key={i} className={i < l ? "font-bold text-gray-900":"text-gray-300"}>$</span>)}</div> : null;
  const isPoiFavorite = poiInfo && myFavorites.some(f => f.id === `place-${poiInfo.data.place_id}`);

  // 修改圖片顯示邏輯：支援 Sidebar 傳入的 image 字串
  const poiImage = poiInfo?.data?.photos?.[0]?.getUrl({maxWidth: 200, maxHeight: 150}) || poiInfo?.data?.image;

  return (
      <aside className="flex-1 min-w-[300px] bg-white border-l border-gray-200 flex flex-col z-20 hidden lg:flex">
          <div className="flex-1 bg-gray-100 relative overflow-hidden">
              {!isMapScriptLoaded ? (
                  <div className="flex-1 h-full bg-gray-200 animate-pulse flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 mr-2 animate-spin" /> 地圖服務載入中...</div>
              ) : (
                  <div className="relative w-full h-full">
                      {showSearchButton && <div className="absolute top-5 left-1/2 transform -translate-x-1/2 z-10"><button onClick={handleSearchAreaClick} className="bg-white text-teal-700 px-4 py-2 rounded-full shadow-md font-bold text-sm flex gap-2"><Search size={14}/> 搜尋此區域</button></div>}
                      <GoogleMap
                           mapContainerStyle={containerStyle}
                           center={centerState} zoom={zoomState}
                           onLoad={onLoad} onUnmount={onUnmount}
                           options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: true }}
                      >
                          {pathCoordinates.length > 1 && (
                              <Polyline
                                   key={`poly-${activeDay}-${polylineKey}`}
                                   path={pathCoordinates}
                                   options={{ strokeColor: '#0d9488', strokeOpacity: 0.8, strokeWeight: 2 }}
                              />
                          )}

                          {mapElements.map((e, i) => (
                              <Marker key={`${e.id}-${activeDay}`} position={e.position} title={e.title} zIndex={e.zIndex} onClick={e.onClick}
                                   icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: e.iconColor, fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff', scale: e.type==='selected'?10:8 }}
                                   label={e.label ? { text: e.label, color: 'white', fontSize: '12px', fontWeight: 'bold' } : undefined}
                              />
                          ))}
                          {poiInfo && (
                              <InfoWindow position={poiInfo.position} onCloseClick={() => setPoiInfo(null)} options={{ pixelOffset: new window.google.maps.Size(0, -20) }}>
                                  <div className="p-1 max-w-[200px]">
                                      {poiImage && <img src={poiImage} className="w-full h-24 object-cover mb-2 rounded" alt={poiInfo.data.name}/>}
                                      <h3 className="font-bold text-sm mb-1">{poiInfo.data.name}</h3>
                                      <a href={poiInfo.data.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-2">{renderStars(poiInfo.data.rating)} <span>({poiInfo.data.user_ratings_total})</span></a>
                                      <div className="flex gap-2 mb-2 items-center text-gray-600 text-xs">{renderPrice(poiInfo.data.price_level)}</div>
                                      
                                      {/* --- AI 摘要區塊 (自動執行) --- */}
                                      <div className="mb-2">
                                          {poiInfo.aiSummary ? (
                                              <div className="bg-purple-50 border border-purple-100 p-2 rounded-lg text-xs text-purple-800 leading-relaxed">
                                                  <Sparkles size={10} className="inline mr-1 text-purple-600"/>
                                                  {poiInfo.aiSummary}
                                              </div>
                                          ) : isAnalyzing ? (
                                              <div className="w-full py-1.5 bg-gray-50 text-purple-600 text-xs font-medium rounded-lg flex items-center justify-center gap-1">
                                                  <Loader2 size={12} className="animate-spin"/> AI 正在分析這地點...
                                              </div>
                                          ) : null}
                                      </div>

                                      <div className="flex justify-between border-t pt-2 mt-2">
                                          <button onClick={() => toggleFavorite({ id: `place-${poiInfo.data.place_id}`, name: poiInfo.data.name, url: poiInfo.data.url })} className={`p-1.5 rounded ${isPoiFavorite?'text-orange-500 bg-orange-100':'text-gray-400 bg-gray-100'}`}><Heart size={14} fill={isPoiFavorite?"currentColor":"none"}/></button>
                                          <button onClick={() => { handleAddToItineraryRef.current({ id: `place-${poiInfo.data.place_id}`, name: poiInfo.data.name, type: 'spot', lat: poiInfo.data.geometry.location.lat(), lng: poiInfo.data.geometry.location.lng() }); setPoiInfo(null); }} className="text-xs bg-teal-600 text-white px-2 py-1 rounded flex gap-1 items-center"><Plus size={12}/> 加入</button>
                                      </div>
                                  </div>
                              </InfoWindow>
                          )}
                      </GoogleMap>
                  </div>
              )}
          </div>
      </aside>
  );
}