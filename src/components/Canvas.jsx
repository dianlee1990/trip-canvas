import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, MapPin, Trash2, GripVertical, DollarSign,
  Share2, Sparkles, ChevronLeft, ChevronRight, Save, Edit3, X,
  Loader2, Star, ExternalLink, Globe, CalendarCheck, Ticket, Download,
  User, Heart
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconByType } from '../icons/IconByType';
import { logEvent } from '../utils/logger';
import { auth } from '../utils/firebase';

const AGODA_CID = "1427616";
const AGODA_TAG = "57450_2f19af64ff8c6";
const KLOOK_AID = "api%7C701%7C57144de842062be037049d9828200a9f%7Cpid%7C101701";

const getTripContext = (trip) => {
  if (!trip) {
    return {
      destination: "Unknown",
      purpose: "Unknown",
      moods: "",
      styles: "",
      days: 0
    };
  }
  if (import.meta.env.DEV) {
    console.log("Current Trip Data for Context:", trip);
  }

  let moodsStr = "";
  const rawMoods = trip.moods || trip.selectedMoods;
  if (Array.isArray(rawMoods)) {
    moodsStr = rawMoods.join(',');
  } else if (typeof rawMoods === 'string') {
    moodsStr = rawMoods;
  }

  let stylesStr = "";
  const rawStyles = trip.styles || trip.selectedStyles;
  if (Array.isArray(rawStyles)) {
    stylesStr = rawStyles.join(',');
  } else if (typeof rawStyles === 'string') {
    stylesStr = rawStyles;
  }

  return {
    destination: trip.destination || "Unknown",
    purpose: trip.purpose || trip.selectedPurpose || "Unknown",
    moods: moodsStr,
    styles: stylesStr,
    days: (trip.startDate && trip.endDate) ? "calculated" : 1
  };
};

const getAffiliateLink = (item) => {
  const nameEncoded = encodeURIComponent(item.name);
  if (item.type === 'hotel') {
    return {
      url: `https://www.agoda.com/zh-tw/search?cid=${AGODA_CID}&tag=${AGODA_TAG}&text=${nameEncoded}`,
      label: '查房價',
      isAffiliate: true,
      colorClass: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 shadow-sm'
    };
  }
  const ticketTypes = ['spot', 'culture', 'nature', 'activity', 'experience', 'transport', 'temple', 'museum'];
  if (ticketTypes.includes(item.type)) {
    return {
      url: `https://www.klook.com/zh-TW/search?aid=${KLOOK_AID}&query=${nameEncoded}`,
      label: '找票券',
      isAffiliate: true,
      colorClass: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 shadow-sm'
    };
  }
  if (item.url && (item.url.includes('inline') || item.url.includes('opentable') || item.url.includes('eztable'))) {
    return {
      url: item.url,
      label: '訂位',
      isAffiliate: false,
      colorClass: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 shadow-sm'
    };
  }
  return null;
};

const TimePickerPopover = ({ onSave, onClose }) => {
  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hourStr = String(h).padStart(2, '0');
        const minStr = String(m).padStart(2, '0');
        options.push(`${hourStr}:${minStr}`);
      }
    }
    return options;
  }, []);

  return (
    <div className="absolute top-8 left-0 bg-white border border-gray-200 shadow-2xl rounded-lg z-[100] w-32 max-h-60 overflow-y-auto custom-scrollbar p-1">
      {timeOptions.map(t => (
        <div key={t} onClick={() => onSave(t)} className="px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-700 rounded text-gray-600 font-medium">
          {t}
        </div>
      ))}
    </div>
  );
};

const DurationPickerPopover = ({ onSave, onClose }) => {
  const durationOptions = useMemo(() => {
    const options = [];
    for (let m = 15; m <= 120; m += 15) options.push(m);
    for (let m = 150; m <= 300; m += 30) options.push(m);
    return options;
  }, []);

  return (
    <div className="absolute top-8 left-0 bg-white border border-gray-200 shadow-2xl rounded-lg z-[100] w-36 max-h-60 overflow-y-auto custom-scrollbar p-1">
      {durationOptions.map(m => (
        <div key={m} onClick={() => onSave(m)} className="px-3 py-2 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-700 rounded text-gray-600 font-medium">
          {m < 60 ? `${m} 分鐘` : `${Math.floor(m / 60)} 小時 ${m % 60 > 0 ? m % 60 + '分' : ''}`}
        </div>
      ))}
    </div>
  );
};

