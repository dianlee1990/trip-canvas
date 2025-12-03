import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, LogOut, Map as MapIcon, Calendar,
  ArrowRight, Loader2, User, MapPin, X,
  Plane, Globe, Users, Edit3 // 新增 Users, Edit3
} from 'lucide-react';
import {
  collection, doc, setDoc, updateDoc, onSnapshot // 新增 updateDoc
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from '../utils/firebase';
import { useNavigate } from 'react-router-dom';
import ShareModal from './modals/ShareModal'; // 記得確認路徑正確

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const POPULAR_DESTINATIONS = [
  { name: "Taipei, Taiwan", label: "台北, 台灣", keywords: ["taipei", "台北", "taiwan"], lat: 25.0330, lng: 121.5654 },
  { name: "Tokyo, Japan", label: "東京, 日本", keywords: ["tokyo", "東京", "japan"], lat: 35.6762, lng: 139.6503 },
  { name: "Osaka, Japan", label: "大阪, 日本", keywords: ["osaka", "大阪"], lat: 34.6937, lng: 135.5023 },
  { name: "Kyoto, Japan", label: "京都, 日本", keywords: ["kyoto", "京都"], lat: 35.0116, lng: 135.7681 },
  { name: "Seoul, South Korea", label: "首爾, 韓國", keywords: ["seoul", "首爾", "korea"], lat: 37.5665, lng: 126.9780 },
  { name: "Bangkok, Thailand", label: "曼谷, 泰國", keywords: ["bangkok", "曼谷", "thailand"], lat: 13.7563, lng: 100.5018 },
  { name: "London, UK", label: "倫敦, 英國", keywords: ["london", "倫敦", "uk"], lat: 51.5074, lng: -0.1278 },
  { name: "Paris, France", label: "巴黎, 法國", keywords: ["paris", "巴黎", "france"], lat: 48.8566, lng: 2.3522 },
  { name: "New York, USA", label: "紐約, 美國", keywords: ["new york", "紐約", "usa"], lat: 40.7128, lng: -74.0060 },
];

export default function Dashboard({ user, isMapScriptLoaded }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  // 狀態：編輯模式與分享視窗
  const [editingId, setEditingId] = useState(null); 
  const [shareModalData, setShareModalData] = useState(null);

  const [newTrip, setNewTrip] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    preSelectedCenter: null,
    flightOut: { airport: '', time: '' },
    flightIn: { airport: '', time: '' }
  });

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef(null);

  // 監聽行程列表
  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }
    const tripsRef = collection(db, 'artifacts', appId, 'trips');
    const unsubscribe = onSnapshot(tripsRef, (snapshot) => {
      const tripList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 前端過濾：只顯示我是協作者的行程
      const myTrips = tripList.filter(t =>
        t.collaborators && t.collaborators.includes(user.uid)
      );

      // 排序：新的在前
      myTrips.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

      setTrips(myTrips);
      setLoading(false);
    }, (error) => {
      console.error("Fetch trips error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 關閉建議選單
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

  // 開啟編輯模式
  const handleEditClick = (trip) => {
    setNewTrip({
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      preSelectedCenter: trip.center,
      flightOut: trip.flightOut || { airport: '', time: '' },
      flightIn: trip.flightIn || { airport: '', time: '' }
    });
    setEditingId(trip.id);
    setShowCreateModal(true);
  };

  // 建立或更新行程
  const handleSaveTrip = async () => {
    if (!newTrip.title || !newTrip.destination) {
      alert("請填寫行程名稱與目的地");
      return;
    }
    setIsCreating(true);
    
    // 預設座標
    let finalCenter = { lat: 35.6762, lng: 139.6503 };

    try {
      // 嘗試 Geocoding (如果使用者改了目的地)
      if (newTrip.preSelectedCenter) {
        finalCenter = {
          lat: Number(newTrip.preSelectedCenter.lat),
          lng: Number(newTrip.preSelectedCenter.lng)
        };
      } else if (isMapScriptLoaded && window.google && window.google.maps) {
        try {
          const geocodeTask = new Promise((resolve) => {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address: newTrip.destination }, (results, status) => {
              if (status === 'OK' && results[0] && results[0].geometry) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
              } else {
                resolve(null);
              }
            });
          });
          const result = await Promise.race([geocodeTask, new Promise(r => setTimeout(() => r(null), 1000))]);
          if (result) finalCenter = result;
        } catch (e) { console.error("Geo error", e); }
      }

      const nowISO = new Date().toISOString();

      const tripData = {
        title: newTrip.title || "未命名行程",
        destination: newTrip.destination || "未知目的地",
        startDate: newTrip.startDate || "",
        endDate: newTrip.endDate || "",
        center: finalCenter,
        flightOut: newTrip.flightOut,
        flightIn: newTrip.flightIn,
        updatedAt: nowISO
      };

      if (editingId) {
        // --- 更新模式 ---
        console.log("正在更新行程...", editingId);
        const tripRef = doc(db, 'artifacts', appId, 'trips', editingId);
        await updateDoc(tripRef, tripData);
        console.log("更新成功！");
        setShowCreateModal(false); // 更新完只關閉視窗，不跳轉
      } else {
        // --- 建立模式 ---
        console.log("正在建立新行程...");
        const fullData = {
          ...tripData,
          ownerId: user.uid,
          collaborators: [user.uid],
          createdAt: nowISO,
        };
        const tripsRef = collection(db, 'artifacts', appId, 'trips');
        const newDocRef = doc(tripsRef);
        
        // 檢查 undefined
        const cleanData = JSON.parse(JSON.stringify(fullData));
        await setDoc(newDocRef, cleanData);
        
        console.log("建立成功！");
        setShowCreateModal(false);
        navigate(`/trip/${newDocRef.id}`); // 建立完跳轉
      }

      // 重置表單
      setNewTrip({
        title: '', destination: '', startDate: '', endDate: '', preSelectedCenter: null,
        flightOut: { airport: '', time: '' }, flightIn: { airport: '', time: '' }
      });
      setEditingId(null);

    } catch (error) {
      console.error("Save Error:", error);
      alert(`儲存失敗: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-teal-600 p-1.5 rounded-lg">
            <MapIcon className="text-white" size={20} />
          </div>
          <span className="font-bold text-xl text-teal-800 tracking-tight">TripCanvas</span>
        </div>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.photoURL ? <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-gray-200" /> : <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700"><User size={16} /></div>}
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
              <button onClick={() => { setEditingId(null); setShowCreateModal(true); }} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow hover:shadow-md"><Plus size={18} /> 建立新行程</button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-600" size={32} /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => { setEditingId(null); setShowCreateModal(true); }} className="border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all group min-h-[220px]">
                  <div className="w-14 h-14 rounded-full bg-gray-100 group-hover:bg-teal-200 flex items-center justify-center mb-4 transition-colors"><Plus className="text-gray-400 group-hover:text-teal-700" size={28} /></div>
                  <span className="font-bold text-gray-500 group-hover:text-teal-700 text-lg">新增行程</span>
                </div>
                {trips.map(trip => (
                  <div key={trip.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group flex flex-col relative"
                       onClick={() => navigate(`/trip/${trip.id}`)}>
                    
                    {/* 操作按鈕 (懸浮顯示) */}
                    <div className="absolute top-3 right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShareModalData(trip); }}
                        className="bg-white/90 p-2 rounded-full shadow hover:text-teal-600 text-gray-500 hover:scale-110 transition-all"
                        title="成員與邀請"
                      >
                        <Users size={18} />
                      </button>
                      {trip.ownerId === user.uid && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditClick(trip); }}
                          className="bg-white/90 p-2 rounded-full shadow hover:text-blue-600 text-gray-500 hover:scale-110 transition-all"
                          title="編輯行程資訊"
                        >
                          <Edit3 size={18} />
                        </button>
                      )}
                    </div>

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

      {/* 建立/編輯 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                {editingId ? <Edit3 size={20} className="text-blue-600" /> : <Plus size={20} className="text-teal-600" />}
                {editingId ? '編輯行程資訊' : '建立新行程'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">行程名稱</label>
                <input type="text" placeholder="例如：東京五天四夜爆食之旅" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none" value={newTrip.title} onChange={e => setNewTrip({ ...newTrip, title: e.target.value })} />
              </div>
              <div className="relative" ref={searchWrapperRef}>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">目的地</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 text-gray-400" size={18} />
                  <input type="text" placeholder="例如：Tokyo" className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl outline-none" value={newTrip.destination} onChange={handleDestinationChange} onFocus={() => { if (newTrip.destination && suggestions.length > 0) setShowSuggestions(true); }} autoComplete="off" />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {suggestions.map((place, index) => (
                      <li key={index} onClick={() => handleSelectSuggestion(place)} className="px-4 py-3 hover:bg-teal-50 cursor-pointer transition-colors border-b border-gray-100 last:border-none flex items-center gap-3">
                        <div className="bg-teal-100 p-1.5 rounded-full shrink-0"><Globe size={16} className="text-teal-600" /></div>
                        <div><div className="font-bold text-gray-800 text-sm">{place.label}</div><div className="text-xs text-gray-500">{place.name}</div></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">旅遊日期</label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="date" className="w-full border border-gray-300 rounded-xl p-2.5 outline-none" value={newTrip.startDate} onChange={e => setNewTrip({ ...newTrip, startDate: e.target.value })} max={newTrip.endDate} />
                  <input type="date" className="w-full border border-gray-300 rounded-xl p-2.5 outline-none" value={newTrip.endDate} onChange={e => setNewTrip({ ...newTrip, endDate: e.target.value })} min={newTrip.startDate} />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-1"><Plane size={16} /> 航班資訊 (選填)</div>
                <div>
                  <label className="text-xs text-blue-600 block mb-1">去程 (抵達資訊)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="抵達機場 (如: NRT)" className="text-sm border border-blue-200 rounded-lg p-2 outline-none" value={newTrip.flightOut.airport} onChange={e => setNewTrip({ ...newTrip, flightOut: { ...newTrip.flightOut, airport: e.target.value } })} />
                    <input type="time" className="text-sm border border-blue-200 rounded-lg p-2 outline-none" value={newTrip.flightOut.time} onChange={e => setNewTrip({ ...newTrip, flightOut: { ...newTrip.flightOut, time: e.target.value } })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-blue-600 block mb-1">回程 (起飛資訊)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="出發機場 (如: KIX)" className="text-sm border border-blue-200 rounded-lg p-2 outline-none" value={newTrip.flightIn.airport} onChange={e => setNewTrip({ ...newTrip, flightIn: { ...newTrip.flightIn, airport: e.target.value } })} />
                    <input type="time" className="text-sm border border-blue-200 rounded-lg p-2 outline-none" value={newTrip.flightIn.time} onChange={e => setNewTrip({ ...newTrip, flightIn: { ...newTrip.flightIn, time: e.target.value } })} />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors">取消</button>
              <button onClick={handleSaveTrip} disabled={isCreating || !newTrip.title || !newTrip.destination} className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50 ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : (editingId ? '儲存變更' : '開始規劃')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 邀請視窗 */}
      <ShareModal 
        isOpen={!!shareModalData} 
        onClose={() => setShareModalData(null)} 
        trip={shareModalData}
        currentUser={user}
      />
    </div>
  );
}