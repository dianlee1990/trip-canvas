import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader2, RefreshCcw, Download, ChevronDown } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { StyleManga, StyleFashion, StyleTravel, StyleJapanese, StyleArt, StyleDiary } from './ExportStyles';

// --- 常數設定 ---
const CACHE_KEY = 'trip_export_image_cache';
const CACHE_DURATION = 1000 * 60 * 60 * 12;
const A4_PIXEL_WIDTH = 794; // A4 寬度 (210mm @ 96dpi approx)

const STYLES = [
  {id: 'japanese', name: '日式 Zen', icon: '⛩️', component: StyleJapanese},
  {id: 'manga', name: '日式漫畫', icon: '🗯️', component: StyleManga},
  {id: 'fashion', name: '時尚 Vogue', icon: '👠', component: StyleFashion},
  {id: 'travel', name: '旅人 NatGeo', icon: '🌏', component: StyleTravel},
  {id: 'art', name: '藝術 Cinema', icon: '🎬', component: StyleArt},
  {id: 'diary', name: '少女日記', icon: '📝', component: StyleDiary},
];

const LOADING_MESSAGES = [
  "正在為您繪製行程地圖...", "設計師正在調整排版...", "正在快取圖片以節省流量...",
  "正在挑選最美的風景照...", "正在計算最佳呈現比例...", "將回憶打包中...", "正在為景點添加濾鏡..."
];

// --- 快取輔助函式 (保持不變) ---
const getCachedUrl = (key) => {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const item = cache[key];
    if (item && item.url && (Date.now() - item.timestamp < CACHE_DURATION)) return item.url;
  } catch (e) { console.warn('Cache read error', e); }
  return null;
};

const saveCachedUrl = (key, url) => {
  try {
    if (!url) return;
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;
    const cleanCache = {};
    Object.keys(cache).forEach(k => {
      if (Date.now() - cache[k].timestamp < ONE_WEEK) cleanCache[k] = cache[k];
    });
    cleanCache[key] = { url, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cleanCache));
  } catch (e) { console.warn('Cache write error', e); }
};

