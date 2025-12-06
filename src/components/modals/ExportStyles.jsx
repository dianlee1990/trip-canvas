import React from 'react';
import { Clock, Heart, Flower, MapPin, Smile, Star } from 'lucide-react';

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1600&auto=format&fit=crop";

// --- Helpers ---
const getImg = (item) => item.image || PLACEHOLDER_IMG;
const getName = (item) => item.name || "未命名景點";

const paginate = (items, itemsPerPage) => {
  const pages = [];
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage));
  }
  return pages;
};

const getTagCN = (tag) => {
  if (!tag) return '景點';
  const t = tag.toLowerCase().trim();
  if (t.includes('food') || t.includes('restaurant')) return '美食';
  if (t.includes('shopping') || t.includes('store')) return '購物';
  if (t.includes('hotel') || t.includes('lodging')) return '住宿';
  return '景點';
};

// --- 1. Fashion (Vogue) ---
export const StyleFashion = ({ trip, itinerary }) => {
  const pages = paginate(itinerary, 4);
  return (
    <>
      <div className="a4-page relative flex items-end break-inside-avoid">
        <img src={trip.coverImage || PLACEHOLDER_IMG} className="absolute inset-0 w-full h-full object-cover grayscale contrast-125" alt="cover"/>
        <div className="relative z-10 p-12 w-full text-center bg-gradient-to-t from-black/80 to-transparent text-white">
          <div className="font-fashion text-[8rem] leading-none mb-4 mix-blend-overlay opacity-90">VOGUE</div>
          <h1 className="text-5xl font-bold font-serif italic mb-4 tracking-widest">{trip.title}</h1>
          <p className="font-sans tracking-[0.3em] text-sm border-t border-white/50 pt-4 inline-block uppercase">
            THE TRIP EDIT • {trip.destination}
          </p>
        </div>
      </div>
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="a4-page p-12 bg-white text-black flex flex-col break-inside-avoid">
          <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-4 shrink-0">
            <h2 className="text-6xl font-fashion">Part {pageIdx + 1}</h2>
            <span className="font-sans tracking-widest uppercase text-xs">Page {pageIdx + 2}</span>
          </div>
          <div className="grid grid-cols-2 gap-6 grow content-start">
            {pageItems.map((item) => (
              <div key={item.id} className="flex flex-col h-full">
                <div className="relative aspect-square mb-2 overflow-hidden border border-black shadow-lg">
                  <img src={getImg(item)} className="w-full h-full object-cover grayscale" alt={item.name}/>
                  <div className="absolute top-0 left-0 bg-black text-white px-2 py-1 text-xs font-bold font-sans">
                    Day {item.day} • {item.time}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase block mb-1">{getTagCN(item.tags?.[0])}</span>
                  <h3 className="text-lg font-serif font-bold leading-tight mb-1">{getName(item)}</h3>
                  <p className="text-[10px] text-gray-500 font-sans leading-relaxed line-clamp-3">{item.aiSummary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

// --- 2. Travel (NatGeo) ---
export const StyleTravel = ({ trip, itinerary }) => {
  const contentPages = paginate(itinerary, 2);
  return (
    <>
      <div className="a4-page relative bg-black text-white font-travel break-inside-avoid">
        <img src={trip.coverImage || PLACEHOLDER_IMG} className="absolute inset-0 w-full h-full object-cover" alt="cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30"></div>
        <div className="absolute top-0 left-0 p-8 z-10 w-full flex justify-between items-center border-b border-white/20">
          <div className="bg-[#FFCC00] text-black px-4 py-1 text-lg font-bold tracking-widest uppercase shadow-md">TRAVELER</div>
          <div className="text-sm font-serif italic">Issue: {trip.destination}</div>
        </div>
        <div className="absolute bottom-0 left-0 p-12 z-10 max-w-3xl">
          <h1 className="text-7xl font-bold mb-4 leading-tight">{trip.title}</h1>
          <div className="h-2 w-32 bg-[#FFCC00] mb-8"></div>
          <p className="text-sm uppercase tracking-widest">Est. {trip.startDate}</p>
        </div>
      </div>
      {contentPages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="a4-page bg-white text-[#333] font-travel flex flex-col relative break-inside-avoid">
          <div className="flex items-center gap-4 p-8 shrink-0 absolute top-0 w-full z-20">
            <span className="bg-black text-[#FFCC00] font-bold px-3 py-1 font-sans text-sm">SECTION {pageIdx + 1}</span>
            <div className="h-px bg-gray-300/50 flex-1"></div>
          </div>
          {pageItems.length === 2 ? (
            pageIdx % 2 === 0 ? (
              <div className="h-full flex flex-col">
                <div className="h-[60%] relative overflow-hidden">
                  <img src={getImg(pageItems[0])} className="w-full h-full object-cover" alt={pageItems[0].name} />
                  <div className="absolute bottom-0 left-0 p-8 bg-gradient-to-t from-black/70 to-transparent w-full text-white">
                    <div className="bg-[#FFCC00] text-black px-3 py-1 inline-block text-xs font-bold uppercase mb-2">Day {pageItems[0].day} • {pageItems[0].time}</div>
                    <h2 className="text-5xl font-bold mb-2">{getName(pageItems[0])}</h2>
                    <p className="text-sm font-serif italic opacity-90 max-w-lg">{pageItems[0].aiSummary}</p>
                  </div>
                </div>
                <div className="h-[40%] flex border-t-8 border-[#FFCC00]">
                  <div className="w-1/3 bg-gray-100 p-8 flex flex-col justify-center">
                    <div className="text-gray-400 font-sans text-xs font-bold tracking-wide mb-2">NEXT STOP</div>
                    <h3 className="text-2xl font-bold mb-2">{getName(pageItems[1])}</h3>
                    <p className="text-xs text-gray-600 font-sans leading-relaxed">{pageItems[1].aiSummary}</p>
                  </div>
                  <div className="w-2/3 relative overflow-hidden">
                    <img src={getImg(pageItems[1])} className="w-full h-full object-cover" alt={pageItems[1].name} />
                    <div className="absolute top-4 right-4 bg-white/90 px-3 py-1 text-xs font-bold font-sans">
                      {pageItems[1].time}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex">
                <div className="w-1/2 h-full relative overflow-hidden border-r-4 border-white">
                  <img src={getImg(pageItems[0])} className="w-full h-full object-cover" alt={pageItems[0].name} />
                  <div className="absolute top-20 left-8 bg-black text-white p-6 max-w-[80%] shadow-lg border-l-4 border-[#FFCC00]">
                    <div className="font-sans text-xs font-bold text-[#FFCC00] mb-2">Day {pageItems[0].day} • {pageItems[0].time}</div>
                    <h2 className="text-3xl font-bold leading-tight mb-2">{getName(pageItems[0])}</h2>
                    <p className="text-xs text-gray-300 font-sans">{pageItems[0].aiSummary}</p>
                  </div>
                </div>
                <div className="w-1/2 h-full flex flex-col">
                  <div className="h-2/3 relative overflow-hidden">
                    <img src={getImg(pageItems[1])} className="w-full h-full object-cover" alt={pageItems[1].name} />
                  </div>
                  <div className="h-1/3 bg-[#f4f4f4] p-8 flex flex-col justify-center relative">
                    <div className="absolute -top-6 left-8 bg-[#FFCC00] px-4 py-2 font-bold text-sm shadow-sm">
                      {pageItems[1].time}
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{getName(pageItems[1])}</h3>
                    <p className="text-sm text-gray-600 font-sans leading-relaxed">{pageItems[1].aiSummary}</p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="h-full relative overflow-hidden">
              <img src={getImg(pageItems[0])} className="w-full h-full object-cover" alt={pageItems[0].name} />
              <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black via-black/50 to-transparent flex items-end p-12">
                <div className="text-white">
                  <h2 className="text-5xl font-bold mb-4">{getName(pageItems[0])}</h2>
                  <p className="text-lg font-serif italic">{pageItems[0].aiSummary}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
};

// --- 3. Japanese (Zen) ---
export const StyleJapanese = ({ trip, itinerary }) => {
  const pages = paginate(itinerary, 4);
  return (
    <>
      <div className="a4-page p-8 bg-[#F4F1EA] break-inside-avoid">
        <div className="border border-[#2F3542] h-full w-full p-12 bg-[#FDFBF7] relative overflow-hidden">
          <div className="absolute top-16 right-16 writing-vertical text-5xl font-bold tracking-widest h-96 text-[#2F3542] opacity-90">
            {trip.destination}
          </div>
          <div className="absolute bottom-32 left-16 w-2/3 h-1/2 overflow-hidden z-0 shadow-lg">
            {/* 🟢 移除 opacity-80 和 sepia-[.2]，讓色彩還原 */}
            <img src={trip.coverImage || PLACEHOLDER_IMG} className="w-full h-full object-cover" alt="cover" />
          </div>
          <div className="absolute bottom-12 left-16 text-xs tracking-[0.5em] text-[#2F3542]">
            旅の記録 • {trip.startDate}
          </div>
        </div>
      </div>
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="a4-page p-8 bg-[#F4F1EA] break-inside-avoid">
          <div className="border border-[#2F3542] h-full w-full p-12 bg-[#FDFBF7] flex flex-col">
            <div className="text-center mb-10 pb-4 border-b border-[#2F3542] w-full">
              <span className="font-serif italic text-xl">Chapter {pageIdx + 1}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-16 grow content-start">
              {pageItems.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="writing-vertical text-[10px] font-bold tracking-widest border-l border-[#2F3542] pl-2 h-32 text-gray-500 shrink-0">
                    Day {item.day} — {item.time}
                  </div>
                  <div>
                    {/* 🟢 移除 grayscale */}
                    <div className="aspect-[4/5] overflow-hidden mb-3 shadow-sm bg-gray-200">
                      <img src={getImg(item)} className="w-full h-full object-cover" alt={item.name} />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-[#2F3542]">{getName(item)}</h3>
                    <p className="text-[10px] leading-loose text-gray-600 font-light text-justify">
                      {item.aiSummary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

// --- 4. Art (Cinematic) ---
export const StyleArt = ({ trip, itinerary }) => {
  const pages = paginate(itinerary, 2);
  return (
    <>
      <div className="a4-page bg-[#0a0a0a] text-white font-art relative break-inside-avoid">
        <img src={trip.coverImage || PLACEHOLDER_IMG} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="cover" />
        {/* 🟢 修正：使用純黑漸層，去除原本的白色混濁感 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        <div className="absolute top-0 left-0 w-full h-2 bg-art-gold"></div>
        <div className="absolute bottom-20 left-12 right-12">
          <span className="block text-xs font-sans tracking-[0.5em] uppercase mb-6 text-art-gold">The Collection</span>
          <h1 className="text-8xl italic font-light leading-none mb-6">{trip.title}</h1>
          <p className="text-lg font-sans font-light text-gray-300 border-l-2 border-art-gold pl-6 max-w-md">{trip.destination}</p>
        </div>
      </div>
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="a4-page bg-[#0a0a0a] text-gray-200 font-art flex flex-col break-inside-avoid">
          <div className="py-4 px-8 border-b border-white/10 flex justify-between items-center shrink-0">
            <span className="text-xs font-sans tracking-widest uppercase text-gray-500">Gallery {pageIdx + 1}</span>
            <div className="h-px w-12 bg-art-gold"></div>
          </div>
          <div className="flex-1 flex flex-col">
            {pageItems.map((item) => (
              <div key={item.id} className="h-1/2 relative overflow-hidden border-b border-white/5">
                <img src={getImg(item)} className="absolute inset-0 w-full h-full object-cover opacity-80" alt={item.name} />
                {/* 🟢 修正：底部漸層改為全黑，確保文字清晰且畫面不髒 */}
                <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
                  <div className="text-art-gold font-sans text-[10px] font-bold tracking-widest mb-2">
                    DAY {item.day} • {item.time}
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-light italic text-white mb-1">{getName(item)}</h2>
                      <h3 className="text-xs font-sans text-gray-400 uppercase tracking-wider">{getTagCN(item.tags?.[0])}</h3>
                    </div>
                    <p className="text-xs text-gray-300 font-sans font-light max-w-[200px] text-right leading-relaxed">
                      {item.aiSummary}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

// --- 5. Diary (Kawaii) ---
export const StyleDiary = ({ trip, itinerary }) => {
  const pages = paginate(itinerary, 4);

  const Tape = ({ className }) => (
    <div className={`absolute h-6 z-10 shadow-sm opacity-90 ${className}`} style={{
      maskImage: `url('data:image/svg+xml;utf8,<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100%" height="100%" fill="white"/><path d="M0,0 L5,5 L0,10 L5,15 L0,20 L5,25 L0,30 L120,30 L115,25 L120,20 L115,15 L120,10 L115,5 L120,0 Z" fill="black"/></svg>')`
    }}></div>
  );

  return (
    <>
      {/* 🟢 封面重做：方格紙筆記本風格 */}
      <div className="a4-page bg-diary-bg font-diary flex items-center justify-center relative overflow-hidden break-inside-avoid">
        {/* 背景紋理：方格紙 */}
        <div className="absolute inset-0 notebook-grid opacity-50"></div>
        {/* 左側裝訂線 */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gray-200 border-r border-gray-300 z-20 flex flex-col justify-evenly py-4">
           {[...Array(20)].map((_,i) => <div key={i} className="w-3 h-3 bg-white rounded-full mx-auto shadow-inner border border-gray-300"></div>)}
        </div>

        <div className="relative z-10 w-[80%] h-[80%] bg-white shadow-2xl border-4 border-gray-800 rounded-lg flex flex-col items-center p-8 transform rotate-1">
           {/* 黑白手寫感標籤 */}
           <div className="w-full border-b-2 border-gray-800 pb-4 mb-8 text-center">
              <h1 className="text-5xl font-bold text-gray-800 tracking-wider uppercase">Travel Diary</h1>
              <p className="text-xl text-gray-500 mt-2 font-handwriting">{trip.startDate} - {trip.endDate}</p>
           </div>

           {/* 照片貼紙 */}
           <div className="relative w-64 h-64 bg-gray-100 border-2 border-dashed border-gray-400 p-2 transform -rotate-2">
              <Tape className="top-[-10px] left-[30%] bg-diary-pink w-24" />
              <img src={trip.coverImage || PLACEHOLDER_IMG} className="w-full h-full object-cover sepia-[.3]" alt="cover" />
              <div className="absolute -bottom-8 -right-8 text-gray-800 text-sm font-bold rotate-[-10deg]">
                 Current Mood: <Smile className="inline text-diary-pink"/>
              </div>
           </div>

           {/* 底部手寫字 */}
           <div className="mt-auto w-full text-center">
              <div className="inline-block border-2 border-gray-800 px-6 py-2 rounded-full font-bold text-xl transform -rotate-1 bg-yellow-100 shadow-[2px_2px_0px_#000]">
                 {trip.title}
              </div>
           </div>
        </div>
      </div>

      {/* 內頁 */}
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="a4-page bg-white font-diary p-8 relative overflow-hidden flex flex-col break-inside-avoid">
           <div className="absolute inset-0 notebook-grid opacity-30 pointer-events-none"></div>
           {/* 裝訂孔 */}
           <div className="absolute left-2 top-0 bottom-0 w-6 z-20 flex flex-col justify-evenly py-4">
              {[...Array(15)].map((_,i) => <div key={i} className="w-3 h-3 bg-gray-100 rounded-full mx-auto border border-gray-300"></div>)}
           </div>

          <div className="text-right mb-6 relative z-10 shrink-0 pr-4">
            <span className="text-gray-400 text-lg font-bold border-b-2 border-diary-pink">
              Date: Day {pageIdx + 1}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-8 grow content-start pl-8">
            {pageItems.map((item, idx) => {
              const rotations = ['rotate-1', '-rotate-1', 'rotate-2', '-rotate-2'];
              return (
              <div key={item.id} className={`relative flex flex-col`}>
                <div className={`bg-white border p-2 shadow-md ${rotations[idx]}`}>
                  <div className="aspect-square overflow-hidden bg-gray-100 mb-2">
                    <img src={getImg(item)} className="w-full h-full object-cover" alt={item.name} />
                  </div>
                  <div className="flex justify-between items-center px-1">
                     <span className="font-bold text-[#5D4037] text-md">{getName(item)}</span>
                     <span className="text-xs bg-diary-green px-2 rounded-full">{item.time}</span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-500 font-bold ml-2 leading-tight flex items-start gap-1">
                   <Star size={12} className="mt-1 text-yellow-400 fill-yellow-400"/>
                   {item.aiSummary}
                </div>
              </div>
            )})}
          </div>
        </div>
      ))}
    </>
  );
};

// --- 6. Manga (Comics) ---
export const StyleManga = ({ trip, itinerary }) => {
  // 🟢 邏輯修改：手動分配版型，不再死板
  // 建立一個版型序列，根據頁碼循環使用
  // 0: Hero (1大2小)
  // 1: Grid (4格)
  // 2: Diagonal (2斜切)
  
  // 先將行程切分為每頁的 bucket，但這次要動態切分
  // 為了簡化，我們還是先切成 4/3/2 不等的數量，或是我們固定每頁容量，但顯示方式不同
  // 最簡單的方式：每頁顯示 3~4 個，根據版型決定顯示數量
  
  let pageBuckets = [];
  let currentIndex = 0;
  let layoutPattern = ['hero', 'diagonal', 'grid', 'hero']; // 版型循環
  let patternIdx = 0;

  while(currentIndex < itinerary.length) {
      let type = layoutPattern[patternIdx % layoutPattern.length];
      let take = 4; // default grid
      if (type === 'hero') take = 3; // 1 big 2 small
      if (type === 'diagonal') take = 2; // 2 big split

      let items = itinerary.slice(currentIndex, currentIndex + take);
      if (items.length > 0) {
          pageBuckets.push({ type, items });
          currentIndex += take;
          patternIdx++;
      } else {
          break;
      }
  }

  return (
    <>
       {/* 封面 */}
       <div className="a4-page bg-white font-manga p-0 relative overflow-hidden border-[12px] border-black break-inside-avoid">
        <div className="absolute inset-0 screentone"></div>
        <div className="absolute inset-0 z-0">
          <img src={trip.coverImage || PLACEHOLDER_IMG} className="w-full h-full object-cover comic-filter grayscale-0 contrast-125" alt="cover" />
        </div>
        <div className="relative z-10 h-full flex flex-col justify-between p-8">
          <div className="bg-black text-white text-3xl px-8 py-2 transform -skew-x-12 self-start border-4 border-white outline outline-4 outline-black shadow-comic-boom">
            EPISODE 01: START!
          </div>
          <div className="text-right">
            <h1 className="text-9xl font-mangaTitle leading-none mb-2 uppercase tracking-tighter text-white drop-shadow-[5px_5px_0_#000]">{trip.title}</h1>
            <h2 className="text-4xl font-bold text-white drop-shadow-[3px_3px_0_#000] bg-black inline-block px-4 transform skew-x-12">{trip.destination}</h2>
          </div>
        </div>
       </div>

      {/* 內頁 */}
      {pageBuckets.map((page, pageIdx) => {
        const { type, items: pageItems } = page;
        const pageNum = pageIdx + 1;

        return (
          <div key={pageIdx} className="a4-page bg-white font-manga border-[8px] border-black p-0 relative overflow-hidden flex flex-col break-inside-avoid">
            
            {/* 🟢 Layout: Hero (1 上 2 下) */}
            {type === 'hero' && (
              <div className="h-full flex flex-col">
                <div className="h-[55%] relative border-b-8 border-black overflow-hidden bg-white">
                  <img src={getImg(pageItems[0])} className="w-full h-full object-cover comic-filter" alt="p1" />
                  <div className="screentone absolute inset-0 pointer-events-none"></div>
                  <div className="absolute top-4 left-4 bg-white border-4 border-black px-3 py-1 text-xl shadow-comic transform rotate-2 z-10">Day {pageItems[0].day}</div>
                  <div className="speech-bubble-boom absolute bottom-4 right-8 w-72 rotate-[-1deg] z-10">
                    <p className="text-xl">{getName(pageItems[0])}!! <br/><span className="text-sm font-normal">{pageItems[0].aiSummary}</span></p>
                  </div>
                </div>
                <div className="h-[45%] flex">
                  {pageItems[1] && (
                  <div className="w-1/2 relative border-r-8 border-black overflow-hidden panel-slant-right bg-white">
                    <img src={getImg(pageItems[1])} className="w-full h-full object-cover comic-filter" alt="p2" />
                    <div className="absolute top-4 right-4 text-5xl font-mangaTitle text-white drop-shadow-[4px_4px_0_#000] rotate-12 z-10">GO!</div>
                    <div className="absolute bottom-2 left-2 bg-white border-2 border-black px-2 font-bold z-10">{getName(pageItems[1])}</div>
                  </div>
                  )}
                  {pageItems[2] && (
                  <div className="w-1/2 relative overflow-hidden panel-slant-left bg-white">
                    <img src={getImg(pageItems[2])} className="w-full h-full object-cover comic-filter" alt="p3" />
                    <div className="absolute bottom-4 right-4 w-48 bg-white border-4 border-black p-3 shadow-comic relative bubble-tail z-10">
                      <p className="text-sm font-bold">{getName(pageItems[2])}</p>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}

            {/* 🟢 Layout: Diagonal (2 格大斜切) */}
            {type === 'diagonal' && (
              <div className="h-full flex flex-col">
                <div className="h-1/2 relative border-b-8 border-black overflow-hidden panel-jagged-bottom z-10 bg-white">
                  <img src={getImg(pageItems[0])} className="w-full h-full object-cover comic-filter" alt="p1"/>
                  <div className="speed-lines-radial absolute inset-0 pointer-events-none opacity-50"></div>
                  <div className="absolute top-4 left-4 text-6xl font-mangaTitle text-white drop-shadow-[4px_4px_0_#000] -rotate-6 z-10">DOKI DOKI...</div>
                  <div className="absolute bottom-12 left-8 bg-black text-white p-3 border-4 border-white font-bold text-2xl transform skew-x-[-10deg] shadow-comic z-10">
                    {getName(pageItems[0])}
                  </div>
                </div>
                {pageItems[1] && (
                  <div className="h-1/2 relative overflow-hidden bg-white" style={{marginTop: '-2%'}}>
                    <img src={getImg(pageItems[1])} className="w-full h-full object-cover comic-filter" alt="p2"/>
                    <div className="screentone absolute inset-0 pointer-events-none"></div>
                    <div className="speech-bubble-boom absolute top-8 right-8 w-64 rotate-2 z-10">
                      <p className="text-lg">{getName(pageItems[1])} is amazing!</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 🟢 Layout: Grid (標準 4 格) */}
            {type === 'grid' && (
              <div className="h-full p-4 bg-white">
                <div className="h-full grid grid-cols-2 grid-rows-2 gap-4 relative">
                {pageItems.map((item, idx) => (
                  <div key={item.id} className="relative border-4 border-black overflow-hidden shadow-comic bg-white">
                    <img src={getImg(item)} className="w-full h-full object-cover comic-filter" alt={item.name}/>
                    {idx === 0 && <div className="absolute top-0 left-0 speed-lines-radial opacity-30"></div>}
                    <div className="absolute top-2 left-2 bg-white border-2 border-black px-2 py-0.5 text-sm font-bold z-10">
                      Day {item.day} {item.time}
                    </div>
                    {idx % 2 === 0 ? (
                      <div className="speech-bubble-boom absolute bottom-2 right-2 w-36 scale-90 z-10">
                        <p className="text-sm leading-tight">{getName(item)}!!</p>
                      </div>
                    ) : (
                      <div className="absolute bottom-2 left-2 bg-black text-white p-2 text-xs font-bold border-2 border-white outline outline-2 outline-black transform skew-x-[-10deg] z-10 max-w-[80%]">
                        {item.aiSummary.substring(0, 25)}...
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </div>
            )}

            <div className="absolute bottom-2 right-2 text-xs font-bold bg-black text-white px-2 z-20 border-2 border-white">PAGE {pageNum}</div>
          </div>
        );
      })}
    </>
  );
};