import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
// 🟢 修正：補上 Sparkles, Wallet, AlertTriangle, MapPin, DollarSign 等所有用到的 Icon
import { Wallet, Loader2, AlertTriangle, Star, Plus, Heart, Search, MapPin, Sparkles, Clock, DollarSign } from 'lucide-react';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { runGemini } from '../utils/gemini';

const containerStyle = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 35.700, lng: 139.770 };

export default function MapZone({
  sidebarTab, itinerary, handleAddToItinerary, isMapScriptLoaded,
  setMapInstance, setMapCenter, mapCenter,
  selectedPlace, onMapPoiClick, setMapBounds,
  onPlaceSelect,
  myFavorites = [],
  toggleFavorite = () => { },
  activeDay,
  currentTrip
}) {
  const mapRef = useRef(null);
  const [poiInfo, setPoiInfo] = useState(null);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const onPlaceSelectRef = useRef(onPlaceSelect);
  const handleAddToItineraryRef = useRef(handleAddToItinerary);
  const itineraryRef = useRef(itinerary);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
    handleAddToItineraryRef.current = handleAddToItinerary;
    itineraryRef.current = itinerary;
  }, [onPlaceSelect, handleAddToItinerary, itinerary]);

  const [resolvedLocations, setResolvedLocations] = useState([]);
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

  const fetchGoogleDetails = useCallback((rawId, name, currentData, callback) => {
    if (!mapRef.current) return;
    const service = new window.google.maps.places.PlacesService(mapRef.current);
    const requestFields = ['name', 'rating', 'user_ratings_total', 'url', 'price_level', 'opening_hours', 'formatted_address', 'photos'];
    const performGetDetails = (placeId) => {
      service.getDetails({ placeId, fields: requestFields }, (details, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && details) {
          callback({ ...currentData, ...details, place_id: placeId });
        }
      });
    };
    if (rawId && typeof rawId === 'string' && rawId.startsWith('ChIJ')) {
      performGetDetails(rawId);
    } else if (name) {
      service.findPlaceFromQuery({ query: name, fields: ['place_id', 'geometry'] }, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
          performGetDetails(results[0].place_id);
        }
      });
    }
  }, []);

  const generateAiPrompt = (placeName) => `請用繁體中文，30字以內簡短介紹「 ${placeName} 」。 \n\n 【摘要邏輯】 \n 1. **店家/餐廳**：提供「最熱銷/必點」品項。 \n 2. **景點**：提供「必看」特色。 \n\n 請直接輸出內容，不要有前言後語。`;

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    if (setMapInstance) setMapInstance(map);
    map.addListener('idle', () => setShowSearchButton(true));
    map.addListener('dragstart', () => setShowSearchButton(false));
    map.addListener('click', (event) => {
      setPoiInfo(null);
      setIsAnalyzing(false);
      if (event.placeId) {
        event.stop();
        const placeId = event.placeId;
        const service = new window.google.maps.places.PlacesService(map);
        service.getDetails({
          placeId: placeId,
          fields: ['name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total', 'url', 'price_level', 'opening_hours', 'photos', 'types']
        }, async (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            const currentItinerary = itineraryRef.current || [];
            const existingItem = currentItinerary.find(item => (item.place_id === placeId) || (item.name === place.name));
            const hasExistingSummary = !!existingItem?.aiSummary;

            setPoiInfo({
              position: place.geometry.location,
              data: { ...place, place_id: placeId },
              aiSummary: hasExistingSummary ? existingItem.aiSummary : null
            });

            if (onPlaceSelectRef.current) {
              onPlaceSelectRef.current({
                id: `place-${placeId}`, name: place.name,
                pos: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }, isPoi: true
              });
            }

            if (!hasExistingSummary) {
              setIsAnalyzing(true);
              try {
                const prompt = generateAiPrompt(place.name);
                const summary = await runGemini(prompt);
                setPoiInfo(prev => {
                  if (prev && prev.data.place_id === placeId) {
                    return { ...prev, aiSummary: summary };
                  }
                  return prev;
                });
              } catch (error) {
                console.error("AI Analysis Failed:", error);
                setPoiInfo(prev => prev && prev.data.place_id === placeId ? { ...prev, aiSummary: "暫時無法分析此地點。" } : prev);
              } finally {
                setIsAnalyzing(false);
              }
            }
          }
        });
      }
    });
  }, [setMapInstance]);

  const onUnmount = useCallback(() => {
    if (mapRef.current) window.google.maps.event.clearInstanceListeners(mapRef.current);
    mapRef.current = null;
    if (setMapInstance) setMapInstance(null);
  }, [setMapInstance]);

  const geocodePlace = useCallback((query, context, map) => {
    return new Promise((resolve, reject) => {
      if (!map || !window.google || !window.google.maps.Geocoder) return reject(new Error("Service unavailable"));
      const geocoder = new window.google.maps.Geocoder();
      const searchQuery = context ? `${context} ${query}` : query;

      geocoder.geocode({ address: searchQuery }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng(), name: query });
        } else {
          if (context) {
            geocoder.geocode({ address: query }, (res2, stat2) => {
              if (stat2 === 'OK' && res2[0]) {
                const loc = res2[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng(), name: query });
              } else {
                reject(new Error("Not found"));
              }
            });
          } else {
            reject(new Error("Not found"));
          }
        }
      });
    });
  }, []);

  useEffect(() => {
    if (!isMapScriptLoaded || !mapRef.current) return;
    const itemsToGeocode = itinerary.filter(item => item.type !== 'connection' && (!item.lat || !item.lng));
    const destinationContext = currentTrip?.destination || "";

    Promise.all(itemsToGeocode.map(async (item) => {
      try {
        const { lat, lng } = await geocodePlace(item.name, destinationContext, mapRef.current);
        return { ...item, lat, lng };
      } catch (e) { return item; }
    })).then(newLocations => {
      const newResolvedMap = new Map();
      newLocations.filter(item => item.lat).forEach(item => newResolvedMap.set(item.id, item));
      itinerary.filter(item => item.type !== 'connection' && item.lat).forEach(item => newResolvedMap.set(item.id, item));
      setResolvedLocations(Array.from(newResolvedMap.values()));
    });
  }, [itinerary, isMapScriptLoaded, geocodePlace, currentTrip]);

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

  useEffect(() => {
    if (!selectedPlace || !selectedPlace.lat || !selectedPlace.lng) return;
    setCenterState({ lat: selectedPlace.lat, lng: selectedPlace.lng });
    setZoomState(15);
    setShowSearchButton(false);

    const placeId = selectedPlace.id;
    let rawPlaceId = selectedPlace.place_id || placeId;
    if (typeof rawPlaceId === 'string') rawPlaceId = rawPlaceId.replace(/^(ai-|place-|sidebar-)/, '');
    const isTempId = rawPlaceId && (rawPlaceId.startsWith('temp-') || rawPlaceId.includes('lat-'));
    // Google Maps URL 修正
    const googleUrl = selectedPlace.url || `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(selectedPlace.name)}${!isTempId ? `&query_place_id=${rawPlaceId}` : ''}`;
    
    const currentItinerary = itineraryRef.current || [];
    const existingItem = currentItinerary.find(i => i.id === placeId);
    const hasSummary = existingItem?.aiSummary || selectedPlace.aiReason;

    setPoiInfo({
      position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
      data: { ...selectedPlace, place_id: rawPlaceId, url: googleUrl },
      aiSummary: hasSummary || null
    });

    if (mapRef.current && rawPlaceId && !isTempId && (!selectedPlace.rating || !selectedPlace.user_ratings_total || !selectedPlace.url || !selectedPlace.image)) {
      fetchGoogleDetails(rawPlaceId, selectedPlace.name, selectedPlace, (updatedData) => {
        setPoiInfo(prev => {
          if (prev && prev.data.name === updatedData.name) {
            return { ...prev, data: { ...prev.data, ...updatedData } };
          }
          return prev;
        });
      });
    }

    if (!hasSummary) {
      setIsAnalyzing(true);
      runGemini(generateAiPrompt(selectedPlace.name))
        .then(res => setPoiInfo(prev => prev && prev.data.name === selectedPlace.name ? { ...prev, aiSummary: res } : prev))
        .catch(e => { console.error("Auto-analyze failed", e); setPoiInfo(prev => prev && prev.data.name === selectedPlace.name ? { ...prev, aiSummary: "暫時無法分析" } : prev); })
        .finally(() => setIsAnalyzing(false));
    } else {
      setIsAnalyzing(false);
    }
  }, [selectedPlace, fetchGoogleDetails]);

  const { mapElements, pathCoordinates, polylineKey } = useMemo(() => {
    const elements = [];
    const path = [];

    let itineraryPins = resolvedLocations.filter(item => {
      const itemDay = Number(item.day || 1);
      return item.lat && item.lng && itemDay === Number(activeDay);
    });

    // 🟢 同步 Canvas 的時間排序邏輯
    itineraryPins.sort((a, b) => {
        const getMins = (t) => {
            if(!t) return 9999;
            const [h,m] = t.split(':').map(Number);
            return h*60+(m||0);
        }
        const timeDiff = getMins(a.startTime) - getMins(b.startTime);
        if (timeDiff !== 0) return timeDiff;
        return (a.order || 0) - (b.order || 0);
    });
    
    const currentPolylineKey = itineraryPins.map(p => p.id).join('-');

    itineraryPins.forEach((item, idx) => {
      const position = { lat: item.lat, lng: item.lng };
      path.push(position);
      
      const isAi = item.source === 'ai' || (item.id && item.id.startsWith('ai-'));
      let fillColor = isAi ? '#9333ea' : '#0f766e'; 

      elements.push({
        type: 'itinerary',
        id: item.id,
        position: position,
        icon: {
           path: window.google.maps.SymbolPath.CIRCLE,
           fillColor: fillColor,
           fillOpacity: 1,
           strokeWeight: 3,
           strokeColor: '#ffffff',
           scale: 12
        },
        label: { 
            text: (idx + 1).toString(), 
            color: 'white', 
            fontSize: '14px', 
            fontWeight: 'bold' 
        },
        title: item.name,
        zIndex: 100 + idx,
        onClick: () => {
          let rawId = item.place_id || item.id;
          if (typeof rawId === 'string') rawId = rawId.replace(/^(ai-|place-|sidebar-)/, '');
          const isTempId = rawId && (rawId.startsWith('temp-') || rawId.includes('lat-'));
          const googleUrl = item.url || `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(item.name)}${!isTempId ? `&query_place_id=${rawId}` : ''}`;
          
          const initialData = { name: item.name, rating: item.rating, user_ratings_total: item.user_ratings_total, price_level: item.price_level, place_id: rawId, url: googleUrl, image: item.image };
          setPoiInfo({ position: position, data: initialData, aiSummary: item.aiSummary });
          if (mapRef.current && rawId && !isTempId && (!item.rating || !item.url || !item.user_ratings_total || !item.image)) {
            fetchGoogleDetails(rawId, item.name, initialData, (updatedData) => {
              setPoiInfo(prev => prev && prev.data.name === updatedData.name ? { ...prev, data: { ...prev.data, ...updatedData } } : prev);
            });
          }
        }
      });
    });

    if (selectedPlace?.lat) {
      if (!itineraryPins.some(p => p.id === selectedPlace.id)) {
        elements.push({
          type: 'selected', id: selectedPlace.id, position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
          icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#ec4899', // Pink
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#ffffff',
              scale: 12
          },
          label: null, 
          title: selectedPlace.name, zIndex: 200,
          onClick: () => handleAddToItinerary({ ...selectedPlace, type: 'spot', pos: { lat: selectedPlace.lat, lng: selectedPlace.lng } })
        });
      }
    }

    return { mapElements: elements, pathCoordinates: path, polylineKey: currentPolylineKey };
  }, [resolvedLocations, sidebarTab, handleAddToItinerary, selectedPlace, activeDay, fetchGoogleDetails]);

  const renderStars = (r, count) => (!r && !count) ?
    <span> 在 Google 地圖上查看 </span> : (<div className="flex text-yellow-500"><span className="font-bold text-gray-900 mr-1">{r}</span><Star size={12} fill="currentColor" />{count && <span className="text-gray-500 ml-1">({count})</span>}</div>);
  const renderPrice = (l) => l ?
    <div className="flex text-gray-600 text-xs">{[...Array(4)].map((_, i) => <span key={i} className={i < l ? "font-bold text-gray-900" : "text-gray-300"}>$</span>)}</div> : null;
  const isPoiFavorite = poiInfo && myFavorites.some(f => f.id === `place-${poiInfo.data.place_id}`);
  const poiImage = poiInfo?.data?.photos?.[0]?.getUrl({ maxWidth: 200, maxHeight: 150 }) || poiInfo?.data?.image;
  const openStatus = poiInfo?.data?.opening_hours?.isOpen?.() ?? null;

  return (
    <aside className="w-full h-full bg-white flex flex-col z-20">
      <div className="flex-1 bg-gray-100 relative overflow-hidden h-full w-full">
        {!isMapScriptLoaded ? (
          <div className="flex-1 h-full bg-gray-200 animate-pulse flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 mr-2 animate-spin" /> 地圖服務載入中... </div>
        ) : (
          <div className="relative w-full h-full">
            {showSearchButton && <div className="absolute top-5 left-1/2 transform -translate-x-1/2 z-10"><button onClick={handleSearchAreaClick} className="bg-white text-teal-700 px-4 py-2 rounded-full shadow-md font-bold text-sm flex gap-2"><Search size={14} /> 搜尋此區域 </button></div>}
            <GoogleMap mapContainerStyle={containerStyle} center={centerState} zoom={zoomState} onLoad={onLoad} onUnmount={onUnmount} options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: true }}>
              {pathCoordinates.length > 1 && <Polyline key={`poly-${activeDay}-${polylineKey}`} path={pathCoordinates} options={{ strokeColor: '#0d9488', strokeOpacity: 0.8, strokeWeight: 2 }} />}
              {mapElements.map((e, i) => (
                <Marker key={`${e.id}-${activeDay}`} position={e.position} title={e.title} zIndex={e.zIndex} onClick={e.onClick} 
                  icon={e.icon} label={e.label} 
                />
              ))}
              {poiInfo && (
                <InfoWindow position={poiInfo.position} onCloseClick={() => setPoiInfo(null)} options={{ pixelOffset: new window.google.maps.Size(0, -20) }}>
                  <div className="p-1 max-w-[200px]">
                    {poiImage && <img src={poiImage} className="w-full h-24 object-cover mb-2 rounded" alt={poiInfo.data.name} />}
                    <h3 className="font-bold text-sm mb-1">{poiInfo.data.name}</h3>
                    <a href={poiInfo.data.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-2">{renderStars(poiInfo.data.rating, poiInfo.data.user_ratings_total)}</a>
                    <div className="flex items-center gap-3 mb-2 text-xs">{renderPrice(poiInfo.data.price_level)}{openStatus !== null && (<span className={`font-medium flex items-center gap-1 ${openStatus ? 'text-green-600' : 'text-red-600'}`}><Clock size={10} /> {openStatus ? '營業中' : '休息中'}</span>)}</div>
                    <div className="mb-2">{poiInfo.aiSummary ? (<div className="bg-purple-50 border border-purple-100 p-2 rounded-lg text-xs text-purple-800 leading-relaxed"><Sparkles size={10} className="inline mr-1 text-purple-600" />{poiInfo.aiSummary}</div>) : isAnalyzing ?
                      (<div className="w-full py-1.5 bg-gray-50 text-purple-600 text-xs font-medium rounded-lg flex items-center justify-center gap-1"><Loader2 size={12} className="animate-spin" /> AI 正在分析這地點... </div>) : null}</div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <button onClick={() => toggleFavorite({ id: `place-${poiInfo.data.place_id}`, name: poiInfo.data.name, url: poiInfo.data.url })} className={`p-1.5 rounded ${isPoiFavorite ?
                        'text-orange-500 bg-orange-100' : 'text-gray-400 bg-gray-100'}`}><Heart size={14} fill={isPoiFavorite ? "currentColor" : "none"} /></button>
                      <button onClick={() => { handleAddToItineraryRef.current({ id: `place-${poiInfo.data.place_id}`, name: poiInfo.data.name, type: 'spot', lat: poiInfo.data.geometry.location.lat(), lng: poiInfo.data.geometry.location.lng() }); setPoiInfo(null);
                      }} className="text-xs bg-teal-600 text-white px-2 py-1 rounded flex gap-1 items-center"><Plus size={12} /> 加入 </button>
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