const SortableTripItem = ({ item, index, onRemove, onPlaceSelect, onUpdateItem, isGenerating, tripId, tripContext, myFavorites, toggleFavorite }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { item } });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const isOverlayOpen = showTimePicker || showDurationPicker;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : (isOverlayOpen ? 100 : 1),
    position: 'relative'
  };

  const googleMapsUrl = `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(item.name)}&query_place_id=${item.place_id || ''}`;
  const affiliate = getAffiliateLink(item);

  // 🟢 判斷來源與收藏狀態
  const isAi = item.source === 'ai' || (item.id && item.id.startsWith('ai-'));
  const isFav = myFavorites?.some(f => f.id === item.place_id || f.id === `place-${item.place_id}` || f.id === item.id);
  const isOpenNow = item.isOpenNow;

  const handleTimeSave = (newTime) => {
    onUpdateItem(item.id, { startTime: newTime });
    setShowTimePicker(false);
  };

  const handleDurationSave = (newDuration) => {
    onUpdateItem(item.id, { duration: newDuration, suggestedDuration: newDuration });
    setShowDurationPicker(false);
  };

  const handleAffiliateClick = (e, linkUrl, label) => {
    e.stopPropagation();
    logEvent('click_affiliate', tripId, auth.currentUser?.uid, {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type || 'unknown',
      affiliateType: label,
      url: linkUrl,
      ...tripContext
    });
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    logEvent('delete_item', tripId, auth.currentUser?.uid, {
      itemId: item.id,
      itemName: item.name,
      itemType: item.type || 'unknown',
      aiSummary: item.aiSummary || '',
      source: item.source || 'manual',
      ...tripContext
    });
    onRemove(item.id);
  };

  const handleHeartClick = (e) => {
    e.stopPropagation();
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

  return (
    <div ref={setNodeRef} style={style} className="group mb-4 outline-none">
      <div className="absolute left-[19px] top-10 bottom-[-24px] w-0.5 bg-gray-200 group-last:hidden z-0"></div>
      <div className="flex gap-4 relative z-10">
        
        {/* 左側時間與順序 */}
        <div className="flex flex-col items-center gap-1 min-w-[40px] pt-1 relative">
          {index === 0 ? (
            <>
              <button onClick={() => setShowTimePicker(!showTimePicker)} className="text-xs font-mono font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer border border-teal-200" title="點擊修改今日出發時間">
                {item.time || '09:00'}
              </button>
              {showTimePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTimePicker(false)}></div>
                  <TimePickerPopover onSave={handleTimeSave} onClose={() => setShowTimePicker(false)} />
                </>
              )}
            </>
          ) : (
            <span className="text-xs font-mono font-medium text-gray-400 cursor-default" title="依據上一站時間自動計算">{item.time || '00:00'}</span>
          )}
          
          {/* 🟢 修改：顯示順序數字，顏色區分 AI/手動 */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border-2 border-white text-sm font-bold z-10
               ${isAi ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-teal-100 text-teal-700 border-teal-200'}
          `}>
             {index + 1}
          </div>
        </div>

        {/* 卡片本體 */}
        <div onClick={() => !isDragging && onPlaceSelect?.(item)} className={`flex-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group/card ${isGenerating ? 'animate-pulse' : ''}`}>
          <div className="flex justify-between items-start gap-2">
            <div className="flex flex-col gap-1 w-full">
              <h4 className="font-bold text-gray-800 text-base line-clamp-1">{item.name}</h4>
              
              {/* 🟢 新增：標籤列 (AI/手動, 收藏) */}
              <div className="flex items-center gap-2 text-xs flex-wrap mt-0.5">
                 {isAi ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                      <Sparkles size={10} /> AI 推薦
                    </span>
                 ) : (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      <User size={10} /> 自選
                    </span>
                 )}

                 {isFav && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 border border-orange-200">
                      <Heart size={10} fill="currentColor" /> 已收藏
                    </span>
                 )}

                 {item.rating > 0 && <span className="flex items-center text-orange-500 font-bold bg-orange-50 px-1.5 py-0.5 rounded-md">{item.rating} <Star size={10} fill="currentColor" className="ml-0.5" /></span>}
                 {item.price_level > 0 && <span className="text-gray-500 font-medium">{[...Array(item.price_level)].map((_, i) => <span key={i} className="text-gray-800">$</span>)}</span>}
              </div>

              {/* 🟢 新增：營業時間顯示 */}
              {typeof isOpenNow === 'boolean' && (
                <div className={`text-xs mt-1 flex items-center gap-1 font-medium ${isOpenNow ? 'text-green-600' : 'text-red-500'}`}>
                  <Clock size={12} />
                  {isOpenNow ? '營業中 (參考)' : '已打烊 (參考)'}
                </div>
              )}
            </div>
            <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-600 p-1 cursor-grab active:cursor-grabbing"><GripVertical size={16} /></button>
          </div>

          {item.aiSummary ? (
            <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100"><Sparkles size={10} className="inline text-purple-500 mr-1" />{item.aiSummary}</p>
          ) : (
            <div className="flex flex-wrap gap-1 mt-2">{item.tags?.slice(0, 3).map((tag, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">#{tag}</span>)}</div>
          )}

          <div className="mt-3 pt-2 border-t border-gray-50">
            {/* Mobile Layout */}
            <div className="md:hidden flex flex-col gap-3">
              <div className="flex gap-2 w-full">
                {affiliate ? (
                  <a
                    href={affiliate.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => handleAffiliateClick(e, affiliate.url, affiliate.label)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-bold border transition-colors ${affiliate.colorClass}`}
                  >
                    <Ticket size={14} /> {affiliate.label}
                  </a>
                ) : item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-bold border bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100">
                    <Globe size={14} /> 官網
                  </a>
                ) : null}

                <a href={googleMapsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`flex-1 flex items-center justify-center gap-1 py-2.5 bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-lg text-xs font-bold border border-gray-100 transition-colors ${!affiliate && !item.url ? 'w-full' : ''}`}>
                  <MapPin size={14} /> 地圖/評論
                </a>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="relative">
                  <button onClick={(e) => {
                    e.stopPropagation(); setShowDurationPicker(!showDurationPicker);
                  }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 hover:bg-teal-50 px-2 py-1 rounded transition-colors" title="點擊修改停留時間">
                    <Clock size={12} /> <span className="font-medium">{item.suggestedDuration || 60} 分鐘 </span><Edit3 size={10} className="opacity-50" />
                  </button>
                  {showDurationPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowDurationPicker(false); }}></div>
                      <DurationPickerPopover onSave={handleDurationSave} onClose={() => setShowDurationPicker(false)} />
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={handleHeartClick} className={`p-2 rounded-full transition-colors ${isFav ? 'text-orange-500 bg-orange-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}>
                    <Heart size={16} fill={isFav ? "currentColor" : "none"} />
                  </button>
                  <button onClick={handleDeleteClick} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex items-center justify-between">
              <div className="relative">
                <button onClick={(e) => {
                  e.stopPropagation(); setShowDurationPicker(!showDurationPicker);
                }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 hover:bg-teal-50 px-2 py-1 rounded transition-colors" title="點擊修改停留時間">
                  <Clock size={12} /> <span className="font-medium">{item.suggestedDuration || 60} 分鐘 </span><Edit3 size={10} className="opacity-50" />
                </button>
                {showDurationPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowDurationPicker(false); }}></div>
                    <DurationPickerPopover onSave={handleDurationSave} onClose={() => setShowDurationPicker(false)} />
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {affiliate ? (
                  <a
                    href={affiliate.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => handleAffiliateClick(e, affiliate.url, affiliate.label)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors border ${affiliate.colorClass}`}
                    title={affiliate.label}
                  >
                    <Ticket size={12} /> {affiliate.label}
                  </a>
                ) : item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors border bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100" title="前往官網">
                    <Globe size={12} /> 官網
                  </a>
                ) : null}
                <a href={googleMapsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-blue-600 flex items-center gap-1 text-[10px] bg-gray-50 px-2 py-1 rounded hover:bg-blue-50 transition-colors border border-gray-100" title="在 Google 地圖查看評論"><MapPin size={12} /> 地圖/評論 </a>

                <button onClick={handleHeartClick} className={`p-1 ml-1 rounded transition-colors ${isFav ?
                  'text-orange-500 bg-orange-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`} title={isFav ? "取消收藏" : "加入收藏"}>
                  <Heart size={14} fill={isFav ? "currentColor" : "none"} />
                </button>

                <button onClick={handleDeleteClick} className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default function Canvas({ activeDay, setActiveDay, currentTrip, handleUpdateTrip, itinerary, isGenerating, aiStatus, setIsAIModalOpen, handleRemoveFromItinerary, onPlaceSelect, onBack, handleUpdateItem, onOpenShare, onOpenExport, myFavorites, toggleFavorite }) {
  const { setNodeRef } = useDroppable({ id: 'canvas-drop-zone' });
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);

  const tripContext = useMemo(() => getTripContext(currentTrip), [currentTrip]);

  const { totalDays, currentDateDisplay } = useMemo(() => {
    if (!currentTrip?.startDate || !currentTrip?.endDate) return { totalDays: 1, currentDateDisplay: '未設定日期' };
    const start = new Date(currentTrip.startDate);
    const end = new Date(currentTrip.endDate);
    const diffDays = Math.ceil(Math.abs(end - start) / (86400000)) + 1;
    const current = new Date(start);
    current.setDate(current.getDate() + (activeDay - 1));
    return { totalDays: diffDays > 0 ? diffDays : 1, currentDateDisplay: current.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }) };
  }, [currentTrip, activeDay]);

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

  const currentDayItems = useMemo(() => itinerary.filter(item => !item.day || item.day === activeDay), [itinerary, activeDay]);

  return (
    <div ref={setNodeRef} className="flex-1 w-full bg-white flex flex-col relative z-10 border-r border-gray-200 h-full">
      <div className="hidden md:block p-4 border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-gray-800 line-clamp-1 max-w-[150px]" title={currentTrip?.title}>{currentTrip?.title || "未命名行程"}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onOpenShare} className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-full" title="分享與邀請">
              <Share2 size={18} />
            </button>
            <button onClick={onOpenExport} className="p-2 text-purple-600 hover:bg-purple-50 rounded-full transition-colors" title="匯出行程">
              <Download size={18} />
            </button>
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
              <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-50">
                 {/* 簡化版日期編輯器，實際應用應使用 App.jsx 內的 DateEditor */}
                 <div className="bg-white p-4 shadow-xl border rounded-lg w-64">
                    <p className="text-xs text-gray-500 mb-2">請使用上方手機版日期選擇器或回列表頁修改</p>
                    <button onClick={()=>setIsEditingDate(false)} className="text-xs bg-gray-200 px-2 py-1 rounded">關閉</button>
                 </div>
              </div>
            )}
          </div>
          <button onClick={() => setActiveDay(p => p + 1)} disabled={activeDay >= totalDays} className="p-1 rounded-lg hover:bg-white disabled:opacity-30"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50 pb-24 md:pb-4">
        {isGenerating && <div className="flex flex-col items-center justify-center py-10 space-y-4"><Loader2 className="animate-spin text-purple-600" size={32} /><p className="text-sm font-medium text-purple-700">{aiStatus}</p></div>}

        {!isGenerating && currentDayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 m-4 space-y-6">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-2">
              <MapPin size={48} className="opacity-30 text-gray-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-700">Day {activeDay} 還是一張白紙 </h3>
              <p className="text-sm text-gray-500 max-w-[200px] mx-auto">
                不知道要去哪裡嗎？讓 AI 幫你安排順路的景點與美食吧！
              </p>
            </div>
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="bg-purple-600 text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-purple-700 hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Sparkles size={16} />
              立即使用 AI 排程
            </button>
          </div>
        ) : (
          <SortableContext items={currentDayItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="pb-4">
              {currentDayItems.map((item, index) => (
                <SortableTripItem
                  key={item.id}
                  index={index}
                  item={item}
                  onRemove={handleRemoveFromItinerary}
                  onPlaceSelect={onPlaceSelect}
                  onUpdateItem={handleUpdateItem}
                  isGenerating={isGenerating}
                  tripId={currentTrip?.id}
                  tripContext={tripContext}
                  myFavorites={myFavorites}
                  toggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}