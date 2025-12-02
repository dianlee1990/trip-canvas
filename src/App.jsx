import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, query, writeBatch } from 'firebase/firestore';
import { auth, db } from './utils/firebase';

import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import MapZone from './components/MapZone';
import AIGenerationModal from './components/modals/AIGenerationModal';
import Dashboard from './components/Dashboard'; 

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ["places"];
const DEFAULT_CENTER = { lat: 35.700, lng: 139.770 }; 
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 【核心修復】時間計算邏輯 ---
const recalculateTimes = (items) => {
    // 1. 排序：Day -> Order -> StartTime
    const sortedItems = [...items].sort((a, b) => {
        const dayA = Number(a.day || 1);
        const dayB = Number(b.day || 1);
        if (dayA !== dayB) return dayA - dayB;
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        // Fallback: 如果沒 order 才看時間
        const tA = a.startTime ? parseInt(a.startTime.replace(':', '')) : 9999;
        const tB = b.startTime ? parseInt(b.startTime.replace(':', '')) : 9999;
        return tA - tB;
    });

    let currentDay = -1;
    let currentHour = 9; 
    let currentMinute = 0;

    return sortedItems.map((item) => {
        const itemDay = Number(item.day || 1);

        // 如果換天了，強制重置為 09:00
        if (itemDay !== currentDay) {
            currentDay = itemDay;
            currentHour = 9;
            currentMinute = 0;
        }

        // 如果 AI 或用戶有指定 startTime
        if (item.startTime) {
            const [h, m] = item.startTime.split(':').map(Number);
            if (!isNaN(h)) {
                // 邏輯判斷：如果指定時間比目前累加時間「晚」，就跳過去（空檔時間）
                // 如果指定時間比目前累加時間「早」，表示行程衝突，這裡我們選擇「順延」以保持合理性
                // 或者，如果是該天的第一站，絕對服從指定時間
                const currentTimeVal = currentHour * 60 + currentMinute;
                const specifiedTimeVal = h * 60 + m;

                if (currentTimeVal <= specifiedTimeVal || (currentHour === 9 && currentMinute === 0)) {
                     currentHour = h;
                     currentMinute = m || 0;
                }
            }
        }

        // 格式化時間字串
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const duration = Number(item.duration || item.suggestedDuration || 60);
        
        const updatedItem = { 
            ...item, 
            time: timeStr, 
            suggestedDuration: duration 
        };

        // 累加時間給下一站
        currentMinute += duration;
        while (currentMinute >= 60) {
            currentMinute -= 60;
            currentHour += 1;
        }
        // 簡單防呆：超過 24 點就當作 23:59 或跨日
        if (currentHour >= 24) {
            currentHour = 23;
            currentMinute = 59;
        }

        return updatedItem;
    });
};

