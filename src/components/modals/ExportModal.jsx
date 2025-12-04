import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader2, MapPin, Sparkles, Coffee, Camera } from 'lucide-react';
import { StyleManga, StyleFashion, StyleTravel, StyleJapanese, StyleArt, StyleDiary } from './ExportStyles';

// --- API 快取設定 (省錢關鍵) ---
const CACHE_KEY = 'trip_export_image_cache';
const CACHE_DURATION = 1000 * 60 * 60 * 12; // 快取有效 12 小時 (覆蓋單次編輯時長，避免 Google URL 過期)

// 讀取快取
const getCachedUrl = (key) => {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const item = cache[key];
        if (item && item.url && (Date.now() - item.timestamp < CACHE_DURATION)) {
            // console.log(`[Cache Hit] Found image for ${key}`);
            return item.url;
        }
    } catch (e) { console.warn('Cache read error', e); }
    return null;
};

// 寫入快取
const saveCachedUrl = (key, url) => {
    try {
        if (!url) return;
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        
        // 簡單的清理機制：移除超過 7 天的舊資料，避免 LocalStorage 爆炸
        const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;
        const cleanCache = {};
        Object.keys(cache).forEach(k => {
            if (Date.now() - cache[k].timestamp < ONE_WEEK) {
                cleanCache[k] = cache[k];
            }
        });

        // 寫入新資料
        cleanCache[key] = {
            url,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cleanCache));
    } catch (e) { console.warn('Cache write error', e); }
};

// 隨機 Loading 文案
const LOADING_MESSAGES = [
    "正在為您繪製行程地圖...",
    "設計師正在調整排版...",
    "正在快取圖片以節省流量...", 
    "正在挑選最美的風景照...",
    "正在計算最佳呈現比例...",
    "將回憶打包中...",
    "正在為景點添加濾鏡..."
];

