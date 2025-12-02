import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Wallet, Loader2, AlertTriangle, Star, ExternalLink, Plus, Heart, Search, MapPin } from 'lucide-react'; 
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api'; 

const containerStyle = {
  width: '100%',
  height: '100%'
};
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

    const onPlaceSelectRef = useRef(onPlaceSelect);
    const handleAddToItineraryRef = useRef(handleAddToItinerary);

    useEffect(() => {
        onPlaceSelectRef.current = onPlaceSelect;
        handleAddToItineraryRef.current = handleAddToItinerary;
    }, [onPlaceSelect, handleAddToItinerary]);

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
            if (event.placeId) {
                event.stop(); 
                const placeId = event.placeId;
                const service = new window.google.maps.places.PlacesService(map);

                service.getDetails({
                    placeId: placeId,
                    fields: ['name', 'formatted_address', 'geometry', 'rating', 'user_ratings_total', 'url', 'price_level', 'opening_hours', 'photos', 'types']
                }, (place, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                        setPoiInfo({
                            position: place.geometry.location,
                            data: { ...place, place_id: placeId }
                        });
                        if (onPlaceSelectRef.current) {
                            onPlaceSelectRef.current({
                                id: `place-${placeId}`,
                                name: place.name,
                                rating: place.rating, // 確保傳遞 rating
                                user_ratings_total: place.user_ratings_total, // 確保傳遞評價數
                                url: place.url, // 確保傳遞 Google Maps URL
                                pos: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
                                isPoi: true
                            });
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

    // --- 【關鍵修復】Selected Place Sync & Details Fetching ---
    useEffect(() => {
        if (!selectedPlace || !selectedPlace.lat || !selectedPlace.lng) return; 
        
        setCenterState({ lat: selectedPlace.lat, lng: selectedPlace.lng });
        setZoomState(15);
        setShowSearchButton(false); 

        const rawId = selectedPlace.id;
        const placeId = rawId && rawId.startsWith('place-') ? rawId.substring(6) : null;

        // 如果是已知的 POI 且資料齊全，直接顯示
        if (poiInfo && poiInfo.data && (`place-${poiInfo.data.place_id}` === rawId)) return;

        // 如果有 placeId，去 Google 抓詳細資料 (包含評論連結)
        if (placeId && mapRef.current && window.google) {
             const service = new window.google.maps.places.PlacesService(mapRef.current);
             service.getDetails({ 
                 placeId: placeId, 
                 fields: ['name', 'geometry', 'rating', 'user_ratings_total', 'url', 'price_level', 'opening_hours', 'photos'] 
             }, (place, status) => {
                if (status === 'OK') {
                    setPoiInfo({
                        position: place.geometry.location,
                        data: { ...place, place_id: placeId }
                    });
                } else {
                    // 如果抓不到 (例如是 AI 生成的假 ID)，就用 selectedPlace 既有的資料撐著
                    setPoiInfo({
                        position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
                        data: { 
                            name: selectedPlace.name, 
                            place_id: placeId || 'unknown',
                            rating: selectedPlace.rating, // 嘗試讀取傳入的 rating
                            user_ratings_total: selectedPlace.user_ratings_total,
                            url: selectedPlace.url // 嘗試讀取傳入的 url
                        }
                    });
                }
            });
        } else {
            // 如果沒有 placeId (純座標點)，直接用傳入資料顯示
            setPoiInfo({
                position: { lat: selectedPlace.lat, lng: selectedPlace.lng },
                data: { 
                    name: selectedPlace.name, 
                    place_id: 'custom',
                    rating: selectedPlace.rating,
                    url: selectedPlace.url
                }
            });
        }
    }, [selectedPlace]); 

    const { mapElements, pathCoordinates } = useMemo(() => {
        const elements = [];
        const path = [];
        
        let itineraryPins = resolvedLocations.filter(item => {
            const itemDay = Number(item.day || 1);
            return item.lat && item.lng && itemDay === activeDay;
        });

        itineraryPins.sort((a, b) => (a.order || 0) - (b.order || 0));

        itineraryPins.forEach((item, idx) => {
            const position = { lat: item.lat, lng: item.lng };
            path.push(position);
            let iconColor = '#0d9488'; 
            if (item.type === 'food') iconColor = '#f97316'; 
            if (item.type === 'hotel') iconColor = '#4f46e5'; 

            elements.push({
                type: 'itinerary', id: item.id, position: position, iconColor: iconColor, label: (idx + 1).toString(), title: item.name, zIndex: 2
            });
        });
        
        if (selectedPlace?.lat) {
            if (!itineraryPins.some(p => p.id === selectedPlace.id)) {
                elements.push({ type: 'selected', id: selectedPlace.id, position: {lat: selectedPlace.lat, lng: selectedPlace.lng}, iconColor: '#a855f7', label: null, title: selectedPlace.name, zIndex: 3, onClick: () => handleAddToItinerary({ ...selectedPlace, type: 'spot', pos: {lat: selectedPlace.lat, lng: selectedPlace.lng} }) });
            }
        }
        return { mapElements: elements, pathCoordinates: path };
    }, [resolvedLocations, sidebarTab, handleAddToItinerary, selectedPlace, activeDay]);

    const renderStars = (r) => {
        if (!r) return null;
        return <div className="flex items-center text-yellow-500"><span className="font-bold text-gray-900 mr-1">{r}</span><Star size={12} fill="currentColor"/></div>;
    };

    const renderPrice = (l) => l ? <div className="flex text-gray-600 text-xs">{[...Array(4)].map((_, i) => <span key={i} className={i < l ? "font-bold text-gray-900":"text-gray-300"}>$</span>)}</div> : null;
    const isPoiFavorite = poiInfo && myFavorites.some(f => f.id === `place-${poiInfo.data.place_id}`);

    // --- 產生 Google Maps 連結 (Fallback) ---
    const getGoogleMapsLink = (data) => {
        if (data.url) return data.url;
        const query = encodeURIComponent(data.name);
        return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${data.place_id}`;
    };

    return (
        <aside className="flex-1 min-w-[300px] bg-white border-l border-gray-200 flex flex-col z-20 hidden lg:flex">
            <div className="flex-1 bg-gray-100 relative overflow-hidden">
                {!isMapScriptLoaded ? (
                    <div className="flex-1 h-full bg-gray-200 animate-pulse flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 mr-2 animate-spin" />地圖服務載入中...</div>
                ) : (
                    <div className="relative w-full h-full">
                        {mapError === "API_DENIED" && <div className="absolute top-0 z-10 p-2 bg-red-50 w-full text-center text-red-700 text-xs">API 權限不足</div>}
                        {showSearchButton && <div className="absolute top-5 left-1/2 transform -translate-x-1/2 z-10"><button onClick={handleSearchAreaClick} className="bg-white text-teal-700 px-4 py-2 rounded-full shadow-md font-bold text-sm flex gap-2"><Search size={14}/> 搜尋此區域</button></div>}
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={centerState} zoom={zoomState} 
                            onLoad={onLoad} onUnmount={onUnmount}
                            options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: true }}
                        >
                            {pathCoordinates.length > 1 && (
                                <Polyline key={`poly-${activeDay}-${pathCoordinates.length}`} path={pathCoordinates} options={{ strokeColor: '#0d9488', strokeOpacity: 0.8, strokeWeight: 2 }} />
                            )}
                            {mapElements.map((e, i) => (
                                <Marker key={`${e.id}-${activeDay}`} position={e.position} title={e.title} zIndex={e.zIndex} onClick={e.onClick} 
                                    icon={{ path: window.google.maps.SymbolPath.CIRCLE, fillColor: e.iconColor, fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff', scale: e.type==='selected'?10:8 }} 
                                    label={e.label ? { text: e.label, color: 'white', fontSize: '12px', fontWeight: 'bold' } : undefined} 
                                />
                            ))}
                            
                            {/* --- InfoWindow 內容優化 --- */}
                            {poiInfo && (
                                <InfoWindow position={poiInfo.position} onCloseClick={() => setPoiInfo(null)} options={{ pixelOffset: new window.google.maps.Size(0, -20) }}>
                                    <div className="p-1 max-w-[200px] font-sans">
                                        {poiInfo.data.photos?.[0] && <img src={poiInfo.data.photos[0].getUrl({maxWidth: 200, maxHeight: 150})} className="w-full h-24 object-cover mb-2 rounded"/>}
                                        <h3 className="font-bold text-gray-900 text-sm mb-1">{poiInfo.data.name}</h3>
                                        
                                        {/* 點擊標題或評分都可跳轉 Google Maps */}
                                        <a 
                                            href={getGoogleMapsLink(poiInfo.data)} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline mb-2 group cursor-pointer"
                                        >
                                            <MapPin size={12} className="group-hover:text-blue-800"/>
                                            {poiInfo.data.rating ? (
                                                <>
                                                    {renderStars(poiInfo.data.rating)}
                                                    <span className="text-gray-500 ml-1">({poiInfo.data.user_ratings_total || 0})</span>
                                                </>
                                            ) : (
                                                <span>查看 Google 評價</span>
                                            )}
                                        </a>

                                        <div className="flex gap-2 mb-2 items-center text-gray-600 text-xs">{renderPrice(poiInfo.data.price_level)}</div>
                                        <div className="flex justify-between border-t pt-2 mt-2">
                                            <button onClick={() => toggleFavorite({ id: `place-${poiInfo.data.place_id}`, name: poiInfo.data.name, url: getGoogleMapsLink(poiInfo.data), rating: poiInfo.data.rating })} className={`p-1.5 rounded ${isPoiFavorite?'text-orange-500 bg-orange-100':'text-gray-400 bg-gray-100'}`}><Heart size={14} fill={isPoiFavorite?"currentColor":"none"}/></button>
                                            <button onClick={() => { handleAddToItineraryRef.current({ id: `place-${poiInfo.data.place_id}`, name: poiInfo.data.name, type: 'spot', lat: poiInfo.data.geometry.location.lat(), lng: poiInfo.data.geometry.location.lng(), rating: poiInfo.data.rating, url: getGoogleMapsLink(poiInfo.data) }); setPoiInfo(null); }} className="text-xs bg-teal-600 text-white px-2 py-1 rounded flex gap-1 items-center"><Plus size={12}/> 加入</button>
                                        </div>
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    </div>
                )}
            </div>
            {/* 預算概覽 (保持不變) */}
            <div className="h-1/3 border-t border-gray-200 p-5 bg-white">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Wallet size={16} className="text-teal-600"/> 預算概覽</h3>
                <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between"><span>住宿</span> <span className="font-mono">TWD 3,200</span></div>
                    <div className="flex justify-between"><span>餐飲</span> <span className="font-mono">TWD 2,500</span></div>
                    <div className="flex justify-between"><span>交通/門票</span> <span className="font-mono">TWD 800</span></div>
                    <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between font-bold text-gray-900 text-base"><span>總計</span> <span>TWD 6,500</span></div>
                </div>
            </div>
        </aside>
    );
}