const MainEditor = ({ isLoaded, loadError, currentTrip, onBack, user }) => {
    const [sidebarTab, setSidebarTab] = useState('search'); 
    const [activeDay, setActiveDay] = useState(1);
    const [itinerary, setItinerary] = useState([]); 
    const [myFavorites, setMyFavorites] = useState([]); 
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiStatus, setAiStatus] = useState("正在啟動 AI 引擎...");
    const [mapInstance, setMapInstance] = useState(null);
    const [mapCenter, setMapCenter] = useState(currentTrip?.center || DEFAULT_CENTER);
    const [selectedPlace, setSelectedPlace] = useState(null); 
    const [mapBounds, setMapBounds] = useState(null); 
    const [activeDragItem, setActiveDragItem] = useState(null);

    useEffect(() => { if (currentTrip?.center) setMapCenter(currentTrip.center); }, [currentTrip]);

    useEffect(() => {
        if (!user || !currentTrip?.id) return;
        const itemsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'trips', currentTrip.id, 'items');
        const q = query(itemsRef, orderBy('order', 'asc')); 
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItinerary(recalculateTimes(items));
        });
        return () => unsubscribe();
    }, [user, currentTrip?.id]);

    const handleUpdateTrip = useCallback(async (updatedFields) => {
        if (!user || !currentTrip?.id) return;
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'trips', currentTrip.id), { ...updatedFields, updatedAt: serverTimestamp() });
    }, [user, currentTrip?.id]);

    const handleUpdateItem = useCallback(async (itemId, updatedFields) => {
        if (!user || !currentTrip?.id) return;
        try {
            const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'trips', currentTrip.id, 'items', itemId);
            await updateDoc(itemRef, updatedFields);
        } catch (e) { console.error("Error updating item:", e); }
    }, [user, currentTrip?.id]);

    const handlePlaceSelect = useCallback((place) => {
        setSelectedPlace(place); 
        if (mapInstance && place?.pos) { mapInstance.panTo(place.pos); mapInstance.setZoom(15); }
    }, [mapInstance]);

    const toggleFavorite = useCallback((item) => {
        setMyFavorites(prev => prev.find(f => f.id === item.id) ? prev.filter(f => f.id !== item.id) : [...prev, item]);
    }, []);

    const handleAddToItinerary = useCallback(async (item) => {
        if (!user || !currentTrip?.id) return;
        const rawId = item.place_id ?? item.id;
        const safeId = rawId ? String(rawId) : `temp-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        
        // 找出目前該天最大的 order
        const currentDayItems = itinerary.filter(i => (i.day || 1) === activeDay);
        const maxOrder = currentDayItems.length > 0 ? Math.max(...currentDayItems.map(i => i.order || 0)) : 0;

        const newItem = {
            place_id: safeId, name: item.name ?? '未知地點', type: item.type ?? 'spot', image: item.image ?? '',
            aiSummary: item.aiSummary ?? '', tags: Array.isArray(item.tags) ? item.tags : [],
            lat: Number(item.lat ?? item.pos?.lat ?? 0), lng: Number(item.lng ?? item.pos?.lng ?? 0),
            rating: Number(item.rating ?? 0), price_level: Number(item.price_level ?? 0),
            day: Number(item.day || activeDay), startTime: item.startTime ?? null, duration: Number(item.duration ?? 60),
            order: maxOrder + 1, createdAt: serverTimestamp() 
        };
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'trips', currentTrip.id, 'items'), newItem);
    }, [user, currentTrip?.id, activeDay, itinerary]);

    const handleRemoveFromItinerary = useCallback(async (id) => {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'trips', currentTrip.id, 'items', id));
    }, [user, currentTrip?.id]);

    const handleAIGenerate = useCallback(async (generatedData) => {
        setIsAIModalOpen(false); setIsGenerating(false); setAiStatus("排程完成");
        if (!user || !currentTrip?.id) return;
        
        // 樂觀更新 (先在本地排序好再 setState)
        const preparedItems = generatedData.map((item, index) => {
            const rawId = item.place_id ?? item.id;
            const uniqueSuffix = `${Date.now()}-${index}-${Math.floor(Math.random()*1000)}`;
            const safeId = rawId ? String(rawId) : `ai-${uniqueSuffix}`;
            
            return {
                id: safeId, place_id: safeId, name: item.name ?? 'AI', type: item.type ?? 'spot', image: item.image ?? '',
                aiSummary: item.aiSummary ?? '', tags: item.tags || [], 
                lat: Number(item.pos?.lat ?? 0), lng: Number(item.pos?.lng ?? 0),
                rating: 0, price_level: 0, day: Number(item.day || 1), 
                startTime: item.startTime ?? null, duration: Number(item.duration ?? 60), 
                order: index, // 重要：給予明確順序
                createdAt: new Date()
            };
        });
        
        setItinerary(prev => recalculateTimes([...prev, ...preparedItems]));

        try {
            const batch = writeBatch(db);
            const itemsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'trips', currentTrip.id, 'items');
            preparedItems.forEach((item) => {
                const newDocRef = doc(itemsRef); 
                const { id, ...dataToWrite } = item;
                batch.set(newDocRef, { ...dataToWrite, createdAt: serverTimestamp() });
            });
            await batch.commit();
        } catch (e) { console.error(e); }
    }, [user, currentTrip?.id]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    
    const handleDragStart = (event) => setActiveDragItem(event.active.data.current?.item || null);

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveDragItem(null);
        if (!over) return;
        if (active.data.current?.type === 'sidebar-item') {
            handleAddToItinerary(active.data.current.item);
            return;
        }
        if (active.id !== over.id) {
            const oldIndex = itinerary.findIndex((item) => item.id === active.id);
            const newIndex = itinerary.findIndex((item) => item.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return;

            const newItinerary = arrayMove(itinerary, oldIndex, newIndex);
            
            // 立即在本地更新並重算時間
            setItinerary(recalculateTimes(newItinerary));
            
            if (user && currentTrip?.id) {
                try {
                    const batch = writeBatch(db);
                    // 重刷所有項目的 order，確保順序正確
                    newItinerary.forEach((item, index) => {
                        const itemRef = doc(db, 'artifacts', appId, 'users', user.uid, 'trips', currentTrip.id, 'items', item.id);
                        batch.update(itemRef, { order: index });
                    });
                    await batch.commit();
                } catch (e) { console.error("Reorder failed:", e); }
            }
        }
    };

    if (loadError) return <div>Map Error</div>;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col h-screen overflow-hidden font-sans relative">
                <div className="flex-1 flex overflow-hidden">
                    <Sidebar sidebarTab={sidebarTab} setSidebarTab={setSidebarTab} myFavorites={myFavorites} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} isMapScriptLoaded={isLoaded} mapInstance={mapInstance} mapCenter={mapCenter} onPlaceSelect={handlePlaceSelect} mapBounds={mapBounds} onBack={onBack}/>
                    <Canvas activeDay={activeDay} setActiveDay={setActiveDay} currentTrip={currentTrip} handleUpdateTrip={handleUpdateTrip} itinerary={itinerary} isGenerating={isGenerating} aiStatus={aiStatus} setIsAIModalOpen={setIsAIModalOpen} handleRemoveFromItinerary={handleRemoveFromItinerary} onPlaceSelect={handlePlaceSelect} onBack={onBack} handleUpdateItem={handleUpdateItem}/>
                    <MapZone sidebarTab={sidebarTab} itinerary={itinerary} handleAddToItinerary={handleAddToItinerary} isMapScriptLoaded={isLoaded} setMapInstance={setMapInstance} setMapCenter={setMapCenter} mapCenter={mapCenter} selectedPlace={selectedPlace} onPlaceSelect={handlePlaceSelect} setMapBounds={setMapBounds} myFavorites={myFavorites} toggleFavorite={toggleFavorite} activeDay={activeDay}/>
                </div>
                <AIGenerationModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerate={handleAIGenerate} userFavorites={myFavorites} isGenerating={isGenerating} setIsGenerating={setIsGenerating} setAiStatus={setAiStatus} currentTrip={currentTrip} existingItinerary={itinerary} />
                <DragOverlay dropAnimation={null}>{activeDragItem && <div className="bg-white p-3 rounded-lg shadow-2xl border-2 border-teal-500 w-64 opacity-90"><div className="font-bold text-sm text-gray-800">{activeDragItem.name}</div></div>}</DragOverlay>
            </div>
        </DndContext>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('dashboard');
    const [currentTrip, setCurrentTrip] = useState(null);
    const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey, libraries });
    useEffect(() => onAuthStateChanged(auth, u => { setUser(u); if(!u) { setView('dashboard'); setCurrentTrip(null); } }), []);
    return view === 'dashboard' ? <Dashboard user={user} onSelectTrip={(t) => { setCurrentTrip(t); setView('canvas'); }} isMapScriptLoaded={isLoaded}/> : <MainEditor key={currentTrip?.id} isLoaded={isLoaded} loadError={loadError} currentTrip={currentTrip} onBack={() => { setView('dashboard'); setCurrentTrip(null); }} user={user}/>;
}