export default function ExportModal({ isOpen, onClose, trip, itinerary, isMapLoaded }) {
    const [currentStyle, setCurrentStyle] = useState('art');
    const [enrichedItinerary, setEnrichedItinerary] = useState([]);
    const [enrichedTrip, setEnrichedTrip] = useState(trip);
    
    // 狀態控制
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0); 
    const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
    
    const serviceRef = useRef(null);

    // 輪播 Loading 文字
    useEffect(() => {
        if (!isLoading) return;
        const interval = setInterval(() => {
            setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 1500);
        return () => clearInterval(interval);
    }, [isLoading]);

    // 當視窗打開時，執行主要邏輯
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            setProgress(0);
            setEnrichedTrip(trip);
            setEnrichedItinerary(itinerary);

            if (isMapLoaded && window.google && window.google.maps) {
                initializeService();
                executeEnrichmentProcess();
            } else {
                setTimeout(() => setIsLoading(false), 1000);
            }
        }
    }, [isOpen, itinerary, isMapLoaded, trip]);

    const initializeService = () => {
        if (!serviceRef.current) {
            const dummyDiv = document.createElement('div');
            serviceRef.current = new window.google.maps.places.PlacesService(dummyDiv);
        }
    };

    const executeEnrichmentProcess = async () => {
        // 1. 盤點需要處理的項目 (包含原本沒有圖的，或是有圖但我們想確認是否有快取優化的)
        // 這裡我們主要針對「沒有圖」或「預設圖」的項目進行處理
        const itemsToFetch = itinerary.filter(item => 
            !item.image || item.image.includes('placehold.co') || item.image.includes('unsplash')
        );

        const needCoverImage = !trip.coverImage || trip.coverImage.includes('images.unsplash.com/photo-1540959733332');

        const totalTasks = itemsToFetch.length + (needCoverImage ? 1 : 0);

        if (totalTasks === 0) {
            setProgress(100);
            setTimeout(() => setIsLoading(false), 800);
            return;
        }

        let completedTasks = 0;
        const updateProgress = () => {
            completedTasks++;
            setProgress(Math.round((completedTasks / totalTasks) * 100));
        };

        // 3. 抓取封面圖
        if (needCoverImage) {
            // Cache Key: destination_城市名
            const cacheKey = `dest_${trip.destination || 'default'}`;
            const cachedCover = getCachedUrl(cacheKey);

            if (cachedCover) {
                setEnrichedTrip(prev => ({ ...prev, coverImage: cachedCover }));
                updateProgress();
            } else {
                fetchDestinationImage(trip.destination || "Travel").then(newCover => {
                    if (newCover) {
                        setEnrichedTrip(prev => ({ ...prev, coverImage: newCover }));
                        saveCachedUrl(cacheKey, newCover);
                    }
                    updateProgress();
                });
            }
        }

        // 4. 抓取景點圖片 (分批處理 + 快取優先)
        const BATCH_SIZE = 5; // 因為有快取，可以稍微加大並發量
        const updatedItemsMap = {};

        // 輔助：生成項目的 Cache Key
        const getItemCacheKey = (item) => {
            let idPart = item.place_id || item.id;
            // 清理 ID
            if (idPart.startsWith('ai-')) idPart = idPart.replace(/^ai-/, '').split('-')[0];
            return `place_${idPart}_${item.name}`; // 組合 ID 和 名稱確保唯一
        };

        for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
            const batch = itemsToFetch.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (item) => {
                const cacheKey = getItemCacheKey(item);
                const cachedUrl = getCachedUrl(cacheKey);

                if (cachedUrl) {
                    // 命中快取！省錢！
                    updatedItemsMap[item.id] = cachedUrl;
                    updateProgress();
                    return;
                }

                // 沒命中快取，呼叫 API
                return fetchItemImage(item).then(url => {
                    if (url) {
                        updatedItemsMap[item.id] = url;
                        saveCachedUrl(cacheKey, url); // 存入快取
                    }
                    updateProgress();
                });
            }));

            // 稍微暫停，但如果有快取其實會跑很快
            await new Promise(r => setTimeout(r, 200));
        }

        // 5. 更新行程資料
        setEnrichedItinerary(prev => prev.map(item => {
            if (updatedItemsMap[item.id]) {
                return { ...item, image: updatedItemsMap[item.id] };
            }
            return item;
        }));

        // 6. 結束 Loading
        setTimeout(() => setIsLoading(false), 500);
    };

    // 抓取單一項目圖片的邏輯
    const fetchItemImage = (item) => {
        return new Promise((resolve) => {
            let rawPlaceId = item.place_id;
            
            // 清理 ID 邏輯優化
            if (rawPlaceId) {
                // 移除 ai- 前綴
                if (rawPlaceId.startsWith('ai-')) {
                    rawPlaceId = rawPlaceId.replace(/^ai-/, '');
                    // 如果有後綴 (例如 ai-ChIJxxxx-day1)，嘗試切割
                    if (rawPlaceId.includes('-')) {
                        const potentialId = rawPlaceId.split('-')[0];
                        // Google Place ID 通常是 27+ 字元，且不包含特殊符號
                        if (potentialId.length > 20) {
                            rawPlaceId = potentialId;
                        }
                    }
                }
                // 移除 place- 前綴
                if (rawPlaceId.startsWith('place-')) rawPlaceId = rawPlaceId.replace(/^place-/, '');
            }

            // 更嚴格的檢查：Google Place ID 通常以 ChIJ 開頭 (雖然不是絕對，但能過濾掉大部分 UUID)
            // 並且長度足夠，且不能包含空格
            const isValidPlaceId = rawPlaceId && 
                                 rawPlaceId.length > 20 && 
                                 !rawPlaceId.includes('temp') && 
                                 !rawPlaceId.includes(' ') &&
                                 // 增加容錯：如果不是 ChIJ 開頭，我們就當作它可能是無效的，直接用搜尋比較保險
                                 (rawPlaceId.startsWith('ChIJ') || rawPlaceId.startsWith('G_'));

            const handlePhotoResult = (photos) => {
                if (photos && photos.length > 0) {
                    try {
                        resolve(photos[0].getUrl({ maxWidth: 800 }));
                        return true;
                    } catch (e) { console.warn(e); }
                }
                return false;
            };

            // 執行策略
            const trySearch = () => {
                // 確保有名稱才搜尋
                if (!item.name) {
                    resolve(null);
                    return;
                }
                
                // 策略 B: 用名稱搜尋
                fallbackSearch(item.name).then(url => {
                    if (url) resolve(url);
                    else {
                        // 策略 C: 城市 + 類別
                        const genericQuery = `${trip.destination || ''} ${item.category || 'scenery point'}`;
                        fallbackSearch(genericQuery).then(resolve);
                    }
                });
            };

            // 策略 A: 用 Place ID
            if (isValidPlaceId) {
                const request = { placeId: rawPlaceId, fields: ['photos'] };
                try {
                    serviceRef.current.getDetails(request, (place, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && place && handlePhotoResult(place.photos)) {
                            return;
                        }
                        // 失敗就轉搜尋
                        trySearch();
                    });
                } catch (e) {
                    console.warn("Place Details Error:", e);
                    trySearch();
                }
            } else {
                // 如果 ID 看起來無效，直接用搜尋
                trySearch();
            }
        }).catch((e) => {
            console.error("Fetch Image Error", e);
            resolve(null);
        });
    };

    const fallbackSearch = (query) => {
        return new Promise(resolve => {
            if (!query) {
                resolve(null);
                return;
            }
            const request = { query: query, fields: ['photos'] };
            serviceRef.current.findPlaceFromQuery(request, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0 && results[0].photos) {
                    try {
                        resolve(results[0].photos[0].getUrl({ maxWidth: 800 }));
                    } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        });
    };

    const fetchDestinationImage = (destination) => {
        return new Promise(resolve => {
            const request = { query: `${destination} travel landmark`, fields: ['photos'] };
            serviceRef.current.findPlaceFromQuery(request, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0 && results[0].photos) {
                    try {
                        resolve(results[0].photos[0].getUrl({ maxWidth: 1200 }));
                    } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        }).catch(() => resolve(null));
    };

    // 強制重新整理 (清除快取)
    const handleForceRefresh = () => {
        if (window.confirm("要重新搜尋並更新所有圖片嗎？\n這將會清除快取並重新呼叫 API，可能需要一點時間。")) {
            // 清除相關快取
            try {
                const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
                // 這裡簡單粗暴清除全部，或者你可以只清除目前行程相關的
                // 為了方便，我們先清除全部，確保拿到最新
                localStorage.removeItem(CACHE_KEY); 
                console.log("Cache cleared");
            } catch (e) {}

            setIsLoading(true);
            setEnrichedItinerary(itinerary); 
            // 重新執行
            executeEnrichmentProcess();
        }
    };

    if (!isOpen || !trip) return null;

    const safeTrip = {
        ...enrichedTrip,
        coverImage: enrichedTrip.coverImage || "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1600&auto=format&fit=crop",
        title: trip.title || "未命名行程",
        destination: trip.destination || "TripCanvas"
    };

    // 全螢幕 Loading 視圖
    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-md text-white animate-in fade-in duration-300">
                <div className="w-64 flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                        <Loader2 size={48} className="animate-spin text-blue-400 relative z-10" />
                    </div>
                    
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold tracking-wider">{progress}%</h3>
                        <p className="text-sm text-gray-400 min-h-[20px] animate-pulse">
                            {LOADING_MESSAGES[loadingMsgIndex]}
                        </p>
                    </div>

                    {/* 進度條 */}
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700">
                        <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300 ease-out" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <button 
                        onClick={() => setIsLoading(false)}
                        className="mt-8 text-xs text-gray-600 hover:text-gray-400 underline decoration-dotted"
                    >
                        跳過等待，直接預覽
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-300">
            <div className="w-full h-full max-w-7xl flex flex-col md:flex-row gap-4">
                {/* Sidebar Controls */}
                <div className="w-full md:w-64 bg-gray-900 rounded-xl p-4 flex flex-col gap-2 shrink-0 overflow-y-auto border border-gray-800 print:hidden">
                    <div className="flex justify-between items-center text-white mb-6 px-2">
                        <span className="font-bold text-sm">選擇風格</span>
                        <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded transition-colors"><X size={18}/></button>
                    </div>
                    
                    {/* 風格選擇 */}
                    {[
                        {id: 'manga', name: '日式漫畫 Manga', icon: '🗯️'},
                        {id: 'fashion', name: '時尚 Vogue', icon: '👠'},
                        {id: 'travel', name: '旅人 NatGeo', icon: '🌍'},
                        {id: 'japanese', name: '日式 Zen', icon: '🍵'},
                        {id: 'art', name: '藝術 Cinematic', icon: '🎬'},
                        {id: 'diary', name: '少女日記 Kawaii', icon: '🎀'},
                    ].map(style => (
                        <button key={style.id} onClick={() => setCurrentStyle(style.id)} className={`p-4 rounded-xl flex items-center gap-3 transition-all ${currentStyle === style.id ? 'bg-white text-black shadow-lg scale-105 ring-2 ring-white/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                            <span className="text-xl">{style.icon}</span><span className="font-bold text-sm">{style.name}</span>
                        </button>
                    ))}

                    <div className="mt-auto pt-6 border-t border-gray-700 space-y-3">
                        <button 
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                            onClick={() => window.print()}
                        >
                            <Printer size={16}/> 列印 / 存為 PDF
                        </button>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-2xl relative group">
                    <div className="absolute inset-0 overflow-y-auto custom-scrollbar bg-gray-100 print:static print:h-auto print:overflow-visible print:bg-white">
                        {currentStyle === 'manga' && <StyleManga trip={safeTrip} itinerary={enrichedItinerary} />}
                        {currentStyle === 'fashion' && <StyleFashion trip={safeTrip} itinerary={enrichedItinerary} />}
                        {currentStyle === 'travel' && <StyleTravel trip={safeTrip} itinerary={enrichedItinerary} />}
                        {currentStyle === 'japanese' && <StyleJapanese trip={safeTrip} itinerary={enrichedItinerary} />}
                        {currentStyle === 'art' && <StyleArt trip={safeTrip} itinerary={enrichedItinerary} />}
                        {currentStyle === 'diary' && <StyleDiary trip={safeTrip} itinerary={enrichedItinerary} />}
                    </div>

                    {/* 浮動的重新抓取按鈕 (如果用戶覺得圖片不滿意) */}
                    <button 
                        onClick={handleForceRefresh}
                        className="absolute bottom-4 right-4 bg-gray-800/80 hover:bg-black text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                        title="重新抓取圖片 (清除快取)"
                    >
                        <Sparkles size={16} />
                    </button>
                </div>
            </div>
            
            {/* Print specific CSS override */}
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; }
                    .print\\:hidden { display: none !important; }
                    .print\\:static { position: static !important; }
                    .print\\:overflow-visible { overflow: visible !important; }
                    .print\\:h-auto { height: auto !important; }
                }
            `}</style>
        </div>
    );
}