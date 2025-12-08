import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader2, RefreshCcw, Download, ChevronDown, Calendar, AlertTriangle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { StyleManga, StyleFashion, StyleTravel, StyleJapanese, StyleArt, StyleDiary } from './ExportStyles';

// --- 常數設定 ---
const CACHE_KEY = 'trip_export_image_cache';
const CACHE_DURATION = 1000 * 60 * 60 * 12;
const A4_PIXEL_WIDTH = 794; 

// Google API 設定
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

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

// --- 快取輔助函式 ---
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
  const [previewScale, setPreviewScale] = useState(0.6);
  
  // Google API 狀態
  const [isApiReady, setIsApiReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // 🟢 儲存 Token Client 實例
  const tokenClient = useRef(null);

  const serviceRef = useRef(null);
  const isMounted = useRef(false);
  const componentRef = useRef(null);
  const previewContainerRef = useRef(null);

  // 🟢 1. 初始化 Google API (GAPI + GIS)
  useEffect(() => {
    if (!isOpen) return;

    const initializeGoogleModules = async () => {
      // 等待 script 載入
      if (!window.gapi || !window.google) {
        setTimeout(initializeGoogleModules, 500);
        return;
      }

      try {
        // A. 載入 GAPI Client (用於操作日曆 API)
        await new Promise((resolve) => window.gapi.load('client', resolve));
        await window.gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });

        // B. 初始化 GIS Token Client (用於處理登入授權)
        // 這是解決 IdentityCredentialError 的關鍵
        tokenClient.current = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: '', // callback 在 requestAccessToken 時動態指定
        });

        setIsApiReady(true);
        console.log("✅ Google API & GIS initialized successfully");

      } catch (error) {
        console.error("Google API Init Error:", error);
      }
    };

    initializeGoogleModules();
  }, [isOpen]);

  // 🟢 2. 匯出邏輯 (新版流程)
  const handleExportToGoogleCalendar = async () => {
    if (!isApiReady) {
      alert("Google 服務初始化中，請稍候...");
      return;
    }
    if (!itinerary || itinerary.length === 0) {
      alert("行程是空的，無法匯出。");
      return;
    }

    setIsExporting(true);

    // 定義匯出執行的核心函式 (在取得 Token 後執行)
    const executeExport = async () => {
      try {
        const batch = window.gapi.client.newBatch();
        let eventCount = 0;
        const tripStartDate = new Date(trip.startDate);

        if (isNaN(tripStartDate.getTime())) {
          throw new Error("行程日期無效");
        }

        itinerary.forEach((item) => {
          if (!item.day || !item.time) return;

          // 計算日期
          const itemDate = new Date(tripStartDate);
          itemDate.setDate(tripStartDate.getDate() + (parseInt(item.day) - 1));
          const dateStr = itemDate.toISOString().split('T')[0];
          
          // 計算時間
          const startDateTimeStr = `${dateStr}T${item.time}:00`; 
          const startObj = new Date(startDateTimeStr);
          const duration = Number(item.duration || item.suggestedDuration || 60);
          const endObj = new Date(startObj.getTime() + duration * 60000);

          const eventResource = {
            'summary': `[TripCanvas] ${item.name}`,
            'location': item.name,
            'description': `${item.aiSummary || '無摘要'}\n標籤: ${item.tags?.join(', ') || ''}`,
            'start': {
              'dateTime': startObj.toISOString(),
              'timeZone': 'Asia/Taipei'
            },
            'end': {
              'dateTime': endObj.toISOString(),
              'timeZone': 'Asia/Taipei'
            }
          };

          const request = window.gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': eventResource
          });
          batch.add(request);
          eventCount++;
        });

        if (eventCount > 0) {
          const response = await batch.then();
          console.log("Batch Result:", response);
          alert(`🎉 成功匯出 ${eventCount} 個行程到您的 Google 日曆！`);
        } else {
          alert("沒有設定具體時間的行程，無法匯出。");
        }

      } catch (error) {
        console.error("Export Execution Error:", error);
        alert(`匯出過程發生錯誤: ${error.message}`);
      } finally {
        setIsExporting(false);
      }
    };

    // 🟢 觸發登入/授權流程
    // 每次請求都檢查 Token，如果過期或不存在，GIS 會自動彈窗
    tokenClient.current.callback = async (resp) => {
      if (resp.error !== undefined) {
        throw (resp);
      }
      // 授權成功，執行匯出
      await executeExport();
    };

    // 檢查是否有足夠權限，如果沒有就請求
    if (window.gapi.client.getToken() === null) {
      // 請求授權 (觸發彈窗)
      tokenClient.current.requestAccessToken({prompt: 'consent'});
    } else {
      // 已經有 Token，直接執行
      tokenClient.current.requestAccessToken({prompt: ''});
    }
  };

  useEffect(() => {
    const calculateScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.offsetWidth;
      const padding = 32; 
      const availableWidth = containerWidth - padding;
      let scale = availableWidth / A4_PIXEL_WIDTH;
      scale = Math.min(Math.max(scale, 0.3), 0.8);
      setPreviewScale(scale);
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [isOpen]);

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
    
    if (isMounted.current) { 
        setEnrichedItinerary(prev => prev.map(item => { if (updatedItemsMap[item.id]) return { ...item, image: updatedItemsMap[item.id] }; return item; }));
        setTimeout(() => setIsLoading(false), 500); 
    }
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

        {/* Mobile Controls */}
        <div className="md:hidden flex flex-col bg-gray-900 p-4 shrink-0 border-b border-gray-800 gap-3">
          <div className="flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <Printer size={18} className="text-purple-400"/>
              <span className="font-bold text-sm">匯出預覽</span>
            </div>
            <button onClick={onClose} className="p-1 rounded bg-gray-800 text-gray-300"><X size={18}/></button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select value={currentStyle} onChange={(e) => setCurrentStyle(e.target.value)} className="w-full appearance-none bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-purple-500">
                {STYLES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
            <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap"><Download size={16}/> PDF</button>
            <button 
              onClick={handleExportToGoogleCalendar} 
              disabled={!isApiReady || isExporting}
              className={`${!isApiReady ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600'} text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap`}
            >
              {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Calendar size={16}/>}
              日曆
            </button>
          </div>
        </div>

        {/* Desktop Sidebar */}
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
              <button key={style.id} onClick={() => setCurrentStyle(style.id)} className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border ${currentStyle === style.id ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-gray-800 text-gray-400 border-transparent hover:bg-gray-700'}`}>
                <span className="text-2xl">{style.icon}</span>
                <div className="text-left"><div className="font-bold text-sm">{style.name}</div></div>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-6 border-t border-gray-700 space-y-3">
            {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <div className="text-red-400 text-xs p-2 border border-red-500 rounded flex items-center gap-2">
                <AlertTriangle size={14}/> 缺少 Client ID
              </div>
            )}
            <button 
              onClick={handleExportToGoogleCalendar} 
              disabled={!isApiReady || isExporting}
              className={`w-full border-2 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 ${!isApiReady ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' : 'bg-white border-green-500 text-green-600 hover:bg-green-50'}`}
            >
              {isExporting ? <Loader2 size={18} className="animate-spin"/> : <Calendar size={18}/>}
              匯出至 Google 日曆
            </button>
            <button onClick={handlePrint} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95">
              <Download size={16}/> 列印 / 存為 PDF
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div ref={previewContainerRef} className="flex-1 bg-gray-800/50 md:rounded-xl overflow-y-auto custom-scrollbar relative flex flex-col items-center p-2 md:p-8 border border-white/10">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 px-4 py-1 rounded-full text-[10px] backdrop-blur font-mono border border-white/10 pointer-events-none print:hidden z-10">PREVIEW MODE</div>
          <div className="print-preview-wrapper transition-transform duration-300 ease-out origin-top" style={{ transform: `scale(${previewScale})`, marginBottom: `-${(1 - previewScale) * 100}%` }}>
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