import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader2, MapPin, Sparkles, Download, RefreshCcw } from 'lucide-react';
import { StyleManga, StyleFashion, StyleTravel, StyleJapanese, StyleArt, StyleDiary } from './ExportStyles';

// --- 常數設定 ---
const CACHE_KEY = 'trip_export_image_cache';
const CACHE_DURATION = 1000 * 60 * 60 * 12; // 12 小時快取

const STYLES = [
    {id: 'japanese', name: '日式 Zen', icon: '⛩️', component: StyleJapanese},
    {id: 'manga', name: '日式漫畫 Manga', icon: '🗯️', component: StyleManga},
    {id: 'fashion', name: '時尚 Vogue', icon: '👠', component: StyleFashion},
    {id: 'travel', name: '旅人 NatGeo', icon: '🌏', component: StyleTravel},
    {id: 'art', name: '藝術 Cinematic', icon: '🎬', component: StyleArt},
    {id: 'diary', name: '少女日記 Kawaii', icon: '📝', component: StyleDiary},
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
        if (item && item.url && (Date.now() - item.timestamp < CACHE_DURATION)) {
            return item.url;
        }
    } catch (e) { console.warn('Cache read error', e); }
    return null;
};

const saveCachedUrl = (key, url) => {
    try {
        if (!url) return;
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        // 清理超過 7 天的舊資料
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
    const [currentStyle, setCurrentStyle] = useState('japanese');
    const [enrichedItinerary, setEnrichedItinerary] = useState([]);
    const [enrichedTrip, setEnrichedTrip] = useState(trip);
    
    // 狀態控制
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0); 
    const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
    
    const serviceRef = useRef(null);
    const isMounted = useRef(false); // 防止卸載後更新狀態

    // 輪播 Loading 文字
    useEffect(() => {
        if (!isLoading) return;
        const interval = setInterval(() => {
            setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 1500);
        return () => clearInterval(interval);
    }, [isLoading]);

    // 初始化與執行
    useEffect(() => {
        isMounted.current = true;
        if (isOpen) {
            setIsLoading(true);
            setProgress(0);
            setEnrichedTrip(trip);
            // 深拷貝 itinerary 避免汙染原始資料
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
        // 1. 找出需要圖片的項目 (排除已有圖片且非 placeholder 的)
        const itemsToFetch = itinerary.filter(item => 
            !item.image || item.image.includes('placehold.co') || item.image.includes('unsplash')
        );

        const needCoverImage = !trip.coverImage || trip.coverImage.includes('images.unsplash.com/photo-1540959733332');
        const totalTasks = itemsToFetch.length + (needCoverImage ? 1 : 0);

        if (totalTasks === 0) {
            setProgress(100);
            setTimeout(() => isMounted.current && setIsLoading(false), 800);
            return;
        }

        let completedTasks = 0;
        const updateProgress = () => {
            if (!isMounted.current) return;
            completedTasks++;
            setProgress(Math.round((completedTasks / totalTasks) * 100));
        };

        // 2. 處理封面圖
        if (needCoverImage) {
            const cacheKey = `dest_${trip.destination || 'default'}`;
            const cachedCover = getCachedUrl(cacheKey);
            if (cachedCover) {
                if(isMounted.current) setEnrichedTrip(prev => ({ ...prev, coverImage: cachedCover }));
                updateProgress();
            } else {
                fetchDestinationImage(trip.destination || "Travel").then(newCover => {
                    if (isMounted.current && newCover) {
                        setEnrichedTrip(prev => ({ ...prev, coverImage: newCover }));
                        saveCachedUrl(cacheKey, newCover);
                    }
                    updateProgress();
                });
            }
        }

        // 3. 處理景點圖片 (分批處理)
        const BATCH_SIZE = 5;
        const updatedItemsMap = {};

        const getItemCacheKey = (item) => {
            let idPart = item.place_id || item.id;
            if (idPart.startsWith('ai-')) idPart = idPart.replace(/^ai-/, '').split('-')[0];
            return `place_${idPart}_${item.name}`; 
        };

        for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
            if (!isMounted.current) break;
            const batch = itemsToFetch.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (item) => {
                const cacheKey = getItemCacheKey(item);
                const cachedUrl = getCachedUrl(cacheKey);

                if (cachedUrl) {
                    updatedItemsMap[item.id] = cachedUrl;
                    updateProgress();
                    return;
                }

                return fetchItemImage(item).then(url => {
                    if (url) {
                        updatedItemsMap[item.id] = url;
                        saveCachedUrl(cacheKey, url);
                    }
                    updateProgress();
                });
            }));
            await new Promise(r => setTimeout(r, 200)); // 避免 API Rate Limit
        }

        if (isMounted.current) {
            setEnrichedItinerary(prev => prev.map(item => {
                if (updatedItemsMap[item.id]) return { ...item, image: updatedItemsMap[item.id] };
                return item;
            }));
            setTimeout(() => setIsLoading(false), 500);
        }
    };

    const fetchItemImage = (item) => {
        return new Promise((resolve) => {
            let rawPlaceId = item.place_id;
            // ID 清理邏輯
            if (rawPlaceId) {
                if (rawPlaceId.startsWith('ai-')) rawPlaceId = rawPlaceId.replace(/^ai-/, '').split('-')[0];
                if (rawPlaceId.startsWith('place-')) rawPlaceId = rawPlaceId.replace(/^place-/, '');
            }

            const isValidPlaceId = rawPlaceId && rawPlaceId.length > 20 && !rawPlaceId.includes('temp') && (rawPlaceId.startsWith('ChIJ') || rawPlaceId.startsWith('G_'));

            const trySearch = () => {
                if (!item.name) { resolve(null); return; }
                // 先搜名字
                fallbackSearch(item.name).then(url => {
                    if (url) resolve(url);
                    else {
                        // 再搜 城市 + 名字
                        fallbackSearch(`${trip.destination || ''} ${item.name}`).then(resolve);
                    }
                });
            };

            if (isValidPlaceId && serviceRef.current) {
                serviceRef.current.getDetails({ placeId: rawPlaceId, fields: ['photos'] }, (place, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.photos?.length > 0) {
                        try { resolve(place.photos[0].getUrl({ maxWidth: 800 })); } catch (e) { trySearch(); }
                    } else {
                        trySearch();
                    }
                });
            } else {
                trySearch();
            }
        }).catch(() => resolve(null));
    };

    const fallbackSearch = (query) => {
        return new Promise(resolve => {
            if (!query || !serviceRef.current) { resolve(null); return; }
            serviceRef.current.findPlaceFromQuery({ query: query, fields: ['photos'] }, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.photos?.length > 0) {
                    try { resolve(results[0].photos[0].getUrl({ maxWidth: 800 })); } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        });
    };

    const fetchDestinationImage = (destination) => {
        return new Promise(resolve => {
            if (!serviceRef.current) { resolve(null); return; }
            serviceRef.current.findPlaceFromQuery({ query: `${destination} travel landmark`, fields: ['photos'] }, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]?.photos?.length > 0) {
                    try { resolve(results[0].photos[0].getUrl({ maxWidth: 1200 })); } catch (e) { resolve(null); }
                } else {
                    resolve(null);
                }
            });
        }).catch(() => resolve(null));
    };

    const handleForceRefresh = () => {
        if (window.confirm("要重新搜尋並更新所有圖片嗎？\n這將會清除快取並重新呼叫 API。")) {
            localStorage.removeItem(CACHE_KEY);
            setIsLoading(true);
            executeEnrichmentProcess();
        }
    };

    if (!isOpen || !trip) return null;

    // 取得當前選中的風格元件
    const SelectedStyleComponent = STYLES.find(s => s.id === currentStyle)?.component || StyleJapanese;

    // Loading 畫面
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
                        <p className="text-sm text-gray-400 min-h-[20px] animate-pulse">{LOADING_MESSAGES[loadingMsgIndex]}</p>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}/>
                    </div>
                    <button onClick={() => setIsLoading(false)} className="mt-8 text-xs text-gray-600 hover:text-gray-400 underline decoration-dotted">
                        跳過等待，直接預覽
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-300">
            <div className="w-full h-full max-w-7xl flex flex-col md:flex-row gap-4">
                
                {/* 左側：控制面板 */}
                <div className="w-full md:w-72 bg-gray-900 rounded-xl p-4 flex flex-col gap-2 shrink-0 overflow-y-auto border border-gray-800 custom-scrollbar print:hidden">
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
                                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all border ${currentStyle === style.id ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-gray-800 text-gray-400 border-transparent hover:bg-gray-700'}`}
                            >
                                <span className="text-2xl">{style.icon}</span>
                                <div className="text-left">
                                    <div className="font-bold text-sm">{style.name}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-auto pt-6 border-t border-gray-700 space-y-3">
                        <button onClick={() => window.print()} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95">
                            <Download size={16}/> 列印 / 存為 PDF
                        </button>
                        <p className="text-[10px] text-center text-gray-500">
                            提示：請在列印設定勾選「背景圖形」以獲得最佳效果。
                        </p>
                    </div>
                </div>

                {/* 右側：預覽區域 (A4 模擬) */}
                <div className="flex-1 bg-gray-800/50 rounded-xl overflow-y-auto custom-scrollbar relative flex flex-col items-center p-4 md:p-8 border border-white/10">
                    
                    {/* 預覽標示 */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 px-4 py-1 rounded-full text-[10px] backdrop-blur font-mono border border-white/10 pointer-events-none print:hidden">
                        PREVIEW MODE (A4)
                    </div>

                    {/* 🟢 關鍵修正：確保這裡有 id="print-area"，這是 CSS 列印抓取的目標 */}
                    <div 
                        id="print-area" 
                        className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] origin-top transition-transform duration-300 ease-out mx-auto"
                    >
                        <SelectedStyleComponent trip={enrichedTrip} itinerary={enrichedItinerary} />
                    </div>

                    {/* 浮動工具：強制重新整理 */}
                    <button 
                        onClick={handleForceRefresh}
                        className="absolute bottom-6 right-6 bg-gray-800 hover:bg-black text-white p-3 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-all border border-gray-600 print:hidden"
                        title="圖片跑不出來？點我強制重新抓取"
                    >
                        <RefreshCcw size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}