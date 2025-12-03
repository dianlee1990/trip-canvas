import React, { useState, useCallback, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, query, writeBatch } from 'firebase/firestore';
import { auth, db } from './utils/firebase';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';
import { Layout, List, Map as MapIcon, ChevronLeft, Users } from 'lucide-react'; // 新增 Icons

import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import MapZone from './components/MapZone';
import AIGenerationModal from './components/modals/AIGenerationModal';
import Dashboard from './components/Dashboard';
import ShareModal from './components/modals/ShareModal'; // 新增

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ["places"];
const DEFAULT_CENTER = { lat: 35.700, lng: 139.770 };
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 時間重算邏輯 ---
const recalculateTimes = (items) => {
  const sortedItems = [...items].sort((a, b) => {
    const dayA = Number(a.day || 1);
    const dayB = Number(b.day || 1);
    if (dayA !== dayB) return dayA - dayB;
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    const tA = a.startTime ? parseInt(a.startTime.replace(':', '')) : 9999;
    const tB = b.startTime ? parseInt(b.startTime.replace(':', '')) : 9999;
    return tA - tB;
  });

  let currentDay = -1;
  let currentHour = 9;
  let currentMinute = 0;

  return sortedItems.map((item) => {
    const itemDay = Number(item.day || 1);

    if (itemDay !== currentDay) {
      currentDay = itemDay;
      currentHour = 9;
      currentMinute = 0;
    }

    if (item.startTime) {
      const [h, m] = item.startTime.split(':').map(Number);
      if (!isNaN(h)) {
        const currentTimeVal = currentHour * 60 + currentMinute;
        const specifiedTimeVal = h * 60 + m;
        if (currentTimeVal <= specifiedTimeVal || (currentHour === 9 && currentMinute === 0)) {
          currentHour = h;
          currentMinute = m || 0;
        }
      }
    }

    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    const duration = Number(item.duration || item.suggestedDuration || 60);

    const updatedItem = {
      ...item,
      time: timeStr,
      suggestedDuration: duration
    };

    currentMinute += duration;
    while (currentMinute >= 60) {
      currentMinute -= 60;
      currentHour += 1;
    }
    if (currentHour >= 24) {
      currentHour = 23;
      currentMinute = 59;
    }
    return updatedItem;
  });
};

