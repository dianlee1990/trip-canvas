// Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, LogOut, Map as MapIcon, Calendar,
  ArrowRight, Loader2, User, MapPin, X,
  Plane, Globe
} from 'lucide-react';
import {
  collection, doc, setDoc, query, orderBy, onSnapshot,
  serverTimestamp, where
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
// 請確認路徑正確
import { db, auth, googleProvider } from '../utils/firebase';
// 新增：引入路由導航
import { useNavigate } from 'react-router-dom';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ... (POPULAR_DESTINATIONS 保持不變，為了節省篇幅省略，請保留原本的常數) ...
const POPULAR_DESTINATIONS = [
  { name: "Taipei, Taiwan", label:  "台北, 台灣" , keywords: ["taipei",  "台北" , "taiwan"], lat: 25.0330, lng: 121.5654 },
  { name: "Tokyo, Japan", label:  "東京, 日本" , keywords: ["tokyo",  "東京" , "japan"], lat: 35.6762, lng: 139.6503 },
  // ... 請保留原本所有的地點清單 ...
];

export default function Dashboard({ user, isMapScriptLoaded }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate(); // 使用路由跳轉

  // 新行程表單
  const [newTrip, setNewTrip] = useState({
    title: '', destination: '', startDate: '', endDate: '', preSelectedCenter: null,
    flightOut: { airport: '', time: '' }, flightIn: { airport: '', time: '' }
  });

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef(null);

  // 監聽行程列表 (修改為：查詢我是 'collaborators' 之一的行程)
  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    // --- 【修改點 1】查詢邏輯改變 ---
    // 改為查詢 artifacts/{appId}/trips，條件是 collaborators array-contains user.uid
    const tripsRef = collection(db, 'artifacts', appId, 'trips');
    // 注意：複合查詢可能需要建立 Firestore Index，如果 Console 報錯會有連結引導你去建立
    const q = query(
        tripsRef, 
        where('collaborators', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(tripList);
      setLoading(false);
    }, (error) => {
      console.error("Fetch trips error:", error);
      // 如果因為缺少 index 報錯，先降級為不排序
      if(error.message.includes("requires an index")) {
          console.warn("Falling back to unordered query due to missing index");
          const fallbackQ = query(tripsRef, where('collaborators', 'array-contains', user.uid));
          onSnapshot(fallbackQ, (snap) => {
            const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
            // 手動排序
            list.sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            setTrips(list);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 點擊外部關閉建議選單
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error("Login failed:", error); }
  };

  const handleDestinationChange = (e) => {
    const value = e.target.value;
    setNewTrip(prev => ({ ...prev, destination: value, preSelectedCenter: null }));
    if (value.trim().length > 0) {
      const lowerValue = value.toLowerCase();
      const filtered = POPULAR_DESTINATIONS.filter(place =>
        place.keywords.some(k => k.includes(lowerValue)) || place.label.includes(value) || place.name.toLowerCase().includes(lowerValue)
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (place) => {
    setNewTrip(prev => ({ ...prev, destination: place.label, preSelectedCenter: { lat: place.lat, lng: place.lng } }));
    setShowSuggestions(false);
  };

  const handleCreateTrip = async () => {
    if (!newTrip.title || !newTrip.destination) {
      alert("請填寫行程名稱與目的地");
      return;
    }

    setIsCreating(true);
    
    // 1. 準備座標
    let finalCenter = { lat: 35.6762, lng: 139.6503 };
    try {
        if (newTrip.preSelectedCenter) {
            finalCenter = { lat: Number(newTrip.preSelectedCenter.lat), lng: Number(newTrip.preSelectedCenter.lng) };
        } else if (isMapScriptLoaded && window.google && window.google.maps) {
             // ... (省略 Geocoding 邏輯，保持原樣) ...
             // 為了縮短程式碼，這裡沿用原本的邏輯，若沒選建議則用預設值
        }

        // 2. 準備寫入資料
        const tripData = {
            title: newTrip.title || "未命名行程",
            destination: newTrip.destination || "未知目的地",
            startDate: newTrip.startDate || "",
            endDate: newTrip.endDate || "",
            center: finalCenter,
            flightOut: newTrip.flightOut,
            flightIn: newTrip.flightIn,
            // --- 【修改點 2】結構改變 ---
            ownerId: user.uid,              // 誰建立的
            collaborators: [user.uid],      // 誰可以看 (包含建立者)
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // --- 【修改點 3】路徑改變 ---
        // 寫入到 artifacts/{appId}/trips/{tripId} (全域集合)
        const tripsRef = collection(db, 'artifacts', appId, 'trips');
        const newDocRef = doc(tripsRef);
        
        await setDoc(newDocRef, tripData);

        setShowCreateModal(false);
        setNewTrip({ title: '', destination: '', startDate: '', endDate: '', preSelectedCenter: null, flightOut: {airport:'', time:''}, flightIn: {airport:'', time:''} });
        
        // --- 【修改點 4】使用網址導航 ---
        // 建立成功後，直接跳轉到該行程的網址
        navigate(`/trip/${newDocRef.id}`);

    } catch (error) {
        console.error("Create Trip Error:", error);
        alert(`建立失敗: ${error.message}`);
    } finally {
        setIsCreating(false);
    }
  };

  // --- UI 部分保持不變，除了 onSelectTrip 改為 navigate ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-teal-600 p-1.5 rounded-lg">
            <MapIcon className="text-white" size={20} />
          </div>
          <span className="font-bold text-xl text-teal-800 tracking-tight">TripCanvas</span>
        </div>
        {user ? (
          <div className="flex items-center gap-4">
             {/* 這裡未來可以加「分享按鈕」 */}
            <div className="flex items-center gap-2">
              {user.photoURL ? <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-gray-200" /> : <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700"><User size={16}/></div>}
              <span className="text-sm font-medium hidden md:block">{user.displayName}</span>
            </div>
            <button onClick={() => signOut(auth)} className="text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"><LogOut size={16} /> <span className="hidden md:inline">登出</span></button>
          </div>
        ) : (
          <button onClick={handleLogin} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm">登入</button>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {!user ? (
           // ... (未登入畫面保持不變) ...
           <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
             <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <MapIcon className="text-teal-600 w-12 h-12" />
             </div>
             <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">規劃您的 <span className="text-teal-600">完美旅程</span></h1>
             <p className="text-lg text-gray-600 max-w-2xl mb-10 leading-relaxed">使用 TripCanvas 的互動式地圖與 AI 推薦功能，輕鬆拖曳、安排景點，打造獨一無二的旅行計畫。</p>
             <button onClick={handleLogin} className="flex items-center gap-3 bg-white border border-gray-300 px-8 py-4 rounded-xl shadow-lg hover:shadow-xl hover:border-teal-500 hover:-translate-y-1 transition-all group">
               <img src="https://www.google.com/favicon.ico" alt="G" className="w-6 h-6" />
               <span className="text-lg font-bold text-gray-700 group-hover:text-teal-700">使用 Google 帳號開始</span>
             </button>
           </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-800 border-l-4 border-teal-500 pl-3">我的行程</h2>
              <button onClick={() => setShowCreateModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow hover:shadow-md"><Plus size={18} /> 建立新行程</button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-600" size={32} /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => setShowCreateModal(true)} className="border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all group min-h-[220px]">
                  <div className="w-14 h-14 rounded-full bg-gray-100 group-hover:bg-teal-200 flex items-center justify-center mb-4 transition-colors"><Plus className="text-gray-400 group-hover:text-teal-700" size={28} /></div>
                  <span className="font-bold text-gray-500 group-hover:text-teal-700 text-lg">新增行程</span>
                </div>
                {trips.map(trip => (
                  // --- 【修改點 5】點擊跳轉網址 ---
                  <div key={trip.id} onClick={() => navigate(`/trip/${trip.id}`)} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden group flex flex-col relative">
                    <div className="h-32 bg-gradient-to-r from-teal-500 to-cyan-600 relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
                      <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-black/10 rounded-full blur-lg"></div>
                      <div className="absolute bottom-4 left-4 text-white z-10"><h3 className="text-2xl font-bold drop-shadow-md">{trip.destination}</h3></div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-teal-600 transition-colors line-clamp-1">{trip.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><Calendar size={14} /><span className="truncate">{trip.startDate ? trip.startDate : '未定'} {trip.endDate ? ` - ${trip.endDate}` : ''}</span></div>
                      <div className="mt-auto flex items-center justify-end text-teal-600 font-medium text-sm translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">進入規劃 <ArrowRight size={16} className="ml-1" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Create Modal 保持不變，省略顯示 */}
      {showCreateModal && (
         // ... 請將這裡替換回原本的 Create Modal 程式碼，確保 handleCreateTrip 有被呼叫 ...
         // 為了方便你，我這裡只顯示最外層，請把原本 Dashboard 900行之後的程式碼貼回來
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
                 {/* Modal Header */}
                 <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                     <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Plus size={20} className="text-teal-600"/> 建立新行程</h3>
                     <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
                 </div>
                 {/* Modal Body */}
                 <div className="p-6 space-y-5">
                    {/* ... 這裡請填回原本的 input 欄位 (title, destination, dates, flights) ... */}
                    {/* 你可以參考原本 Dashboard.jsx 到 */}
                    <div><label className="block text-sm font-bold text-gray-700 mb-1.5">行程名稱</label><input type="text" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none" value={newTrip.title} onChange={e=>setNewTrip({...newTrip, title: e.target.value})}/></div>
                    <div className="relative" ref={searchWrapperRef}>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">目的地</label>
                        <div className="relative"><MapPin className="absolute left-3.5 top-3 text-gray-400" size={18}/><input type="text" className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl outline-none" value={newTrip.destination} onChange={handleDestinationChange} onFocus={()=>{if(newTrip.destination)setShowSuggestions(true)}}/></div>
                        {showSuggestions && suggestions.length > 0 && (<ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">{suggestions.map((place,i)=>(<li key={i} onClick={()=>handleSelectSuggestion(place)} className="px-4 py-3 hover:bg-teal-50 cursor-pointer border-b border-gray-100 flex items-center gap-3"><div>{place.label}</div></li>))}</ul>)}
                    </div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1.5">旅遊日期</label><div className="grid grid-cols-2 gap-4"><input type="date" className="w-full border p-2.5 rounded-xl" value={newTrip.startDate} onChange={e=>setNewTrip({...newTrip, startDate: e.target.value})}/><input type="date" className="w-full border p-2.5 rounded-xl" value={newTrip.endDate} onChange={e=>setNewTrip({...newTrip, endDate: e.target.value})}/></div></div>
                 </div>
                 {/* Modal Footer */}
                 <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl">取消</button>
                    <button onClick={handleCreateTrip} disabled={isCreating} className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl flex items-center gap-2">{isCreating ? <Loader2 className="animate-spin"/> : '開始規劃'}</button>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
}