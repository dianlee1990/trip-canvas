import React from 'react';
import { Clock, Heart, Flower, MapPin } from 'lucide-react';

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1600&auto=format&fit=crop";

// Helper to get safe image
const getImg = (item) => item.image || PLACEHOLDER_IMG;
// Helper to get safe chName or name
const getName = (item) => item.name || "未命名景點";

// Helper to translate common tags to Chinese for Japanese style
const getTagCN = (tag) => {
    if (!tag) return '景點';
    const t = tag.toLowerCase().trim();
    const map = {
        'food': '美食',
        'restaurant': '餐廳',
        'cafe': '咖啡廳',
        'shopping': '購物',
        'mall': '商場',
        'temple': '寺廟',
        'shrine': '神社',
        'landmark': '地標',
        'sightseeing': '觀光',
        'nature': '自然',
        'park': '公園',
        'mountain': '山岳',
        'hotel': '住宿',
        'transport': '交通',
        'station': '車站',
        'culture': '文化',
        'museum': '博物館',
        'art': '藝術',
        'history': '歷史',
        'activity': '活動',
        'experience': '體驗',
        'spot': '景點',
        'other': '其他'
    };
    return map[t] || tag; // 如果找不到對應的中文，則顯示原始標籤
};

// 1. Fashion (Vogue)
export const StyleFashion = ({ trip, itinerary }) => (
    <div className="bg-white text-black font-serif w-full min-h-screen">
        <div className="relative h-[700px] w-full overflow-hidden">
            <img src={trip.coverImage || PLACEHOLDER_IMG} className="w-full h-full object-cover grayscale contrast-125" alt="cover"/>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80"></div>
            <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 text-center">
                <div className="font-fashion text-[6rem] md:text-[10rem] text-white tracking-tighter leading-none mb-4 mix-blend-overlay opacity-90">VOGUE</div>
                <h1 className="text-4xl md:text-7xl font-bold text-white mb-4 italic font-sans uppercase tracking-widest">{trip.title}</h1>
                <p className="text-white/80 font-sans tracking-[0.2em] text-sm border-t border-white/30 inline-block pt-6 mt-2">THE TRIP EDIT • CURATED BY {trip.collaborators?.[0] || 'TRAVELER'}</p>
            </div>
        </div>
        <div className="p-4 md:p-20 max-w-6xl mx-auto">
            {Array.from(new Set(itinerary.map(i => i.day))).sort((a,b)=>a-b).map(day => (
                <div key={day} className="mb-32 break-inside-avoid">
                    <div className="flex items-end gap-6 mb-16 border-b-2 border-black pb-4">
                        <h2 className="text-8xl md:text-9xl font-fashion text-black leading-[0.7]">0{day}</h2>
                        <span className="text-xl font-sans tracking-widest uppercase mb-2">Day {day} Exploration</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-16">
                        {itinerary.filter(i => i.day === day).map((item, idx) => (
                            <div key={item.id} className={` ${idx % 2 !== 0 ? 'md:mt-24' : ''} break-inside-avoid`}>
                                <div className="relative aspect-[3/4] overflow-hidden mb-6 shadow-2xl">
                                    <img src={getImg(item)} className="w-full h-full object-cover grayscale" alt={item.name}/>
                                    <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 text-xs font-sans font-bold tracking-widest">{item.time}</div>
                                </div>
                                <div className="text-center px-4">
                                    <span className="text-xs font-bold font-sans tracking-[0.2em] text-gray-400 uppercase">{item.tags?.[0] || 'SPOT'}</span>
                                    <h3 className="text-2xl md:text-3xl font-serif font-bold mt-3 mb-4 leading-tight">{getName(item)}</h3>
                                    <p className="text-sm text-gray-500 font-sans leading-relaxed">{item.aiSummary}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// 2. Travel (NatGeo)
export const StyleTravel = ({ trip, itinerary }) => (
    <div className="bg-white text-[#333] font-travel w-full min-h-screen">
        <div className="border-4 border-[#FFCC00] m-4 p-2">
            <div className="bg-white relative">
                <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden">
                    <img src={trip.coverImage || PLACEHOLDER_IMG} className="w-full h-full object-cover" alt="cover"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                </div>
                <div className="relative z-10 pt-[450px] px-8 md:px-16 pb-12">
                    <div className="bg-[#FFCC00] text-black px-4 py-1 text-sm font-bold inline-block mb-4 tracking-widest uppercase">Traveler's Guide</div>
                    <h1 className="text-5xl md:text-8xl font-bold text-white mb-2 font-sans tracking-tight">{trip.title}</h1>
                    <p className="text-white text-xl font-serif italic">{trip.destination}</p>
                </div>
            </div>
            <div className="px-6 md:px-16 py-12 max-w-6xl mx-auto">
                {Array.from(new Set(itinerary.map(i => i.day))).sort((a,b)=>a-b).map(day => (
                    <div key={day} className="mb-24 last:mb-0 break-inside-avoid">
                        <div className="flex items-center gap-6 mb-12">
                            <div className="text-5xl font-bold text-gray-200 font-sans">0{day}</div>
                            <div className="h-px bg-gray-200 flex-1"></div>
                            <div className="text-sm font-bold uppercase tracking-widest text-[#FFCC00]">Day Highlights</div>
                        </div>
                        <div className="grid grid-cols-1 gap-12 border-l-4 border-[#FFCC00] ml-4 pl-8 md:pl-12">
                            {itinerary.filter(i => i.day === day).map((item) => (
                                <div key={item.id} className="grid md:grid-cols-12 gap-8 items-center break-inside-avoid">
                                    <div className="md:col-span-5 order-2 md:order-1">
                                        <div className="text-[#FFCC00] font-bold font-sans text-sm mb-2 flex items-center gap-2">
                                            <Clock size={14}/> {item.time}
                                        </div>
                                        <h3 className="text-3xl font-bold mb-3 text-gray-900 font-sans">{getName(item)}</h3>
                                        <p className="text-gray-700 font-sans leading-loose text-sm border-t border-gray-200 pt-4">{item.aiSummary}</p>
                                    </div>
                                    <div className="md:col-span-7 order-1 md:order-2">
                                        <div className="aspect-[16/9] overflow-hidden shadow-lg border-4 border-white">
                                            <img src={getImg(item)} className="w-full h-full object-cover" alt={item.name}/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// 3. Japanese (Zen)
export const StyleJapanese = ({ trip, itinerary }) => (
    <div className="bg-[#F4F1EA] text-[#2F3542] min-h-screen p-4 md:p-12 w-full" style={{ fontFamily: '"Noto Serif TC", "Songti TC", serif' }}>
        <div className="max-w-6xl mx-auto border border-[#2F3542] p-2 h-full">
            <div className="border border-[#2F3542] p-8 md:p-16 h-full relative overflow-hidden bg-[#FDFBF7]">
                <div className="absolute top-20 right-20 writing-vertical text-5xl md:text-7xl font-bold tracking-widest h-[500px] leading-loose opacity-80 z-10 select-none pointer-events-none hidden md:block">
                    {trip.destination}
                    <span className="text-lg mt-8 tracking-normal opacity-50 font-sans" style={{ writingMode: 'vertical-rl' }}>旅程畫布</span>
                </div>
                <div className="w-full md:w-3/4 h-[400px] md:h-[500px] overflow-hidden mb-32 relative z-0">
                    <img src={trip.coverImage || PLACEHOLDER_IMG} className="w-full h-full object-cover opacity-90 sepia-[.15]" alt="cover"/>
                    <h1 className="absolute bottom-4 left-4 text-4xl font-bold bg-white/80 p-4 md:hidden">{trip.title}</h1>
                </div>
                {Array.from(new Set(itinerary.map(i => i.day))).sort((a,b)=>a-b).map(day => (
                    <div key={day} className="mb-32 relative break-inside-avoid">
                        <div className="absolute -left-4 -top-10 text-9xl font-sans font-bold text-gray-100 -z-10">0{day}</div>
                        <h2 className="text-3xl font-bold mb-16 border-b border-[#2F3542] pb-4 inline-block pr-12">第 {day} 天之旅</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-32">
                            {itinerary.filter(i => i.day === day).map((item, idx) => (
                                <div key={item.id} className={`relative ${idx % 2 === 1 ? 'md:mt-32' : ''} break-inside-avoid`}>
                                    <div className="aspect-[4/5] overflow-hidden mb-8 shadow-sm">
                                        <img src={getImg(item)} className="w-full h-full object-cover" alt={item.name}/>
                                    </div>
                                    <div className="flex gap-6">
                                        <div className="writing-vertical text-sm font-bold tracking-widest border-l border-[#2F3542] pl-3 h-32 text-gray-500">
                                            {item.time} — {getTagCN(item.tags?.[0])}
                                        </div>
                                        <div className="pt-2">
                                            <h3 className="text-2xl font-bold mb-4">{getName(item)}</h3>
                                            <p className="text-sm leading-loose text-gray-600 font-light text-justify tracking-wide">{item.aiSummary}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// 4. Photo Art (Cinematic)
export const StyleArt = ({ trip, itinerary }) => (
    <div className="bg-[#1a1a1a] text-gray-200 min-h-screen relative w-full" style={{ fontFamily: '"Songti TC", "Noto Serif TC", serif' }}>
        <div className="relative h-screen w-full flex flex-col justify-end p-12 md:p-24 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-600 z-50"></div>
            <img src={trip.coverImage || PLACEHOLDER_IMG} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="cover"/>
            <div className="relative z-10 max-w-5xl">
                <span className="block text-sm tracking-[0.5em] uppercase mb-8 text-yellow-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] font-bold">精選旅程</span>
                <h1 className="text-6xl md:text-[8rem] font-black italic leading-[0.8] mb-10 text-white drop-shadow-[0_4px_4px_rgba(0,0,0,1)] tracking-wide">{trip.title}</h1>
                <p className="text-xl font-bold text-gray-100 max-w-xl leading-relaxed border-l-4 border-yellow-600 pl-6 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">{trip.destination}</p>
            </div>
        </div>
        {Array.from(new Set(itinerary.map(i => i.day))).sort((a,b)=>a-b).map(day => (
            <div key={day} className="relative break-inside-avoid">
                <div className="sticky top-0 z-20 bg-[#111]/90 backdrop-blur-sm border-b border-white/10 py-4 px-8 flex justify-between items-center">
                    <span className="text-4xl font-bold italic text-white drop-shadow-md">Day {day}</span>
                    <span className="text-xs tracking-widest text-gray-400 uppercase font-bold">精選景點</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {itinerary.filter(i => i.day === day).map((item, idx) => (
                        <div key={item.id} className="relative min-h-[500px] overflow-hidden border-b border-r border-white/5 group">
                            <img src={getImg(item)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-70 group-hover:opacity-100" alt={item.name}/>
                            <div className="absolute bottom-0 left-0 p-12 w-full bg-gradient-to-t from-black via-black/60 to-transparent">
                                <div className="text-yellow-500 text-sm font-black tracking-widest mb-3 drop-shadow-md">{item.time}</div>
                                <h2 className="text-4xl font-black italic text-white mb-4 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{getName(item)}</h2>
                                <p className="text-gray-100 font-bold leading-relaxed max-w-md text-justify drop-shadow-[0_2px_2px_rgba(0,0,0,1)] line-clamp-3">{item.aiSummary}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

// 5. Manga (Colorful)
export const StyleManga = ({ trip, itinerary }) => (
    <div className="bg-white font-sans text-black min-h-screen p-4 md:p-8 relative overflow-hidden w-full">
        <div className="absolute inset-0 pointer-events-none z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
        <div className="relative z-10 max-w-5xl mx-auto mb-16 mt-8 border-4 border-black bg-white p-8 shadow-[8px_8px_0_0_rgba(0,0,0,1)] transform -rotate-1">
            {/* 標題極度加粗 */}
            <h1 className="text-5xl md:text-8xl text-center uppercase tracking-tighter mb-4 relative font-black" style={{ WebkitTextStroke: '3px black' }}>
                {trip.title}
                <span className="absolute -top-6 -right-6 text-2xl md:text-4xl text-black bg-white border-2 border-black px-4 py-2 rotate-12" style={{ WebkitTextStroke: '0px' }}>EP.01</span>
            </h1>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
            {Array.from(new Set(itinerary.map(i => i.day))).sort((a,b)=>a-b).map(day => (
                <div key={day} className="mb-24 break-inside-avoid">
                    <div className="flex items-center mb-12">
                        <div className="bg-black text-white text-4xl px-6 py-3 font-black skew-x-[-10deg] shadow-[4px_4px_0px_rgba(0,0,0,0.2)] border-2 border-white outline outline-4 outline-black">
                            CHAPTER {day}
                        </div>
                        <div className="h-2 bg-black flex-1 ml-4"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {itinerary.filter(i => i.day === day).map((item, idx) => {
                            const isLarge = idx % 3 === 0;
                            return (
                                <div key={item.id} className={`border-4 border-black bg-white p-2 relative shadow-[8px_8px_0_0_rgba(0,0,0,1)] ${isLarge ? 'md:col-span-2' : ''}`}>
                                    <div className="relative overflow-hidden border-2 border-black mb-4 h-64 md:h-80"> 
                                        {/* 確保圖片不使用 grayscale */}
                                        <img src={getImg(item)} className="w-full h-full object-cover" alt={item.name}/>
                                        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 2px 2px' }}></div>
                                        <div className="absolute top-2 right-2 text-5xl font-black text-white drop-shadow-[3px_3px_0_#000] rotate-12" style={{ WebkitTextStroke: '2px black' }}>
                                            {idx % 2 === 0 ? 'DOKI!' : 'WAKU!'}
                                        </div>
                                    </div>
                                    <div className="p-2 relative">
                                        <div className="absolute -top-8 -left-4 bg-white border-4 border-black px-3 py-1 font-black rounded-full z-10 text-xl">
                                            🕒 {item.time}
                                        </div>
                                        <h3 className="text-3xl md:text-4xl font-black mb-2 uppercase tracking-tight">{getName(item)}</h3>
                                        <div className="bg-white border-2 border-black p-4 rounded-2xl relative">
                                            <p className="text-lg leading-snug font-bold">{item.aiSummary}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// 6. Korean (Kawaii Diary)
export const StyleDiary = ({ trip, itinerary }) => (
    <div className="bg-[#FFF0F5] text-[#5D4037] min-h-screen p-4 md:p-8 relative overflow-hidden doodle-bg w-full"
         style={{ fontFamily: '"Hachi Maru Pop", "Hannotate SC", "Wawati SC", "Nanum Pen Script", "Comic Sans MS", cursive, sans-serif' }}>
        <style>
            {`@import url('https://fonts.googleapis.com/css2?family=Hachi+Maru+Pop&display=swap');`}
        </style>
        <div className="max-w-4xl mx-auto space-y-16 relative z-10">
            <div className="bg-white p-12 rotate-1 shadow-lg border-4 border-white rounded-[3rem] relative mt-10 text-center">
                <div className="absolute top-[-15px] left-[45%] w-32 h-8 bg-[#FFB6C1] opacity-60 transform -rotate-2"></div>
                <h1 className="text-5xl font-bold text-[#5D4037] mb-4 tracking-wide">{trip.title}</h1>
                <p className="text-[#FF69B4] font-bold text-xl flex justify-center items-center gap-2">
                    <Heart size={20} fill="currentColor"/> {trip.startDate || 'Date'} - {trip.endDate || 'Date'} <Heart size={20} fill="currentColor"/>
                </p>
            </div>

            {Array.from(new Set(itinerary.map(i => i.day))).sort((a,b)=>a-b).map(day => (
                <div key={day} className="relative break-inside-avoid">
                    <div className="flex justify-center mb-10">
                        <div className="bg-white border-4 border-[#FF69B4] text-[#FF69B4] px-10 py-3 rounded-full text-3xl font-bold shadow-md flex items-center gap-3 transform -rotate-2">
                            <Flower size={28}/> <span>Day {day}</span> <Flower size={28}/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {itinerary.filter(i => i.day === day).map((item, idx) => (
                            <div key={item.id} className="bg-white p-5 rounded-[2rem] border-2 border-dashed border-[#FFB6C1] relative break-inside-avoid shadow-sm">
                                <div className="absolute -top-3 -right-3 w-12 h-12 bg-[#FFB6C1] rounded-full opacity-50"></div>
                                <div className="aspect-video overflow-hidden rounded-2xl mb-4 bg-gray-100 border-4 border-white shadow-inner">
                                    <img src={getImg(item)} className="w-full h-full object-cover" alt={item.name}/>
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                    {/* 修正時間字體顏色：由白字改為粉紅字+白底，增加可讀性 */}
                                    <span className="bg-white text-[#FF69B4] border-2 border-[#FF69B4] px-3 py-1 rounded-full text-lg font-black shadow-sm">{item.time}</span>
                                    <span className="text-sm text-gray-400 font-bold bg-gray-100 px-2 py-1 rounded-lg">#{item.tags?.[0] || 'Cute'}</span>
                                </div>
                                <h3 className="text-2xl font-bold text-[#5D4037] mb-2">{getName(item)}</h3>
                                <p className="text-lg text-gray-500 leading-relaxed font-bold bg-[#FFF0F5] p-4 rounded-2xl">{item.aiSummary}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);