export default function ExportModal({ isOpen, onClose, trip, itinerary, isMapLoaded }) {
  const [currentStyle, setCurrentStyle] = useState('manga');
  const [enrichedItinerary, setEnrichedItinerary] = useState([]);
  const [enrichedTrip, setEnrichedTrip] = useState(trip);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  
  // 🟢 新增：預覽縮放比例 State
  const [previewScale, setPreviewScale] = useState(0.6);

  const serviceRef = useRef(null);
  const isMounted = useRef(false);
  const componentRef = useRef(null);
  const previewContainerRef = useRef(null);

  // 🟢 監聽視窗大小，動態計算縮放比例 (解決手機版左右滑動問題)
  useEffect(() => {
    const calculateScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.offsetWidth;
      const padding = 32; // 左右留白
      const availableWidth = containerWidth - padding;
      
      // 計算比例：螢幕可用寬度 / A4 實際寬度
      // 手機版通常會 < 0.5，桌面版限制最大 0.8 以免太大
      let scale = availableWidth / A4_PIXEL_WIDTH;
      scale = Math.min(Math.max(scale, 0.3), 0.8); // 限制範圍
      
      setPreviewScale(scale);
    };

    // 初始計算
    calculateScale();
    // 監聽 Resize
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [isOpen]); // 當 Modal 打開時重新計算

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `TripCanvas_${trip?.title || 'Itinerary'}`,
    onAfterPrint: () => console.log("列印完成"),
    pageStyle: `
      @page { size: A4 portrait; margin: 0; }
      @media print {
        html, body { height: auto !important; min-height: 100% !important; overflow: visible !important; }
        .a4-page { break-after: page !important; page-break-after: always !important; height: 297mm !important; width: 100% !important; }
      }
    `,
  });

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    isMounted.current = true;
    if (isOpen) {
      setIsLoading(true);
      setProgress(0);
      setEnrichedTrip(trip);
      setEnrichedItinerary(JSON.parse(JSON.stringify(itinerary)));

      if (isMapLoaded && window.google && window.google.maps) {
        if (!serviceRef.current) {
          const dummyDiv = document.createElement('div');
          serviceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
        }
        executeEnrichmentProcess();
      } else {
        setTimeout(() => isMounted.current && setIsLoading(false), 1000);
      }
    }
    return () => { isMounted.current = false; };
  }, [isOpen, itinerary, isMapLoaded, trip]);

  // ... (省略 lengthy executeEnrichmentProcess, fetchItemImage 等邏輯，保持原樣) ...
  const executeEnrichmentProcess = async () => {
    const itemsToFetch = itinerary.filter(item => !item.image || item.image.includes('placehold.co') || item.image.includes('unsplash'));
    const needCoverImage = !trip.coverImage || trip.coverImage.includes('images.unsplash.com/photo-1540959733332');
    const totalTasks = itemsToFetch.length + (needCoverImage ? 1 : 0);
    if (totalTasks === 0) { setProgress(100); setTimeout(() => isMounted.current && setIsLoading(false), 800); return; }
    let completedTasks = 0;
    const updateProgress = () => { if (!isMounted.current) return; completedTasks++; setProgress(Math.round((completedTasks / totalTasks) * 100)); };
    if (needCoverImage) {
      const cacheKey = `dest_${trip.destination || 'default'}`;
      const cachedCover = getCachedUrl(cacheKey);
      if (cachedCover) { if(isMounted.current) setEnrichedTrip(prev => ({ ...prev, coverImage: cachedCover })); updateProgress(); } 
      else { fetchDestinationImage(trip.destination || "Travel").then(newCover => { if (isMounted.current && newCover) { setEnrichedTrip(prev => ({ ...prev, coverImage: newCover })); saveCachedUrl(cacheKey, newCover); } updateProgress(); }); }
    }
    const BATCH_SIZE = 5;
    const updatedItemsMap = {};
    const getItemCacheKey = (item) => { let idPart = item.place_id || item.id; if (idPart.startsWith('ai-')) idPart = idPart.replace(/^ai-/, '').split('-')[0]; return `place_${idPart}_${item.name}`; };
    for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
      if (!isMounted.current) break;
      const batch = itemsToFetch.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item) => {
        const cacheKey = getItemCacheKey(item);
        const cachedUrl = getCachedUrl(cacheKey);
        if (cachedUrl) { updatedItemsMap[item.id] = cachedUrl; updateProgress(); return; }
        return fetchItemImage(item).then(url => { if (url) { updatedItemsMap[item.id] = url; saveCachedUrl(cacheKey, url); } updateProgress(); });
      }));
      await new Promise(r => setTimeout(r, 200));
    }
    if (isMounted.current) { setEnrichedItinerary(prev => prev.map(item => { if (updatedItemsMap[item.id]) return { ...item, image: updatedItemsMap[item.id] }; return item; })); setTimeout(() => setIsLoading(false), 500); }
  };
  const fetchItemImage = (item) => {
    return new Promise((resolve) => {
      let rawPlaceId = item.place_id;
      if (rawPlaceId && rawPlaceId.startsWith('ai-')) rawPlaceId = rawPlaceId.replace(/^ai-/, '').split('-')[0];
      if (rawPlaceId && rawPlaceId.startsWith('place-')) rawPlaceId = rawPlaceId.replace(/^place-/, '');
      const isValidPlaceId = rawPlaceId && rawPlaceId.length > 20 && !rawPlaceId.includes('temp') && (rawPlaceId.startsWith('ChIJ') || rawPlaceId.startsWith('G_'));
      const trySearch = () => { if (!item.name) { resolve(null); return; } fallbackSearch(item.name).then(url => { if (url) resolve(url); else fallbackSearch(`${trip.destination || ''} ${item.name}`).then(resolve); }); };
      if (isValidPlaceId && serviceRef.current) { serviceRef.current.getDetails({ placeId: rawPlaceId, fields: ['photos'] }, (place, status) => { if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.photos?.length > 0) { try { resolve(place.photos[0].getUrl({ maxWidth: 800 })); } catch (e) { trySearch(); } } else { trySearch(); } }); } else { trySearch(); }
    }).catch(() => resolve(null));
  };
  const fallbackSearch = (query) => new Promise(resolve => { if (!query || !serviceRef.current) { resolve(null); return; } serviceRef.current.findPlaceFromQuery({ query: query, fields: ['photos'] }, (results, status) => { if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.photos?.length > 0) { try { resolve(results[0].photos[0].getUrl({ maxWidth: 800 })); } catch (e) { resolve(null); } } else { resolve(null); } }); });
  const fetchDestinationImage = (destination) => new Promise(resolve => { if (!serviceRef.current) { resolve(null); return; } serviceRef.current.findPlaceFromQuery({ query: `${destination} travel landmark`, fields: ['photos'] }, (results, status) => { if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.photos?.length > 0) { try { resolve(results[0].photos[0].getUrl({ maxWidth: 1200 })); } catch (e) { resolve(null); } } else { resolve(null); } }); }).catch(() => resolve(null));
  const handleForceRefresh = () => { if (window.confirm("重新搜尋圖片？")) { localStorage.removeItem(CACHE_KEY); setIsLoading(true); executeEnrichmentProcess(); } };

  if (!isOpen || !trip) return null;
  const SelectedStyleComponent = STYLES.find(s => s.id === currentStyle)?.component || StyleJapanese;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-md text-white">
        <div className="w-64 flex flex-col items-center gap-6">
          <Loader2 size={48} className="animate-spin text-blue-400" />
          <h3 className="text-xl font-bold">{progress}%</h3>
          <p className="text-sm text-gray-400 animate-pulse">{LOADING_MESSAGES[loadingMsgIndex]}</p>
          <button onClick={() => setIsLoading(false)} className="mt-8 text-xs text-gray-600 hover:text-gray-400 underline">跳過等待</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-300">
      <div className="w-full h-full max-w-7xl flex flex-col md:flex-row gap-4 overflow-hidden relative">

        {/* 🟢 Mobile Controls (手機版頂部控制列) */}
        <div className="md:hidden flex flex-col bg-gray-900 p-4 shrink-0 border-b border-gray-800 gap-3">
           <div className="flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-purple-400"/>
                <span className="font-bold text-sm">匯出預覽</span>
              </div>
              <button onClick={onClose} className="p-1 rounded bg-gray-800 text-gray-300"><X size={18}/></button>
           </div>
           
           {/* 下拉選單 + 列印按鈕 */}
           <div className="flex gap-2">
              <div className="relative flex-1">
                 <select 
                    value={currentStyle} 
                    onChange={(e) => setCurrentStyle(e.target.value)}
                    className="w-full appearance-none bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-purple-500"
                 >
                    {STYLES.map(s => (
                       <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                    ))}
                 </select>
                 <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              </div>
              <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap">
                 <Download size={16}/> PDF
              </button>
           </div>
        </div>

        {/* 🔵 Desktop Sidebar (桌面版左側面板) - 手機版隱藏 */}
        <div className="hidden md:flex w-72 bg-gray-900 rounded-xl p-4 flex-col gap-2 shrink-0 overflow-y-auto border border-gray-800 custom-scrollbar print:hidden">
          <div className="flex justify-between items-center text-white mb-4 px-2">
            <div className="flex items-center gap-2">
              <Printer size={18} className="text-purple-400"/>
              <span className="font-bold text-sm">匯出行程</span>
            </div>
            <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded transition-colors text-gray-400 hover:text-white"><X size={18}/></button>
          </div>

          <div className="space-y-2">
            {STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => setCurrentStyle(style.id)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border ${currentStyle === style.id ?
                  'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-gray-800 text-gray-400 border-transparent hover:bg-gray-700'}`}
              >
                <span className="text-2xl">{style.icon}</span>
                <div className="text-left">
                  <div className="font-bold text-sm">{style.name}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-6 border-t border-gray-700 space-y-3">
            <button onClick={handlePrint} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95">
              <Download size={16}/> 列印 / 存為 PDF
            </button>
          </div>
        </div>

        {/* 右側預覽區域 (共用) */}
        {/* 🟢 這裡加上 ref={previewContainerRef} 用於計算寬度 */}
        <div ref={previewContainerRef} className="flex-1 bg-gray-800/50 md:rounded-xl overflow-y-auto custom-scrollbar relative flex flex-col items-center p-2 md:p-8 border border-white/10">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 px-4 py-1 rounded-full text-[10px] backdrop-blur font-mono border border-white/10 pointer-events-none print:hidden z-10">
            PREVIEW MODE
          </div>

          {/* 🟢 動態縮放 Wrapper */}
          <div 
            className="print-preview-wrapper transition-transform duration-300 ease-out origin-top"
            style={{ 
              transform: `scale(${previewScale})`, 
              marginBottom: `-${(1 - previewScale) * 100}%` // 修正縮放後下方的留白
            }}
          >
             <div ref={componentRef}>
                <SelectedStyleComponent trip={enrichedTrip} itinerary={enrichedItinerary} />
             </div>
          </div>

          <button onClick={handleForceRefresh} className="absolute bottom-6 right-6 bg-gray-800 hover:bg-black text-white p-3 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-all border border-gray-600 print:hidden z-20" title="重新抓圖">
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}