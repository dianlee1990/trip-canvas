import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { logEvent } from './utils/logger';
import { useJsApiLoader } from '@react-google-maps/api';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, query, writeBatch, arrayUnion, setDoc } from 'firebase/firestore';
import { auth, db } from './utils/firebase';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';
import { Layout, List, Map as MapIcon, ChevronLeft, ChevronRight, Users, Sparkles, Calendar, Edit3, Save, X, Loader2, Share2, Download } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import MapZone from './components/MapZone';
import AIGenerationModal from './components/modals/AIGenerationModal';
import Dashboard from './components/Dashboard';
import ShareModal from './components/modals/ShareModal';
import ExportModal from './components/modals/ExportModal';
import PrivacyPolicy from './components/PrivacyPolicy';
const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ["places"];
const DEFAULT_CENTER = { lat: 35.700, lng: 139.770 };
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// DateEditor 元件
const DateEditor = ({ startDate, endDate, onSave, onCancel, isSaving }) => {
  const [start, setStart] = useState(startDate || '');
  const [end, setEnd] = useState(endDate || '');
  return (
    <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-xl shadow-2xl border border-gray-200 z-[60] w-64 animate-in fade-in zoom-in">
      <h4 className="font-bold text-gray-800 mb-3 text-sm">修改旅遊日期</h4>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">開始日期</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full text-sm border p-2 rounded-lg outline-none focus:border-teal-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">結束日期</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full text-sm border p-2 rounded-lg outline-none focus:border-teal-500" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
        <button onClick={onCancel} disabled={isSaving} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"><X size={16} /></button>
        <button onClick={() => onSave(start, end)} disabled={isSaving || !start || !end} className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isSaving ? '儲存' : '儲存'}
        </button>
      </div>
    </div>
  );
}

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
  
  // 🟢 Export 相關狀態 - 簡化回單一 Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState("正在啟動 AI 引擎...");
  const [mapInstance, setMapInstance] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);

  const [mobileTab, setMobileTab] = useState('canvas');
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);

  useEffect(() => {
    if (!tripId || !user) return;
    setTripLoading(true);
    const tripRef = doc(db, 'artifacts', appId, 'trips', tripId);
    const unsubscribe = onSnapshot(tripRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.collaborators && !data.collaborators.includes(user.uid)) {
          try {
            await updateDoc(tripRef, {
              collaborators: arrayUnion(user.uid)
            });
          } catch (err) {
            console.error("自動加入失敗:", err);
            setError("無法加入此行程，請聯繫擁有者。");
            setTripLoading(false);
          }
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

  useEffect(() => {
    if (!tripId) return;
    const favRef = collection(db, 'artifacts', appId, 'trips', tripId, 'favorites');
    const unsubscribe = onSnapshot(favRef, (snapshot) => {
      const favs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyFavorites(favs);
    });
    return () => unsubscribe();
  }, [tripId]);

  const totalDays = useMemo(() => {
    if (!currentTrip?.startDate || !currentTrip?.endDate) return 1;
    const start = new Date(currentTrip.startDate);
    const end = new Date(currentTrip.endDate);
    const diffDays = Math.ceil(Math.abs(end - start) / (86400000)) + 1;
    return diffDays > 0 ? diffDays : 1;
  }, [currentTrip]);

  const handleUpdateTrip = useCallback(async (updatedFields) => {
    if (!tripId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'trips', tripId), { ...updatedFields, updatedAt: new Date().toISOString() });
  }, [tripId]);

  const handleSaveDate = async (newStart, newEnd) => {
    if (newStart > newEnd) return alert("結束日期不能早於開始日期");
    setIsSavingDate(true);
    try {
      const updateTask = handleUpdateTrip({ startDate: newStart, endDate: newEnd });
      const timeoutTask = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 5000));
      await Promise.race([updateTask, timeoutTask]);
      setIsEditingDate(false);
      setActiveDay(1);
    } catch (error) {
      if (error.message === "TIMEOUT") {
        alert("網路連線較慢，將在背景儲存日期設定。");
        setIsEditingDate(false);
        setActiveDay(1);
      } else {
        console.error("Save date error:", error);
        alert("儲存日期失敗，請檢查網路連線。");
      }
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleUpdateItem = useCallback(async (itemId, updatedFields) => {
    if (!tripId) return;
    const itemRef = doc(db, 'artifacts', appId, 'trips', tripId, 'items', itemId);
    await updateDoc(itemRef, updatedFields);
  }, [tripId]);

  const handlePlaceSelect = useCallback((place) => {
    const lat = typeof place.lat === 'number' ? place.lat : place.pos?.lat;
    const lng = typeof place.lng === 'number' ? place.lng : place.pos?.lng;

    if (!lat || !lng) return;

    const normalizedPlace = {
      ...place,
      lat: lat,
      lng: lng,
      pos: { lat, lng },
      id: place.id,
      place_id: place.place_id || place.id
    };

    setSelectedPlace(normalizedPlace);

    if (mapInstance) {
      mapInstance.panTo({ lat, lng });
      mapInstance.setZoom(15);
    }

    if (window.innerWidth < 768) setMobileTab('map');
  }, [mapInstance]);

  const toggleFavorite = useCallback(async (item) => {
    if (!tripId) return;
    const favRef = doc(db, 'artifacts', appId, 'trips', tripId, 'favorites', item.id);
    const isFav = myFavorites.some(f => f.id === item.id);
    try {
      if (isFav) {
        await deleteDoc(favRef);
      } else {
        const lat = item.lat || item.pos?.lat || 0;
        const lng = item.lng || item.pos?.lng || 0;
        const favData = {
          id: item.id,
          name: item.name || '未知地點',
          type: item.type || 'spot',
          image: item.image || '',
          rating: Number(item.rating || 0),
          priceLevel: Number(item.priceLevel || 0),
          url: item.url || '',
          pos: { lat, lng },
          lat: lat,
          lng: lng,
          createdAt: new Date().toISOString()
        };
        await setDoc(favRef, favData);
      }
    } catch (e) { console.error("Favorite toggle failed:", e); }
  }, [tripId, myFavorites]);

  // 在 App.jsx 中找到 handleAddToItinerary 並更新：
  const handleAddToItinerary = useCallback(async (item) => {
    if (!tripId) return;
    const rawId = item.place_id ?? item.id;
    const safeId = rawId ? String(rawId) : `temp-${Date.now()}`;
    const currentDayItems = itinerary.filter(i => (i.day || 1) === activeDay);
    const maxOrder = currentDayItems.length > 0 ? Math.max(...currentDayItems.map(i => i.order || 0)) : 0;

    // 🟢 捕捉營業時間文字 (如果 Sidebar 有傳過來)
    let openingText = "";
    if (item.opening_hours?.weekday_text) {
        openingText = Array.isArray(item.opening_hours.weekday_text) 
          ? item.opening_hours.weekday_text.join('\n') 
          : String(item.opening_hours.weekday_text);
    }

    const newItem = {
      place_id: safeId, 
      name: item.name ?? '未知地點', 
      type: item.type ?? 'spot', 
      image: item.image ?? '',
      aiSummary: item.aiSummary ?? '', 
      tags: Array.isArray(item.tags) ? item.tags : [],
      lat: Number(item.lat ?? item.pos?.lat ?? 0), 
      lng: Number(item.lng ?? item.pos?.lng ?? 0),
      rating: Number(item.rating ?? 0), 
      price_level: Number(item.price_level ?? 0),
      day: Number(item.day || activeDay), 
      startTime: item.startTime ?? null, 
      duration: Number(item.duration ?? 60),
      order: maxOrder + 1, 
      createdAt: new Date().toISOString(),
      // 🟢 寫入來源 (AI 或 Manual)
      source: item.source || (item.id && item.id.startsWith('ai-') ? 'ai' : 'manual'),
      // 🟢 寫入營業資訊
      isOpenNow: item.isOpen, 
      openingText: openingText
    };
    
    await addDoc(collection(db, 'artifacts', appId, 'trips', tripId, 'items'), newItem);
    if (window.innerWidth < 768) setMobileTab('canvas');
  }, [tripId, activeDay, itinerary]);

  const handleRemoveFromItinerary = useCallback(async (id) => {
    const itemToRemove = itinerary.find(item => item.id === id);
    logEvent('delete_item', tripId, user?.uid, {
      itemId: id,
      name: itemToRemove?.name || 'Unknown',
      aiSummary: itemToRemove?.aiSummary || '',
      source: itemToRemove?.source || 'manual'
    });
    await deleteDoc(doc(db, 'artifacts', appId, 'trips', tripId, 'items', id));
  }, [tripId, itinerary, user]);

  const handleAIGenerate = useCallback(async (generatedData, targetDays, metaData) => {
    setIsAIModalOpen(false);
    setIsGenerating(false);
    setAiStatus("排程完成");

    if (!tripId) return;

    // 1. 更新行程 Metadata
    if (metaData) {
      try {
        const tripRef = doc(db, 'artifacts', appId, 'trips', tripId);
        await updateDoc(tripRef, {
          purpose: metaData.purpose || "Unknown",
          moods: metaData.moods || [],
          styles: metaData.styles || [],
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("❌ 更新行程 Context 失敗:", e);
      }
    }

    if (!generatedData || generatedData.length === 0) return;

    try {
      const batch = writeBatch(db);
      const itemsRef = collection(db, 'artifacts', appId, 'trips', tripId, 'items');

      // 步驟 A: 清除舊的 AI 行程 (保留手動)
      const itemsToDelete = itinerary.filter(item =>
        targetDays.includes(Number(item.day)) &&
        (item.source === 'ai' || (item.id && item.id.startsWith('ai-')))
      );
      itemsToDelete.forEach(item => {
        batch.delete(doc(itemsRef, item.id));
      });

      // 步驟 B: 針對每一天，進行「混合排序」與寫入
      for (const day of targetDays) {
        // 1. 找出當天「保留下來」的手動行程 (Anchors)
        const manualItems = itinerary.filter(item => 
          Number(item.day) === day && item.source !== 'ai' && !item.id.startsWith('ai-')
        );

        // 2. 找出 AI 為這一天生成的新行程
        const newAiItemsForDay = generatedData.filter(item => Number(item.day) === day);

        // 3. 處理 AI Item (比對收藏、防止重複)
        const processedAiItems = [];
        newAiItemsForDay.forEach(aiItem => {
          // 🛑 Double Check: 防止 AI 還是笨笨的推了已存在的點
          if (manualItems.some(m => m.name === aiItem.name)) return;

          // 🟢 Fix Bug 1: 收藏比對 (Fuzzy Match)
          // 只要名稱包含，就視為同一個點，使用收藏的 ID 與資料
          const matchedFav = myFavorites.find(fav => 
            fav.name === aiItem.name || 
            fav.name.includes(aiItem.name) || 
            aiItem.name.includes(fav.name)
          );
          
          // 如果是收藏，使用收藏的 ID (通常是 place-ChIJ...)，這樣 Canvas 才會亮愛心
          const rawId = matchedFav ? (matchedFav.place_id || matchedFav.id) : `ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const finalId = rawId; 

          processedAiItems.push({
            ...aiItem,
            id: finalId, // 暫存 ID 用於排序
            place_id: finalId,
            // 優先使用收藏的圖片與評分，因為那比較準
            image: matchedFav?.image || '',
            rating: matchedFav?.rating || 0,
            user_ratings_total: matchedFav?.user_ratings_total || 0,
            price_level: matchedFav?.priceLevel || 0,
            source: 'ai', 
            createdAt: new Date().toISOString(),
            isOpenNow: null,
            openingText: ''
          });
        });

        // 4. 合併並依時間排序 (Fix Bug 3)
        // 關鍵：將所有行程 (手動+AI) 放在一起，依照 startTime 重新排隊
        const allItemsForDay = [...manualItems, ...processedAiItems];
        
        allItemsForDay.sort((a, b) => {
          // 時間格式可能是 "14:00" 或 undefined
          const getMinutes = (timeStr) => {
            if (!timeStr) return 9999; // 沒時間的排最後
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + (m || 0);
          };
          return getMinutes(a.startTime) - getMinutes(b.startTime);
        });

        // 5. 批次寫入
        allItemsForDay.forEach((item, index) => {
          const newOrder = index + 1;
          
          if (item.source === 'manual') {
            // 如果是手動行程，只更新順序 (order)，不改動其他資料
            const itemDocRef = doc(itemsRef, item.id);
            batch.update(itemDocRef, { order: newOrder });
          } else {
            // 如果是 AI 行程，新增文件
            const newDocRef = doc(itemsRef); 
            batch.set(newDocRef, {
              place_id: item.place_id,
              name: item.name,
              type: item.type || 'spot',
              image: item.image,
              aiSummary: item.aiSummary || '',
              tags: item.tags || [],
              lat: Number(item.pos?.lat || 0),
              lng: Number(item.pos?.lng || 0),
              rating: item.rating,
              price_level: item.price_level,
              day: day,
              startTime: item.startTime, // 這是排序後的關鍵
              duration: Number(item.duration || 60),
              order: newOrder,
              createdAt: item.createdAt,
              source: 'ai',
              isOpenNow: null,
              openingText: ''
            });
          }
        });
      }

      await batch.commit();
      console.log(`✅ AI 排程混合排序寫入成功`);

    } catch (error) {
      console.error("❌ AI 寫入資料庫失敗:", error);
      alert("寫入行程失敗，請稍後再試");
    }
  }, [tripId, itinerary, myFavorites]);

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
      
      logEvent('reorder_item', tripId, user?.uid, {
        itemId: active.id,
        itemName: itinerary[oldIndex]?.name,
        oldIndex: oldIndex,
        newIndex: newIndex
      });
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
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden font-sans relative bg-gray-50">

        {/* 主要工作區 */}
        <div className="flex-1 flex overflow-hidden relative w-full">

          <div className={`${mobileTab === 'list' ? 'flex flex-col w-full' : 'hidden'} md:block md:w-1/4 md:min-w-[320px] h-full z-30 overflow-hidden [&>aside]:!w-full [&>aside]:!min-w-0`}>
            <Sidebar
              sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
              myFavorites={myFavorites} toggleFavorite={toggleFavorite}
              handleAddToItinerary={handleAddToItinerary} isMapScriptLoaded={isLoaded}
              mapInstance={mapInstance} mapCenter={mapCenter} onPlaceSelect={handlePlaceSelect}
              mapBounds={mapBounds} onBack={() => navigate('/')}
              onOpenAI={() => setIsAIModalOpen(true)}
              onOpenShare={() => setShowShareModal(true)}
              // 🟢 恢復：直接打開匯出 Modal
              onOpenExport={() => setIsExportModalOpen(true)}
              itinerary={itinerary}
            />
          </div>

          {/* 中間 Canvas */}
          <div className={`${mobileTab === 'canvas' ? 'flex flex-col w-full h-full' : 'hidden'} md:flex md:flex-col md:w-[28rem] md:shrink-0 md:h-full z-20 bg-white`}>
            {/* Mobile Header for Canvas */}
            <div className="md:hidden bg-white border-b px-2 py-2 flex justify-between items-center shrink-0 shadow-sm z-50 relative">
              <button onClick={() => navigate('/')} className="text-gray-500 p-2"><ChevronLeft size={24} /></button>

              <div className="flex items-center gap-1 bg-gray-100 rounded-full px-1 py-1">
                <button onClick={() => setActiveDay(p => Math.max(1, p - 1))} disabled={activeDay <= 1} className="p-1 rounded-full hover:bg-white disabled:opacity-30 transition-all"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold text-gray-700 min-w-[3rem] text-center">Day {activeDay}</span>
                <button onClick={() => setActiveDay(p => Math.min(totalDays, p + 1))} disabled={activeDay >= totalDays} className="p-1 rounded-full hover:bg-white disabled:opacity-30 transition-all"><ChevronRight size={16} /></button>

                <button onClick={() => setIsEditingDate(!isEditingDate)} className="p-1.5 ml-1 bg-white rounded-full text-gray-500 shadow-sm"><Calendar size={14} /></button>
              </div>

              {isEditingDate && (
                <DateEditor
                  startDate={currentTrip?.startDate}
                  endDate={currentTrip?.endDate}
                  onSave={handleSaveDate}
                  onCancel={() => setIsEditingDate(false)}
                  isSaving={isSavingDate}
                />
              )}

              <div className="flex gap-2 items-center">
                {/* 🟢 恢復：直接打開匯出 Modal */}
                <button onClick={() => setIsExportModalOpen(true)} className="text-purple-600 bg-purple-50 p-2 rounded-full"><Download size={18} /></button>
                <button onClick={() => setShowShareModal(true)} className="text-teal-600 bg-teal-50 p-2 rounded-full"><Share2 size={18} /></button>
              </div>
            </div>

            <div className="flex-1 w-full h-full relative overflow-y-auto custom-scrollbar">
              <Canvas
                activeDay={activeDay} setActiveDay={setActiveDay}
                currentTrip={currentTrip} handleUpdateTrip={handleUpdateTrip}
                itinerary={itinerary} isGenerating={isGenerating} aiStatus={aiStatus}
                setIsAIModalOpen={setIsAIModalOpen} handleRemoveFromItinerary={handleRemoveFromItinerary}
                onPlaceSelect={handlePlaceSelect} onBack={() => navigate('/')}
                handleUpdateItem={handleUpdateItem}
                onOpenShare={() => setShowShareModal(true)}
                // 🟢 恢復：直接打開匯出 Modal
                onOpenExport={() => setIsExportModalOpen(true)}
                myFavorites={myFavorites}
                toggleFavorite={toggleFavorite}
              />
              <div className="h-24 md:hidden shrink-0"></div>
            </div>
          </div>

          <div className={`${mobileTab === 'map' ? 'flex flex-col w-full' : 'hidden'} md:flex md:flex-col md:flex-1 h-full z-10`}>
            {/* Mobile Header for Map */}
            <div className="md:hidden bg-white border-b px-2 py-2 flex justify-between items-center shrink-0 shadow-sm z-50 relative">
              <button onClick={() => navigate('/')} className="text-gray-500 p-2"><ChevronLeft size={24} /></button>

              <div className="flex items-center gap-1 bg-gray-100 rounded-full px-1 py-1">
                <button onClick={() => setActiveDay(p => Math.max(1, p - 1))} disabled={activeDay <= 1} className="p-1 rounded-full hover:bg-white disabled:opacity-30 transition-all"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold text-gray-700 min-w-[3rem] text-center">Day {activeDay}</span>
                <button onClick={() => setActiveDay(p => Math.min(totalDays, p + 1))} disabled={activeDay >= totalDays} className="p-1 rounded-full hover:bg-white disabled:opacity-30 transition-all"><ChevronRight size={16} /></button>
                <button onClick={() => setIsEditingDate(!isEditingDate)} className="p-1.5 ml-1 bg-white rounded-full text-gray-500 shadow-sm"><Calendar size={14} /></button>
              </div>

              {isEditingDate && (
                <DateEditor
                  startDate={currentTrip?.startDate}
                  endDate={currentTrip?.endDate}
                  onSave={handleSaveDate}
                  onCancel={() => setIsEditingDate(false)}
                  isSaving={isSavingDate}
                />
              )}

              <div className="flex gap-2 items-center">
                {/* 🟢 恢復：直接打開匯出 Modal */}
                <button onClick={() => setIsExportModalOpen(true)} className="text-purple-600 bg-purple-50 p-2 rounded-full"><Download size={18} /></button>
                <button onClick={() => setShowShareModal(true)} className="text-teal-600 bg-teal-50 p-2 rounded-full"><Share2 size={18} /></button>
              </div>
            </div>

            <div className="w-full flex-1 relative">
              <MapZone
                sidebarTab={sidebarTab} itinerary={itinerary} handleAddToItinerary={handleAddToItinerary}
                isMapScriptLoaded={isLoaded} setMapInstance={setMapInstance} setMapCenter={setMapCenter}
                mapCenter={mapCenter} selectedPlace={selectedPlace} onPlaceSelect={handlePlaceSelect}
                setMapBounds={setMapBounds} myFavorites={myFavorites} toggleFavorite={toggleFavorite}
                activeDay={activeDay}
                currentTrip={currentTrip}
              />
            </div>
          </div>
        </div>

        <div className="md:hidden bg-white border-t border-gray-200 flex justify-around items-center p-2 pb-2 shrink-0 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] w-full">
          <button onClick={() => setMobileTab('list')} className={`flex flex-col items-center justify-center h-12 w-16 rounded-xl transition-all ${mobileTab === 'list' ?
            'text-teal-600 bg-teal-50' : 'text-gray-400 hover:bg-gray-50'}`}>
            <List size={24} />
            <span className="text-[10px] font-medium mt-0.5">找景點</span>
          </button>
          <button onClick={() => setMobileTab('canvas')} className={`flex flex-col items-center justify-center h-12 w-16 rounded-xl transition-all ${mobileTab === 'canvas' ?
            'text-teal-600 bg-teal-50' : 'text-gray-400 hover:bg-gray-50'}`}>
            <Layout size={24} />
            <span className="text-[10px] font-medium mt-0.5">排行程</span>
          </button>
          <button onClick={() => setMobileTab('map')} className={`flex flex-col items-center justify-center h-12 w-16 rounded-xl transition-all ${mobileTab === 'map' ?
            'text-teal-600 bg-teal-50' : 'text-gray-400 hover:bg-gray-50'}`}>
            <MapIcon size={24} />
            <span className="text-[10px] font-medium mt-0.5">看地圖</span>
          </button>
        </div>

        <AIGenerationModal
          isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)}
          onGenerate={handleAIGenerate} userFavorites={myFavorites}
          isGenerating={isGenerating} setIsGenerating={setIsGenerating}
          setAiStatus={setAiStatus} currentTrip={currentTrip} existingItinerary={itinerary}
        />
        <ShareModal
          isOpen={showShareModal} onClose={() => setShowShareModal(false)}
          trip={currentTrip} currentUser={user}
        />
        
        {/* 🟢 修改：移除戰略選單，直接使用整合後的 ExportModal */}
        <ExportModal
          isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)}
          trip={currentTrip} itinerary={itinerary}
          isMapLoaded={isLoaded}
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
        <Route path="/trip/:tripId" element={user ?
          <EditorPage isLoaded={isLoaded} user={user} /> : <Navigate to="/" />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>
    </BrowserRouter>
  );
}