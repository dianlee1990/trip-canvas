import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import zhTW from 'date-fns/locale/zh-TW';
import { useDroppable } from '@dnd-kit/core';
import {
  MapPin, Clock, Trash2, Sparkles, User, Heart, Share2,
  Download, ChevronLeft, ChevronRight, Edit3, Loader2,
  Ticket, Globe, Bed, Utensils, MoreHorizontal, DollarSign
} from 'lucide-react';
import { logEvent } from '../utils/logger';
import { auth } from '../utils/firebase';

// 引入 react-big-calendar 樣式
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const locales = {
  'zh-TW': zhTW,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 導購連結設定 ---
const AGODA_CID = "1427616";
const AGODA_TAG = "57450_2f19af64ff8c6";
const KLOOK_AID = "api%7C701%7C57144de842062be037049d9828200a9f%7Cpid%7C101701";

const getAffiliateLink = (item) => {
  const nameEncoded = encodeURIComponent(item.name);
  if (item.type === 'hotel' || item.types?.includes('lodging')) {
    return {
      url: `https://www.agoda.com/zh-tw/search?cid=${AGODA_CID}&tag=${AGODA_TAG}&text=${nameEncoded}`,
      label: '去訂房',
      icon: Bed,
      colorClass: 'bg-[#286090] hover:bg-[#1e486d] text-white border-[#204d74]'
    };
  }
  const ticketTypes = ['spot', 'culture', 'nature', 'activity', 'experience', 'transport', 'temple', 'museum', 'amusement_park', 'tourist_attraction'];
  if (ticketTypes.includes(item.type) || item.tags?.some(t => ticketTypes.includes(t))) {
    return {
      url: `https://www.klook.com/zh-TW/search?aid=${KLOOK_AID}&query=${nameEncoded}`,
      label: '去購票',
      icon: Ticket,
      colorClass: 'bg-[#ff5b00] hover:bg-[#e04f00] text-white border-[#e04f00]'
    };
  }
  if (item.url && (item.url.includes('inline') || item.url.includes('opentable') || item.url.includes('eztable'))) {
    return {
      url: item.url,
      label: '去訂位',
      icon: Utensils,
      colorClass: 'bg-green-600 hover:bg-green-700 text-white'
    };
  }
  return null;
};

// Custom Event Component
const CustomEvent = ({ event }) => {
  const { item, myFavorites, toggleFavorite, handleRemoveFromItinerary, onPlaceSelect, tripId, sequenceNumber } = event;
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const isAi = item.source === 'ai' || (item.id && item.id.startsWith('ai-'));
  const isFav = myFavorites?.some(f => {
    const fId = f.place_id || f.id;
    const iId = item.place_id || item.id;
    const cleanF = String(fId).replace(/^(place-|ai-)/, '');
    const cleanI = String(iId).replace(/^(place-|ai-)/, '');
    return cleanF === cleanI;
  });
  const rawId = item.place_id ? String(item.place_id).replace(/^(ai-|place-|sidebar-)/, '') : '';
  const isRealId = rawId && !rawId.startsWith('temp-');
  const googleMapsUrl = `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(item.name)}${isRealId ? `&query_place_id=${rawId}` : ''}`;

  const affiliate = getAffiliateLink(item);

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const handleAction = (e, action) => {
    e.stopPropagation();
    action();
    setShowMenu(false);
  };

  const handleAffiliateClick = (e) => {
    e.stopPropagation();
    if (tripId) {
      logEvent('click_affiliate', tripId, auth.currentUser?.uid, {
        itemId: item.id,
        itemName: item.name,
        affiliateType: affiliate.label
      });
    }
    window.open(affiliate.url, '_blank');
  };

  const toggleFavAction = () => {
    const favItem = {
      id: item.place_id || item.id,
      place_id: item.place_id,
      name: item.name,
      type: item.type,
      image: item.image,
      rating: item.rating,
      priceLevel: item.price_level,
      url: googleMapsUrl,
      lat: item.lat,
      lng: item.lng
    };
    toggleFavorite(favItem);
  };

  const duration = (event.end - event.start) / 60000;
  const isTiny = duration < 45;

  const smartSummary = useMemo(() => {
    const parts = [];
    if (item.aiHours) parts.push(item.aiHours);
    if (item.aiCost) parts.push(`均消 ${item.aiCost}`);
    if (item.aiHighlights) parts.push(item.aiHighlights);

    if (parts.length === 0) return item.aiSummary || "";
    const fullText = parts.join('，');
    return fullText.length > 100 ? fullText.substring(0, 99) + "..." : fullText;
  }, [item]);

  return (
    <div
      className={`h-full w-full flex flex-col relative rounded-lg border-l-[4px] shadow-sm transition-all text-gray-800 group
  ${isAi ? 'border-purple-500 bg-purple-50' : 'border-teal-600 bg-teal-50'}
  `}
      title={item.name}
      onClick={(e) => !showMenu && onPlaceSelect?.(item)}
    >
      {isTiny ? (
        <div className="flex items-center justify-between h-full px-1.5 overflow-hidden">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <div className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${isAi ? 'bg-purple-500' : 'bg-teal-600'}`}>
              {sequenceNumber}
            </div>
            <span className={`font-bold text-xs truncate leading-tight ${isAi ? 'text-purple-900' : 'text-teal-900'}`}>
              {item.name}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 ml-1">
            {affiliate && (
              <button
                onClick={handleAffiliateClick}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold shadow-sm transition-transform active:scale-95 ${affiliate.colorClass}`}
                title={affiliate.label}
              >
                <affiliate.icon size={10} className="shrink-0" />
                <span className="truncate max-w-[50px]">{affiliate.label}</span>
              </button>
            )}

            <button
              onClick={(e) => handleAction(e, toggleFavAction)}
              className={`p-0.5 rounded hover:bg-black/10 transition-colors ${isFav ? 'text-orange-500' : 'text-gray-400'}`}
            >
              <Heart size={12} fill={isFav ? "currentColor" : "none"} />
            </button>
            <button
              onClick={(e) => handleAction(e, () => handleRemoveFromItinerary(item.id))}
              className="p-0.5 rounded hover:bg-red-100 text-red-500 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start p-1.5 pb-0">
            <div className="flex-1 min-w-0 mr-1">
              <div className={`font-bold text-xs truncate flex items-center gap-1 ${isAi ? 'text-purple-900' : 'text-teal-900'}`}>
                <div className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${isAi ? 'bg-purple-500' : 'bg-teal-600'}`}>
                  {sequenceNumber}
                </div>
                <span className="truncate">{item.name}</span>
                <button
                  onClick={(e) => handleAction(e, () => window.open(googleMapsUrl, '_blank'))}
                  className="p-0.5 rounded bg-blue-100 text-blue-600 shrink-0 hover:bg-blue-200 transition-colors"
                  title="在 Google 地圖查看"
                >
                  <MapPin size={10} />
                </button>
              </div>

              <div className={`flex items-center gap-1 mt-0.5 ml-5 text-[10px] font-medium leading-none ${isAi ? 'text-purple-700' : 'text-teal-700'}`}>
                <Clock size={10} />
                <span>{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={(e) => handleAction(e, toggleFavAction)}
                className={`p-1 rounded hover:bg-black/5 transition-colors ${isFav ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                title={isFav ? "取消收藏" : "加入收藏"}
              >
                <Heart size={14} fill={isFav ? "currentColor" : "none"} />
              </button>
              <button
                onClick={(e) => handleAction(e, () => handleRemoveFromItinerary(item.id))}
                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                title="移除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {smartSummary && (
            <div className="px-1.5 mt-1 ml-5">
              <div className="flex items-start gap-1 p-0.5 px-1 rounded bg-white/60 border border-purple-100/50 text-[10px] text-gray-600 leading-tight">
                <Sparkles size={8} className="shrink-0 mt-0.5 text-purple-500 fill-purple-200" />
                <span className="line-clamp-2">{smartSummary}</span>
              </div>
            </div>
          )}

          <div className="mt-auto px-1.5 pb-1.5 pt-1">
            {affiliate ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleAffiliateClick}
                className={`w-full flex items-center justify-center gap-1.5 py-1 rounded text-[10px] font-bold shadow-sm transition-all active:scale-95 ${affiliate.colorClass}`}
              >
                <affiliate.icon size={12} className="shrink-0" />
                <span className="truncate">{affiliate.label}</span>
              </button>
            ) : item.url ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); window.open(item.url, '_blank'); }}
                className="w-full flex items-center justify-center gap-1.5 py-1 rounded text-[10px] font-medium bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 active:scale-95"
              >
                <Globe size={12} className="shrink-0" />
                <span className="truncate">官方網站</span>
              </button>
            ) : (
              <div className="h-1" />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default function Canvas({
  activeDay,
  setActiveDay,
  currentTrip,
  handleUpdateTrip,
  itinerary,
  isGenerating,
  aiStatus,
  setIsAIModalOpen,
  handleRemoveFromItinerary,
  onPlaceSelect,
  onBack,
  handleUpdateItem,
  handleAddToItinerary,
  onOpenShare,
  onOpenExport,
  myFavorites,
  toggleFavorite
}) {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);

  // 定義 Droppable 區域 (dnd-kit)
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-droppable-zone',
  });

  const currentDisplayDate = useMemo(() => {
    if (currentTrip?.startDate) {
      const date = new Date(currentTrip.startDate);
      date.setDate(date.getDate() + (activeDay - 1));
      return date;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() + (activeDay - 1));
    return today;
  }, [currentTrip, activeDay]);

  const { totalDays, currentDateDisplay } = useMemo(() => {
    if (!currentTrip?.startDate || !currentTrip?.endDate) return { totalDays: 1, currentDateDisplay: '未設定日期' };
    const start = new Date(currentTrip.startDate);
    const end = new Date(currentTrip.endDate);
    const diffDays = Math.ceil(Math.abs(end - start) / (86400000)) + 1;
    return {
      totalDays: diffDays > 0 ? diffDays : 1,
      currentDateDisplay: format(currentDisplayDate, 'MM月dd日 (eee)', { locale: zhTW })
    };
  }, [currentTrip, activeDay, currentDisplayDate]);

  const events = useMemo(() => {
    const dayItems = itinerary.filter(i => Number(i.day) === activeDay);

    dayItems.sort((a, b) => {
      const getMins = (t) => {
        if (!t) return 9999;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
      }
      return getMins(a.startTime) - getMins(b.startTime);
    });

    return dayItems.map((item, index) => {
      let startHour = 8;
      let startMin = 0;

      if (item.startTime) {
        const [h, m] = item.startTime.split(':').map(Number);
        if (!isNaN(h)) {
          startHour = h;
          startMin = m || 0;
        }
      }

      const startDate = new Date(currentDisplayDate);
      startDate.setHours(startHour, startMin, 0);

      const duration = Number(item.duration || 60);
      const endDate = new Date(startDate.getTime() + duration * 60000);

      return {
        id: item.id,
        title: item.name,
        start: startDate,
        end: endDate,
        item: item,
        myFavorites,
        toggleFavorite,
        handleRemoveFromItinerary,
        onPlaceSelect,
        tripId: currentTrip?.id,
        sequenceNumber: index + 1
      };
    });
  }, [itinerary, activeDay, currentDisplayDate, myFavorites, toggleFavorite, handleRemoveFromItinerary, onPlaceSelect, currentTrip]);

  const defaultScrollTime = useMemo(() => {
    const base = new Date(currentDisplayDate);
    if (events.length > 0) {
      const minTime = events.reduce((min, e) => e.start < min ? e.start : min, events[0].start);
      return new Date(minTime.getTime() - 30 * 60000);
    }
    base.setHours(8, 0, 0, 0);
    return base;
  }, [events, currentDisplayDate]);

  const moveEvent = useCallback(async ({ event, start, end }) => {
    const newStartTime = format(start, 'HH:mm');
    await handleUpdateItem(event.id, { startTime: newStartTime });
    logEvent('update_time', currentTrip?.id, auth.currentUser?.uid, {
      itemId: event.id,
      newTime: newStartTime,
      action: 'drag_move'
    });
  }, [handleUpdateItem, currentTrip]);

  const resizeEvent = useCallback(async ({ event, start, end }) => {
    const newDuration = (end - start) / 60000;
    await handleUpdateItem(event.id, { duration: newDuration });
    logEvent('update_duration', currentTrip?.id, auth.currentUser?.uid, {
      itemId: event.id,
      newDuration: newDuration,
      action: 'resize'
    });
  }, [handleUpdateItem, currentTrip]);

  // 🟢 1. 用於獲取正在拖曳的 Sidebar 項目
  const dragFromOutsideItem = useCallback(() => {
    try {
      // 這裡假設拖曳發生時，Sidebar 會將資料寫入全域變數 (目前的實作方式)
      // dnd-kit 本身其實不需要這個，這是 react-big-calendar 的特殊要求
      const json = window.__draggedSidebarItem;
      return json ? JSON.parse(json) : null;
    } catch (e) { return null; }
  }, []);

  // 🟢 2. 核心修改：接收外部拖曳並指定時間
  const onDropFromOutside = useCallback(async ({ start, end }) => {
    const draggedItemString = window.__draggedSidebarItem;
    if (draggedItemString) {
      const item = JSON.parse(draggedItemString);
      
      // ✅ 關鍵修改：使用 `start` 參數來取得放下時的時間
      const dropTime = format(start, 'HH:mm');
      const duration = 60; // 預設 60 分鐘

      await handleAddToItinerary({
        ...item,
        startTime: dropTime, // ✅ 設定為使用者拖曳到的時間點
        duration: duration,
        day: activeDay
      });

      logEvent('add_item_drag', currentTrip?.id, auth.currentUser?.uid, {
        itemName: item.name,
        startTime: dropTime,
        source: 'sidebar_drag_to_calendar'
      });

      // 清除全域暫存
      window.__draggedSidebarItem = null;
    }
  }, [handleAddToItinerary, activeDay, currentTrip]);

  const handleSaveDate = async (newStart, newEnd) => {
    if (newStart > newEnd) return alert("結束日期不能早於開始日期");
    setIsSavingDate(true);
    try {
      const updateTask = handleUpdateTrip({ startDate: newStart, endDate: newEnd });
      const timeoutTask = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 5000));
      await Promise.race([updateTask, timeoutTask]);
      setIsEditingDate(false);
      setActiveDay(1);
    } catch (error) { console.error("Save date error:", error); } finally { setIsSavingDate(false); }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 w-full bg-white flex flex-col h-full relative z-10 border-r border-gray-200 transition-colors ${isOver ? 'bg-teal-50/50' : ''}`}
    >
      <style>{`
        .rbc-event-label { display: none !important; }
        .rbc-time-slot { min-height: 30px; }
        /* 調整拖曳時的輔助線樣式 */
        .rbc-addons-dnd-resize-ns-icon { width: 100%; height: 12px; background: transparent; bottom: 0; display: flex; align-items: center; justify-content: center; opacity: 0.5; transition: opacity 0.2s; }
        .rbc-addons-dnd-resize-ns-icon::after { content: ""; display: block; width: 30px; height: 3px; background-color: rgba(0,0,0,0.2); border-radius: 2px; border-top: 1px solid rgba(255,255,255,0.5); }
        .rbc-addons-dnd-resize-ns-icon:hover { opacity: 1; background-color: rgba(0,0,0,0.05); cursor: ns-resize; }
        /* 讓今日高亮更明顯 */
        .rbc-today { background-color: #f0fdfa !important; }
      `}</style>

      {/* Header 區域保持不變 */}
      <div className="hidden md:block p-4 border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-gray-800 line-clamp-1 max-w-[150px]" title={currentTrip?.title}>{currentTrip?.title || "未命名行程"}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onOpenShare} className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-full"><Share2 size={18} /></button>
            <button onClick={onOpenExport} className="p-2 text-purple-600 hover:bg-purple-50 rounded-full transition-colors"><Download size={18} /></button>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between relative">
          <button onClick={() => setActiveDay(p => p - 1)} disabled={activeDay <= 1} className="p-1 rounded-lg hover:bg-white disabled:opacity-30"><ChevronLeft size={20} /></button>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800 text-lg">Day {activeDay}</h3>
              <button onClick={() => setIsEditingDate(!isEditingDate)} className="text-gray-400 hover:text-teal-600 p-1"><Edit3 size={14} /></button>
            </div>
            <span className="text-xs text-gray-500 font-medium">{currentDateDisplay}</span>
            {isEditingDate && (
              <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-50 bg-white p-4 shadow-xl border rounded-lg w-64">
                <p className="text-xs text-gray-500 mb-2"> 請回列表頁或使用手機版修改日期 </p>
                <button onClick={() => setIsEditingDate(false)} className="text-xs bg-gray-200 px-2 py-1 rounded"> 關閉 </button>
              </div>
            )}
          </div>
          <button onClick={() => setActiveDay(p => p + 1)} disabled={activeDay >= totalDays} className="p-1 rounded-lg hover:bg-white disabled:opacity-30"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden relative"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      >
        {isGenerating && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-purple-600" size={32} />
            <p className="text-sm font-medium text-purple-700 mt-2">{aiStatus}</p>
          </div>
        )}

        <DnDCalendar
          localizer={localizer}
          events={events}
          date={currentDisplayDate}
          onNavigate={() => { }}
          view={Views.DAY}
          onView={() => { }}
          toolbar={false}

          // 🟢 啟用拖放相關設定
          draggableAccessor={() => true}
          resizable
          selectable // 允許點選空白處 (通常與拖曳配合更好)
          droppable={true} // 🟢 關鍵：允許外部物件掉落

          // 處理既有行程的移動與縮放
          onEventDrop={moveEvent}
          onEventResize={resizeEvent}

          // 🟢 處理從 Sidebar 拖進來的事件
          dragFromOutsideItem={dragFromOutsideItem} // 告訴 calendar 正在拖曳什麼
          onDropFromOutside={onDropFromOutside}     // 當放開滑鼠時觸發，並帶有時間資訊

          scrollToTime={defaultScrollTime}

          step={15}
          timeslots={4}

          components={{
            event: CustomEvent
          }}

          eventPropGetter={(event) => {
            return {
              style: {
                backgroundColor: 'transparent',
                border: 'none',
                padding: '0px',
                borderRadius: '8px',
                boxShadow: 'none'
              }
            }
          }}

          className="h-full font-sans text-xs"
          min={new Date(currentDisplayDate.setHours(0, 0, 0))}
          max={new Date(currentDisplayDate.setHours(23, 59, 0))}
        />
      </div>
    </div>
  );
}