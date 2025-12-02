// App.jsx (Refactored for Routing)
import React, { useState, useCallback, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, query, writeBatch, getDoc } from 'firebase/firestore';
import { auth, db } from './utils/firebase';
// 新增：引入路由元件
import { BrowserRouter, Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import MapZone from './components/MapZone';
import AIGenerationModal from './components/modals/AIGenerationModal';
import Dashboard from './components/Dashboard';

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ["places"];
const DEFAULT_CENTER = { lat: 35.700, lng: 139.770 };
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 時間重算邏輯 (保持不變) ---
const recalculateTimes = (items) => {
    // ... 請將原本 App.jsx 的 recalculateTimes 完整程式碼貼回來 (source: 1734-1793) ...
    // 為了節省篇幅，這裡省略，請務必複製貼上原本的邏輯
    const sortedItems = [...items].sort((a,b)=>{
        const da = Number(a.day||1), db=Number(b.day||1);
        if(da!==db) return da-db;
        return (a.order||0)-(b.order||0);
    });
    let cD=-1, cH=9, cM=0;
    return sortedItems.map(item=>{
        const iD = Number(item.day||1);
        if(iD!==cD){cD=iD;cH=9;cM=0;}
        if(item.startTime){
            const [h,m]=item.startTime.split(':').map(Number);
            if(!isNaN(h) && (cH*60+cM <= h*60+m || (cH===9&&cM===0))) {cH=h;cM=m||0;}
        }
        const dur = Number(item.duration||item.suggestedDuration||60);
        const timeStr = `${String(cH).padStart(2,'0')}:${String(cM).padStart(2,'0')}`;
        const upd = {...item, time: timeStr, suggestedDuration: dur};
        cM+=dur;
        while(cM>=60){cM-=60;cH+=1;}
        if(cH>=24){cH=23;cM=59;}
        return upd;
    });
};

// --- MainEditor (現在變成一個獨立的頁面元件) ---
const EditorPage = ({ isLoaded, user }) => {
  const { tripId } = useParams(); // 從網址抓 ID
  const navigate = useNavigate();
  
  const [currentTrip, setCurrentTrip] = useState(null);
  const [tripLoading, setTripLoading] = useState(true);
  const [error, setError] = useState(null);

  // 編輯器狀態
  const [sidebarTab, setSidebarTab] = useState('search');
  const [activeDay, setActiveDay] = useState(1);
  const [itinerary, setItinerary] = useState([]);
  const [myFavorites, setMyFavorites] = useState([]);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState("正在啟動 AI 引擎...");
  const [mapInstance, setMapInstance] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);

  // 1. 根據 URL ID 抓取行程資料 (解決重新整理消失的問題)
  useEffect(() => {
    if (!tripId || !user) return;
    setTripLoading(true);
    
    // 改為監聽 artifacts/{appId}/trips/{tripId} (全域)
    const tripRef = doc(db, 'artifacts', appId, 'trips', tripId);
    
    const unsubscribe = onSnapshot(tripRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // 權限檢查：如果你不在名單內，踢出去
            if (data.collaborators && !data.collaborators.includes(user.uid)) {
                setError("您沒有權限編輯此行程");
                setTripLoading(false);
                return;
            }
            setCurrentTrip({ id: docSnap.id, ...data });
            if (data.center) setMapCenter(data.center);
            setTripLoading(false);
        } else {
            setError("找不到此行程");
            setTripLoading(false);
        }
    }, (err) => {
        console.error("Fetch Trip Error:", err);
        setError("讀取行程失敗");
        setTripLoading(false);
    });

    return () => unsubscribe();
  }, [tripId, user]);

  // 2. 監聽該行程的 items (子集合)
  useEffect(() => {
    if (!tripId) return;
    // 路徑改為: artifacts/{appId}/trips/{tripId}/items
    const itemsRef = collection(db, 'artifacts', appId, 'trips', tripId, 'items');
    const q = query(itemsRef, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItinerary(recalculateTimes(items));
    });
    return () => unsubscribe();
  }, [tripId]);

  // --- 以下 Handler 邏輯稍微調整路徑，其他邏輯不變 ---

  const handleUpdateTrip = useCallback(async (updatedFields) => {
    if (!tripId) return;
    // 路徑改為全域
    await updateDoc(doc(db, 'artifacts', appId, 'trips', tripId), { ...updatedFields, updatedAt: serverTimestamp() });
  }, [tripId]);

  const handleUpdateItem = useCallback(async (itemId, updatedFields) => {
    if (!tripId) return;
    const itemRef = doc(db, 'artifacts', appId, 'trips', tripId, 'items', itemId);
    await updateDoc(itemRef, updatedFields);
  }, [tripId]);

  const handlePlaceSelect = useCallback((place) => {
    setSelectedPlace(place);
    if (mapInstance && place?.pos) { mapInstance.panTo(place.pos); mapInstance.setZoom(15); }
  }, [mapInstance]);

  const toggleFavorite = useCallback((item) => {
    setMyFavorites(prev => prev.find(f => f.id === item.id) ? prev.filter(f => f.id !== item.id) : [...prev, item]);
  }, []);

  const handleAddToItinerary = useCallback(async (item) => {
    if (!tripId) return;
    const rawId = item.place_id ?? item.id;
    const safeId = rawId ? String(rawId) : `temp-${Date.now()}`;
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
    await addDoc(collection(db, 'artifacts', appId, 'trips', tripId, 'items'), newItem);
  }, [tripId, activeDay, itinerary]);

  const handleRemoveFromItinerary = useCallback(async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'trips', tripId, 'items', id));
  }, [tripId]);

  const handleAIGenerate = useCallback(async (generatedData) => {
    setIsAIModalOpen(false); setIsGenerating(false); setAiStatus("排程完成");
    if (!tripId) return;

    const preparedItems = generatedData.map((item, index) => {
      const rawId = item.place_id ?? item.id;
      const safeId = rawId ? String(rawId) : `ai-${Date.now()}-${index}`;
      return {
        id: safeId, place_id: safeId, name: item.name ?? 'AI', type: item.type ?? 'spot', image: item.image ?? '',
        aiSummary: item.aiSummary ?? '', tags: item.tags || [],
        lat: Number(item.pos?.lat ?? 0), lng: Number(item.pos?.lng ?? 0),
        rating: 0, price_level: 0, day: Number(item.day || 1),
        startTime: item.startTime ?? null, duration: Number(item.duration ?? 60),
        order: index, createdAt: new Date()
      };
    });
    // Optimistic Update
    setItinerary(prev => recalculateTimes([...prev, ...preparedItems]));

    try {
      const batch = writeBatch(db);
      const itemsRef = collection(db, 'artifacts', appId, 'trips', tripId, 'items');
      preparedItems.forEach((item) => {
        const newDocRef = doc(itemsRef);
        const { id, ...dataToWrite } = item;
        batch.set(newDocRef, { ...dataToWrite, createdAt: serverTimestamp() });
      });
      await batch.commit();
    } catch (e) { console.error(e); }
  }, [tripId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragStart = (event) => setActiveDragItem(event.active.data.current?.item || null);
  
  const handleDragEnd = async (event) => {
      const { active, over } = event;
      setActiveDragItem(null);
      if (!over) return;
      if (active.data.current?.type === 'sidebar-item') { handleAddToItinerary(active.data.current.item); return; }
      if (active.id !== over.id) {
          const oldIndex = itinerary.findIndex((item) => item.id === active.id);
          const newIndex = itinerary.findIndex((item) => item.id === over.id);
          if (oldIndex === -1 || newIndex === -1) return;
          const newItinerary = arrayMove(itinerary, oldIndex, newIndex);
          setItinerary(recalculateTimes(newItinerary));
          try {
              const batch = writeBatch(db);
              newItinerary.forEach((item, index) => {
                  const itemRef = doc(db, 'artifacts', appId, 'trips', tripId, 'items', item.id);
                  batch.update(itemRef, { order: index });
              });
              await batch.commit();
          } catch (e) { console.error("Reorder failed:", e); }
      }
  };

  if (!isLoaded) return <div className="flex h-screen items-center justify-center">載入地圖元件中...</div>;
  if (tripLoading) return <div className="flex h-screen items-center justify-center gap-2"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div> 讀取行程資料中...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500">{error} <button onClick={()=>navigate('/')} className="ml-4 text-blue-500 underline">回首頁</button></div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen overflow-hidden font-sans relative">
        <div className="flex-1 flex overflow-hidden">
          <Sidebar sidebarTab={sidebarTab} setSidebarTab={setSidebarTab} myFavorites={myFavorites} toggleFavorite={toggleFavorite} handleAddToItinerary={handleAddToItinerary} isMapScriptLoaded={isLoaded} mapInstance={mapInstance} mapCenter={mapCenter} onPlaceSelect={handlePlaceSelect} mapBounds={mapBounds} onBack={() => navigate('/')} />
          <Canvas activeDay={activeDay} setActiveDay={setActiveDay} currentTrip={currentTrip} handleUpdateTrip={handleUpdateTrip} itinerary={itinerary} isGenerating={isGenerating} aiStatus={aiStatus} setIsAIModalOpen={setIsAIModalOpen} handleRemoveFromItinerary={handleRemoveFromItinerary} onPlaceSelect={handlePlaceSelect} onBack={() => navigate('/')} handleUpdateItem={handleUpdateItem} />
          <MapZone sidebarTab={sidebarTab} itinerary={itinerary} handleAddToItinerary={handleAddToItinerary} isMapScriptLoaded={isLoaded} setMapInstance={setMapInstance} setMapCenter={setMapCenter} mapCenter={mapCenter} selectedPlace={selectedPlace} onPlaceSelect={handlePlaceSelect} setMapBounds={setMapBounds} myFavorites={myFavorites} toggleFavorite={toggleFavorite} activeDay={activeDay} />
        </div>
        <AIGenerationModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerate={handleAIGenerate} userFavorites={myFavorites} isGenerating={isGenerating} setIsGenerating={setIsGenerating} setAiStatus={setAiStatus} currentTrip={currentTrip} existingItinerary={itinerary} />
        <DragOverlay dropAnimation={null}>{activeDragItem && <div className="bg-white p-3 rounded-lg shadow-2xl border-2 border-teal-500 w-64 opacity-90"><div className="font-bold text-sm text-gray-800">{activeDragItem.name}</div></div>}</DragOverlay>
      </div>
    </DndContext>
  );
};

// --- App Root (路由設定中心) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // 地圖 API 只載入一次
  const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey, libraries });

  useEffect(() => {
      const unsub = onAuthStateChanged(auth, u => {
          setUser(u);
          setAuthLoading(false);
      });
      return () => unsub();
  }, []);

  if (authLoading) return <div className="h-screen flex items-center justify-center">驗證身分中...</div>;
  if (loadError) return <div>Map Load Error</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard user={user} isMapScriptLoaded={isLoaded} />} />
        {/* 只有登入才能編輯，若沒登入就踢回首頁 */}
        <Route path="/trip/:tripId" element={user ? <EditorPage isLoaded={isLoaded} user={user} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}