const EditorPage = ({ isLoaded, user }) => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [currentTrip, setCurrentTrip] = useState(null);
  const [tripLoading, setTripLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // RWD & Share Modal 狀態
  const [mobileTab, setMobileTab] = useState('canvas'); // 'list' | 'canvas' | 'map'
  const [showShareModal, setShowShareModal] = useState(false);

  // 1. 抓取 Trip
  useEffect(() => {
    if (!tripId || !user) return;
    setTripLoading(true);
    const tripRef = doc(db, 'artifacts', appId, 'trips', tripId);
    const unsubscribe = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
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

  // 2. 抓取 Items
  useEffect(() => {
    if (!tripId) return;
    const itemsRef = collection(db, 'artifacts', appId, 'trips', tripId, 'items');
    const q = query(itemsRef, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItinerary(recalculateTimes(items));
    });
    return () => unsubscribe();
  }, [tripId]);

  const handleUpdateTrip = useCallback(async (updatedFields) => {
    if (!tripId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'trips', tripId), { ...updatedFields, updatedAt: new Date().toISOString() });
  }, [tripId]);

  const handleUpdateItem = useCallback(async (itemId, updatedFields) => {
    if (!tripId) return;
    const itemRef = doc(db, 'artifacts', appId, 'trips', tripId, 'items', itemId);
    await updateDoc(itemRef, updatedFields);
  }, [tripId]);

  const handlePlaceSelect = useCallback((place) => {
    setSelectedPlace(place);
    if (mapInstance && place?.pos) { mapInstance.panTo(place.pos); mapInstance.setZoom(15); }
    // 手機版體驗優化：選了地點後自動切到地圖
    if (window.innerWidth < 768) setMobileTab('map');
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
      order: maxOrder + 1, createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'artifacts', appId, 'trips', tripId, 'items'), newItem);
    // 手機版：加入後切換回行程表
    if (window.innerWidth < 768) setMobileTab('canvas');
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
  if (tripLoading) return <div className="flex h-screen items-center justify-center gap-2"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>讀取行程資料中...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500">{error} <button onClick={() => navigate('/')} className="ml-4 text-blue-500 underline">回首頁</button></div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen overflow-hidden font-sans relative bg-gray-50">
        
        <div className="flex-1 flex overflow-hidden relative">
          {/* 左側 Sidebar */}
          <div className={`${mobileTab === 'list' ? 'block w-full' : 'hidden'} md:block md:w-1/4 md:min-w-[320px] h-full z-30`}>
            <Sidebar 
              sidebarTab={sidebarTab} setSidebarTab={setSidebarTab} 
              myFavorites={myFavorites} toggleFavorite={toggleFavorite} 
              handleAddToItinerary={handleAddToItinerary} isMapScriptLoaded={isLoaded} 
              mapInstance={mapInstance} mapCenter={mapCenter} onPlaceSelect={handlePlaceSelect} 
              mapBounds={mapBounds} onBack={() => navigate('/')} 
            />
          </div>

          {/* 中間 Canvas */}
          <div className={`${mobileTab === 'canvas' ? 'block w-full' : 'hidden'} md:block md:flex-1 h-full z-20`}>
             {/* 手機版頂部導覽 */}
            <div className="md:hidden bg-white border-b p-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
               <button onClick={() => navigate('/')} className="text-gray-500"><ChevronLeft/></button>
               <span className="font-bold text-gray-800 truncate max-w-[200px]">{currentTrip?.title}</span>
               <button onClick={() => setShowShareModal(true)} className="text-teal-600 bg-teal-50 p-2 rounded-full"><Users size={18}/></button>
            </div>
            
            <Canvas 
              activeDay={activeDay} setActiveDay={setActiveDay} 
              currentTrip={currentTrip} handleUpdateTrip={handleUpdateTrip} 
              itinerary={itinerary} isGenerating={isGenerating} aiStatus={aiStatus} 
              setIsAIModalOpen={setIsAIModalOpen} handleRemoveFromItinerary={handleRemoveFromItinerary} 
              onPlaceSelect={handlePlaceSelect} onBack={() => navigate('/')} 
              handleUpdateItem={handleUpdateItem} 
            />
          </div>

          {/* 右側 MapZone */}
          {/* 注意：這裡我們強行用 CSS 蓋掉原本 MapZone 可能自帶的 hidden 屬性 */}
          <div className={`${mobileTab === 'map' ? 'block w-full' : 'hidden'} md:block md:flex-1 h-full z-10 flex`}>
             {/* 我們需要一個 wrapper 來確保 MapZone 能夠在手機版正確顯示 */}
             <div className="w-full h-full [&>aside]:flex [&>aside]:w-full [&>aside]:max-w-none">
                <MapZone 
                  sidebarTab={sidebarTab} itinerary={itinerary} handleAddToItinerary={handleAddToItinerary} 
                  isMapScriptLoaded={isLoaded} setMapInstance={setMapInstance} setMapCenter={setMapCenter} 
                  mapCenter={mapCenter} selectedPlace={selectedPlace} onPlaceSelect={handlePlaceSelect} 
                  setMapBounds={setMapBounds} myFavorites={myFavorites} toggleFavorite={toggleFavorite} 
                  activeDay={activeDay} 
                />
             </div>
          </div>
        </div>

        {/* 手機版底部導覽列 */}
        <div className="md:hidden bg-white border-t border-gray-200 flex justify-around p-2 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => setMobileTab('list')} className={`flex flex-col items-center text-[10px] font-medium p-2 rounded-lg w-16 transition-colors ${mobileTab === 'list' ? 'text-teal-600 bg-teal-50' : 'text-gray-400'}`}>
            <List size={22} />
            <span className="mt-1">找景點</span>
          </button>
          <button onClick={() => setMobileTab('canvas')} className={`flex flex-col items-center text-[10px] font-medium p-2 rounded-lg w-16 transition-colors ${mobileTab === 'canvas' ? 'text-teal-600 bg-teal-50' : 'text-gray-400'}`}>
            <Layout size={22} />
            <span className="mt-1">排行程</span>
          </button>
          <button onClick={() => setMobileTab('map')} className={`flex flex-col items-center text-[10px] font-medium p-2 rounded-lg w-16 transition-colors ${mobileTab === 'map' ? 'text-teal-600 bg-teal-50' : 'text-gray-400'}`}>
            <MapIcon size={22} />
            <span className="mt-1">看地圖</span>
          </button>
        </div>

        <AIGenerationModal 
          isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} 
          onGenerate={handleAIGenerate} userFavorites={myFavorites} 
          isGenerating={isGenerating} setIsGenerating={setIsGenerating} 
          setAiStatus={setAiStatus} currentTrip={currentTrip} existingItinerary={itinerary} 
        />
        
        {/* Share Modal 放在這裡確保覆蓋層級正確 */}
        <ShareModal 
          isOpen={showShareModal} onClose={() => setShowShareModal(false)}
          trip={currentTrip} currentUser={user}
        />

        <DragOverlay dropAnimation={null}>
          {activeDragItem && (
            <div className="bg-white p-3 rounded-lg shadow-2xl border-2 border-teal-500 w-64 opacity-90">
              <div className="font-bold text-sm text-gray-800">{activeDragItem.name}</div>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
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
        <Route path="/trip/:tripId" element={user ? <EditorPage isLoaded={isLoaded} user={user} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}