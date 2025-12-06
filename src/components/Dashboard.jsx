import React, { useState, useEffect, useRef } from 'react';
// 🟢 關鍵修正：補回所有 LandingPage 需要的 Icons，防止白畫面
import {
  Plus, LogOut, Map as MapIcon, Calendar,
  ArrowRight, Loader2, User, MapPin, X,
  Plane, Globe, Users, Edit3, Trash2, Sparkles,
  Zap, Compass, CheckCircle2, Star,
  MessageCircle, MousePointer2, Check,
  Smile, Camera, Utensils, Beer, Activity, Landmark, Mountain, Bed
} from 'lucide-react';
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, arrayRemove
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from '../utils/firebase';
import { useNavigate } from 'react-router-dom';
import ShareModal from './modals/ShareModal';

// Google Autocomplete & DatePicker
import { Autocomplete } from '@react-google-maps/api';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ⚠️ 暫時不引入 date-fns locale，使用預設英文以確保穩定性

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Landing Page ---
const LandingPage = ({ onLogin }) => {
  const galleryItems = [
    { img: "https://images.unsplash.com/photo-1551632811-561732d1e306", tag: "#隱藏酒吧", title: "深夜微醺" },
    { img: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963", tag: "#秘境溫泉", title: "極致放鬆" },
    { img: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26", tag: "#東京街頭", title: "城市漫遊" },
    { img: "https://images.unsplash.com/photo-1493857671505-72967e2e2760", tag: "#風格露營", title: "擁抱自然" },
    { img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836", tag: "#在地美食", title: "味蕾探險" },
    { img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf", tag: "#主題樂園", title: "童心未泯" },
  ];

  return (
    <div className="fixed inset-0 z-[100] min-h-screen bg-[#fffdf5] font-sans text-gray-900 overflow-y-auto overflow-x-hidden custom-scrollbar">
      
      {/* Navbar */}
      <nav className="fixed w-full z-50 transition-all duration-300 py-4 px-6 lg:px-12 flex justify-between items-center bg-white/70 backdrop-blur-md border-b border-white/50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg transform -rotate-3">
            <MapIcon size={24} strokeWidth={2.5} />
          </div>
          <span className="font-black text-2xl tracking-tight text-teal-900">TripCanvas</span>
        </div>
        <div className="flex gap-4">
          <button onClick={onLogin} className="hidden md:block px-6 py-2 rounded-full font-bold text-teal-700 hover:bg-teal-50 transition-colors">
            登入
          </button>
          <button onClick={onLogin} className="px-6 py-2 bg-black text-white rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
            免費註冊 <ArrowRight size={16}/>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
        <div className="absolute top-20 right-0 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float-reverse"></div>
        <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 space-y-6 text-center lg:text-left">
            <div className="inline-block px-4 py-1.5 rounded-full bg-white border border-teal-100 shadow-sm text-teal-700 font-bold text-sm mb-2 transform rotate-2 animate-pop-in">
              🎉 2025 最潮的旅遊神器
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.1] tracking-tight drop-shadow-sm">
              把旅遊規劃<br/>
              變成一場<span className="text-teal-600 inline-block transform hover:scale-110 transition-transform cursor-pointer">派對！</span>
            </h1>
            <p className="text-xl text-gray-600 font-medium leading-relaxed max-w-lg mx-auto lg:mx-0">
              結合 <span className="text-purple-600 font-bold">AI 心情導航</span> 與 <span className="text-orange-500 font-bold">多人即時協作</span>。
              別再一個人面對 Excel 表格崩潰，這裡只有好玩的行程，沒有雷隊友。
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <button onClick={onLogin} className="px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-xl shadow-xl shadow-teal-200 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group">
                <Plane className="group-hover:animate-bounce" /> 開始我的旅程
              </button>
              <button onClick={onLogin} className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-100 rounded-2xl font-bold text-xl flex items-center justify-center gap-2">
                👀 先逛逛再說
              </button>
            </div>

            <div className="pt-8 flex items-center justify-center lg:justify-start gap-4">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                    <img key={i} src={`https://i.pravatar.cc/100?img=${i+10}`} className="w-10 h-10 rounded-full border-2 border-white" alt="user"/>
                ))}
              </div>
              <div className="text-sm font-bold text-gray-500">
                <span className="text-teal-600">5,000+</span> 主揪正在使用
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative h-[500px] hidden lg:block">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-96 bg-gray-200 rounded-3xl shadow-2xl overflow-hidden rotate-[-5deg] border-4 border-white z-10">
              <img src="https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover" alt="Tokyo"/>
              <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-md p-3 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800">🇯🇵 東京爆買團</span>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">進行中</span>
                </div>
              </div>
            </div>
            <div className="absolute top-20 right-10 bg-white p-4 rounded-2xl rounded-bl-none shadow-xl z-20 animate-float max-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <img src="https://i.pravatar.cc/100?img=5" className="w-6 h-6 rounded-full" alt="Sarah"/>
                <span className="text-xs font-bold text-gray-500">Sarah</span>
              </div>
              <p className="text-sm font-bold text-gray-800">這間燒肉一定要訂位！不然吃不到 🥩</p>
            </div>
            <div className="absolute bottom-20 left-0 bg-purple-600 text-white p-4 rounded-2xl rounded-tr-none shadow-xl z-20 animate-float-reverse rotate-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-yellow-300"/>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">AI Suggestion</span>
              </div>
              <p className="font-bold">下午 3 點剛好順路去<br/>「中目黑」喝咖啡 ☕️</p>
            </div>
            <div className="absolute top-1/3 left-10 z-30 animate-cursor">
              {/* 🟢 這裡原本因為缺少 MousePointer2 而崩潰 */}
              <MousePointer2 className="text-orange-500 fill-orange-500" size={32}/>
              <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded ml-4 font-bold">Alex</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature: Collaboration */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 relative">
            <div className="relative w-full aspect-square bg-gray-100 rounded-[3rem] overflow-hidden shadow-inner">
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=800" className="opacity-50 w-full h-full object-cover grayscale mix-blend-luminosity" alt="Collab"/>
              <div className="absolute top-10 left-10 right-10 bg-white p-4 rounded-2xl shadow-lg transform -rotate-2">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                  <span className="font-bold text-gray-800">Day 2: 淺草雷門</span>
                  <div className="flex -space-x-2">
                    <img src="https://i.pravatar.cc/100?img=1" className="w-6 h-6 rounded-full border border-white" alt="u1"/>
                    <img src="https://i.pravatar.cc/100?img=2" className="w-6 h-6 rounded-full border border-white" alt="u2"/>
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded text-sm text-gray-500 flex gap-2">
                  {/* 🟢 這裡原本因為缺少 MessageCircle 而崩潰 */}
                  <MessageCircle size={16}/>
                  Alex: 那邊遊客很多，要早點去！
                </div>
              </div>
              <div className="absolute bottom-20 right-5 left-20 bg-teal-600 text-white p-4 rounded-2xl shadow-lg transform rotate-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg"><Users size={20}/></div>
                  <div>
                    <p className="font-bold">即時同步</p>
                    <p className="text-xs opacity-80">你改了行程，大家手機都會震動</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-4">
              <Users size={24} />
            </div>
            <h2 className="text-4xl font-black text-gray-900">
              揪團不當雷隊友，<br/>
              行程大家一起喬！
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              就像用 Google Docs 一樣簡單。把景點拖來拖去，在卡片上留言、設定停留時間，
              不再需要一個人在群組自言自語。即時共編，讓每個人都有參與感。
            </p>
            <ul className="space-y-3">
              {['多人同時在線編輯', '自動同步至手機 App', '內建 Google 地圖評分參考'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 font-bold text-gray-700">
                  {/* 🟢 這裡原本因為缺少 Check 而崩潰 */}
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center"><Check size={14} strokeWidth={3}/></div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature: AI */}
      <section className="py-24 bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
          <div className="absolute w-[500px] h-[500px] bg-purple-600 rounded-full blur-[100px] -top-20 -left-20 animate-pulse"></div>
          <div className="absolute w-[400px] h-[400px] bg-blue-600 rounded-full blur-[100px] bottom-0 right-0 animate-pulse"></div>
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/50 text-purple-300 text-sm font-bold">
              <Sparkles size={14}/> TripCanvas AI 2.0
            </div>
            <h2 className="text-4xl font-black">
              懂你的「心情」<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">才是真正的 AI 排程。</span>
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed">
              不只是排景點，更在乎你的感受。今天想來點 <span className="text-yellow-300">✨ 新鮮探索</span> 還是 <span className="text-green-300">🌿 療傷放鬆</span>？
              告訴 AI 你的旅行目的與心情，30 秒內自動為你生成包含住宿、交通、美食的完美行程。
            </p>
            <button onClick={onLogin} className="px-6 py-3 bg-white text-gray-900 rounded-xl font-bold hover:bg-purple-50 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
              <Zap size={18} className="text-purple-600" fill="currentColor"/> 免費試用 AI 排程
            </button>
          </div>
          
          <div className="relative">
            <div className="bg-white text-gray-900 rounded-3xl p-6 shadow-2xl transform rotate-2 max-w-md mx-auto border border-gray-800/50">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Sparkles size={20} className="text-purple-600"/> AI 行程客製化
                </h3>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    <Smile size={16}/> 旅行心情
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                        {icon: '🎢', label: '刺激冒險', active: false},
                        {icon: '✨', label: '新鮮探索', active: true},
                        {icon: '🌿', label: '療傷放鬆', active: false},
                        {icon: '💪', label: '正能量', active: false},
                    ].map((mood, idx) => (
                        <span key={idx} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-all ${mood.active ? 'bg-yellow-100 border-yellow-400 text-yellow-800 ring-2 ring-yellow-200' : 'bg-white border-gray-200 text-gray-500'}`}>
                            <span>{mood.icon}</span> {mood.label}
                        </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    <Camera size={16}/> 旅行風格 (多選)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                        {icon: '🍜', label: '美食探索', active: true},
                        {icon: '📸', label: '熱門踩點', active: true},
                        {icon: '☕', label: '慢活漫遊', active: false},
                        {icon: '🛍️', label: '逛街購物', active: false},
                    ].map((style, idx) => (
                        <span key={idx} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-all ${style.active ? 'bg-purple-100 border-purple-400 text-purple-800 ring-2 ring-purple-200' : 'bg-white border-gray-200 text-gray-500'}`}>
                            <span>{style.icon}</span> {style.label}
                        </span>
                    ))}
                  </div>
                </div>

                <button className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:bg-purple-700 transition-colors">
                  <Sparkles size={18}/> 開始生成行程
                </button>
              </div>

              <div className="absolute -bottom-6 -right-6 bg-gray-800 text-white p-4 rounded-xl shadow-xl flex items-center gap-3 animate-bounce" style={{animationDuration: '3s'}}>
                <div className="relative">
                  <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
                  <div className="relative w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-xs font-bold">正在掃描當地熱門打卡點...</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature: Discovery */}
      <section className="py-24 bg-[#fffdf5] relative">
        <div className="text-center max-w-3xl mx-auto px-6 mb-12">
          <h2 className="text-4xl font-black text-gray-900 mb-4">
            拒絕觀光客視角，<br/>挖掘<span className="text-orange-500 underline decoration-wavy">在地人</span>的私房清單。
          </h2>
          <p className="text-lg text-gray-600">
            TripCanvas 整合了 <span className="font-bold text-teal-600">地圖探索</span> 功能，
            不管你想找隱藏酒吧、深夜按摩還是秘境溫泉，我們都幫你分類好了。
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-12 flex-wrap px-6">
          {[
            { icon: Utensils, label: "必吃美食" },
            { icon: Beer, label: "特色酒吧" },
            { icon: Activity, label: "放鬆按摩" },
            { icon: Landmark, label: "寺廟古蹟" },
            { icon: Mountain, label: "自然秘境" },
            { icon: Bed, label: "特色住宿" },
          ].map((cat, idx) => (
            <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200 text-sm font-bold text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors cursor-default hover:scale-105 transform">
              <cat.icon size={16}/> {cat.label}
            </div>
          ))}
        </div>

        {/* Marquee Animation */}
        <div className="relative w-full overflow-hidden py-10">
          <div className="flex gap-6 w-max animate-marquee hover:[animation-play-state:paused]">
            {[...galleryItems, ...galleryItems].map((item, i) => (
                <div key={i} className="w-72 h-96 shrink-0 relative rounded-3xl overflow-hidden group cursor-pointer shadow-lg transform transition-transform hover:-translate-y-4">
                    <img src={`${item.img}?auto=format&fit=crop&q=80&w=600`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="gallery"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 text-white">
                        <span className="bg-orange-500 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">{item.tag}</span>
                        <h3 className="font-bold text-xl">{item.title}</h3>
                    </div>
                </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-teal-900 text-teal-100 py-20 px-6 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="w-16 h-16 bg-teal-800 rounded-2xl flex items-center justify-center mx-auto text-white mb-6">
            <MapIcon size={32} />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            準備好開始你的<br/>下一趟旅程了嗎？
          </h2>
          <p className="text-xl text-teal-200">
            加入 TripCanvas，讓規劃行程從「繁瑣工作」變成「期待與享受」。
          </p>
          <button onClick={onLogin} className="px-10 py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold text-2xl shadow-xl shadow-orange-900/20 transform hover:scale-105 transition-all">
            立即開始 🔥
          </button>
          <p className="text-sm opacity-60 mt-10">
            © 2025 TripCanvas. All rights reserved. Made for Travelers.
          </p>
        </div>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        @keyframes float-reverse { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(15px); } }
        @keyframes cursor-move { 0% { transform: translate(0, 0); } 25% { transform: translate(100px, 50px); } 50% { transform: translate(50px, 100px); } 75% { transform: translate(-50px, 20px); } 100% { transform: translate(0, 0); } }
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        @keyframes pop-in { 0% { opacity: 0; transform: scale(0.8) rotate(2deg); } 100% { opacity: 1; transform: scale(1) rotate(2deg); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 5s ease-in-out infinite; }
        .animate-cursor { animation: cursor-move 10s infinite alternate; }
        .animate-marquee { animation: marquee 60s linear infinite; }
        .animate-pop-in { animation: pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

export default function Dashboard({ user, isMapScriptLoaded }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const [editingId, setEditingId] = useState(null); 
  const [shareModalData, setShareModalData] = useState(null);

  // Google Autocomplete 參考
  const autocompleteRef = useRef(null);

  const [newTrip, setNewTrip] = useState({
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    preSelectedCenter: null,
    flightOut: { airport: '', time: '' },
    flightIn: { airport: '', time: '' }
  });

  // 日期範圍 State
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDateObj, endDateObj] = dateRange;

  // 🟢 監聽螢幕寬度，解決手機版月份跳動問題
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      const myTrips = tripList.filter(t => t.collaborators && t.collaborators.includes(user.uid));
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

  const handleLogin = async () => {
    if (!auth) { 
      console.error("Firebase Auth not initialized");
      alert("系統錯誤：登入服務未啟動，請重新整理網頁。"); 
      return; 
    }
    
    try { 
      // 🟢 使用 setPersistence 確保登入狀態持久化 (選填，但推薦)
      // await setPersistence(auth, browserLocalPersistence); 
      
      const result = await signInWithPopup(auth, googleProvider); 
      const user = result.user;
      
      // 🟢 登入成功後，寫入/更新使用者資料庫
      try {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: user.displayName || "Unknown",
          email: user.email || "",
          photoURL: user.photoURL || "",
          lastLogin: new Date().toISOString()
        }, { merge: true });
        console.log("✅ User data synced to Firestore");
      } catch (dbError) {
        console.warn("⚠️ Firestore sync failed (可能是權限問題，但不影響登入):", dbError);
        // 不阻擋登入流程，讓用戶繼續使用
      }

      console.log("✅ 登入成功！User:", user.displayName);
    } catch (error) { 
      // 🟢 過濾掉「用戶自己關閉視窗」的錯誤，不顯示煩人的 Alert
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("使用者取消了登入");
        return;
      }
      
      console.error("❌ Login failed:", error); 
      alert(`登入失敗 (${error.code}): ${error.message}`);
    }
  };

  // 處理 Google Autocomplete 選擇
  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const name = place.name || place.formatted_address.split(',')[0];
        setNewTrip(prev => ({
          ...prev,
          destination: name,
          preSelectedCenter: { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
        }));
      }
    }
  };

  // 處理日期選擇
  const handleDateChange = (update) => {
    const safeUpdate = update || [null, null];
    setDateRange(safeUpdate);
    const [start, end] = safeUpdate;
    const formatDate = (d) => d ? d.toISOString().split('T')[0] : '';
    setNewTrip(prev => ({ ...prev, startDate: formatDate(start), endDate: formatDate(end) }));
  };

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
    if(trip.startDate && trip.endDate) {
       setDateRange([new Date(trip.startDate), new Date(trip.endDate)]);
    } else {
       setDateRange([null, null]);
    }
    setEditingId(trip.id);
    setShowCreateModal(true);
  };

  const handleDeleteTrip = async (trip) => {
    const isOwner = trip.ownerId === user.uid;
    if (isOwner) {
      if (!window.confirm("確定要刪除此行程嗎？\n\n此動作將無法復原。")) return;
      try { await deleteDoc(doc(db, 'artifacts', appId, 'trips', trip.id)); } 
      catch (error) { alert("刪除失敗，請檢查網路連線。"); }
    } else {
      if (!window.confirm("確定要退出此行程的共編嗎？")) return;
      try { 
        const tripRef = doc(db, 'artifacts', appId, 'trips', trip.id);
        await updateDoc(tripRef, { collaborators: arrayRemove(user.uid) });
      } catch (error) { alert("退出失敗。"); }
    }
  };

  const handleSaveTrip = async () => {
    if (!newTrip.title || !newTrip.destination) {
      alert("請填寫行程名稱與目的地");
      return;
    }
    setIsCreating(true);
    let finalCenter = { lat: 35.6762, lng: 139.6503 };
    
    if (newTrip.preSelectedCenter) {
      finalCenter = { lat: Number(newTrip.preSelectedCenter.lat), lng: Number(newTrip.preSelectedCenter.lng) };
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

    try {
      if (editingId) {
        const tripRef = doc(db, 'artifacts', appId, 'trips', editingId);
        await updateDoc(tripRef, tripData);
        setShowCreateModal(false);
      } else {
        const fullData = {
          ...tripData,
          ownerId: user.uid,
          collaborators: [user.uid],
          createdAt: nowISO,
        };
        const tripsRef = collection(db, 'artifacts', appId, 'trips');
        const newDocRef = doc(tripsRef);
        await setDoc(newDocRef, JSON.parse(JSON.stringify(fullData)));
        setShowCreateModal(false);
        navigate(`/trip/${newDocRef.id}`);
      }
      setNewTrip({ title: '', destination: '', startDate: '', endDate: '', preSelectedCenter: null, flightOut: { airport: '', time: '' }, flightIn: { airport: '', time: '' } });
      setDateRange([null, null]);
      setEditingId(null);
    } catch (error) {
      console.error("Save Error:", error);
      alert(`儲存失敗: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-gray-50 font-sans text-gray-800 overflow-y-auto overflow-x-hidden custom-scrollbar">
      {/* 🟢 CSS 優化：修復日期選擇器排版與 Icon 重疊問題 */}
      <style>{`
        .react-datepicker-wrapper { width: 100%; }
        .react-datepicker__input-container input {
           width: 100%; height: 46px; border-radius: 0.75rem; border: 1px solid #d1d5db;
           padding: 0.625rem 1rem; outline: none; font-size: 0.875rem;
        }
        .react-datepicker__input-container input:focus { border-color: #14b8a6; ring: 2px solid #14b8a6; }
        .react-datepicker-popper { z-index: 60 !important; }
        
        /* 1. 修復右側空白：讓容器 inline-flex 自適應 */
        .react-datepicker {
           font-family: 'Inter', sans-serif; border: none; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
           border-radius: 1rem; overflow: hidden;
           display: inline-flex !important;
        }
        
        .react-datepicker__header { background-color: white; border-bottom: 1px solid #f3f4f6; padding-top: 1rem; }
        .react-datepicker__current-month { font-weight: 800; color: #111827; margin-bottom: 0.5rem; }
        .react-datepicker__day-name { color: #9ca3af; font-weight: 600; width: 2.5rem; }
        .react-datepicker__day { width: 2.5rem; line-height: 2.5rem; margin: 0.1rem; border-radius: 0.5rem; font-weight: 500; }
        .react-datepicker__day--selected, .react-datepicker__day--in-range { background-color: #0d9488 !important; color: white !important; }
        .react-datepicker__day--in-selecting-range:not(.react-datepicker__day--in-range) { background-color: #ccfbf1 !important; color: #0f766e !important; }
        .react-datepicker__day--keyboard-selected { background-color: #f0fdfa; color: #0d9488; }
        .react-datepicker__navigation { top: 1rem; }
        
        /* 2. 修復 Icon 重疊：強制將清除按鈕往左移 */
        .react-datepicker__close-icon {
           right: 40px !important; /* 移到 Calendar icon 左側 */
           top: 0 !important;
           height: 100% !important;
           display: flex !important;
           align-items: center !important;
           padding: 0 !important;
           z-index: 10;
        }
        .react-datepicker__close-icon::after {
           background-color: transparent !important;
           color: #9ca3af !important;
           font-size: 1.25rem !important;
           content: "×" !important;
        }

        .pac-container { z-index: 9999 !important; border-radius: 0.75rem; margin-top: 4px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; font-family: 'Inter', sans-serif; }
        .pac-item { padding: 10px 12px; cursor: pointer; }
        .pac-item:hover { background-color: #f0fdfa; }
        .pac-item-query { font-size: 14px; color: #111827; }
        .pac-icon { display: none; } 
      `}</style>

      {!user ? (
        <LandingPage onLogin={handleLogin} />
      ) : (
        <>
          <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="bg-teal-600 p-1.5 rounded-lg"><MapIcon className="text-white" size={20} /></div>
              <span className="font-bold text-xl text-teal-800 tracking-tight">TripCanvas</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {user.photoURL ? <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-gray-200" /> : <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700"><User size={16} /></div>}
                <span className="text-sm font-medium hidden md:block">{user.displayName}</span>
              </div>
              <button onClick={() => signOut(auth)} className="text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"><LogOut size={16} /> <span className="hidden md:inline">登出</span></button>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-6 py-10">
            <div>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-800 border-l-4 border-teal-500 pl-3">我的行程</h2>
                <button onClick={() => { setEditingId(null); setShowCreateModal(true); setDateRange([null, null]); setNewTrip({ title: '', destination: '', startDate: '', endDate: '', preSelectedCenter: null, flightOut: { airport: '', time: '' }, flightIn: { airport: '', time: '' } }); }} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow hover:shadow-md"><Plus size={18} /> 建立新行程</button>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-600" size={32} /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div onClick={() => { setEditingId(null); setShowCreateModal(true); setDateRange([null, null]); setNewTrip({ title: '', destination: '', startDate: '', endDate: '', preSelectedCenter: null, flightOut: { airport: '', time: '' }, flightIn: { airport: '', time: '' } }); }} className="border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all group min-h-[220px]">
                    <div className="w-14 h-14 rounded-full bg-gray-100 group-hover:bg-teal-200 flex items-center justify-center mb-4 transition-colors"><Plus className="text-gray-400 group-hover:text-teal-700" size={28} /></div>
                    <span className="font-bold text-gray-500 group-hover:text-teal-700 text-lg">新增行程</span>
                  </div>
                  {trips.map(trip => (
                    <div key={trip.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group flex flex-col relative" onClick={() => navigate(`/trip/${trip.id}`)}>
                      <div className="absolute top-3 right-3 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTrip(trip); }} className="bg-white/90 p-2 rounded-full shadow hover:text-red-600 text-gray-500 hover:scale-110 transition-all" title="刪除行程"><Trash2 size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setShareModalData(trip); }} className="bg-white/90 p-2 rounded-full shadow hover:text-teal-600 text-gray-500 hover:scale-110 transition-all" title="成員與邀請"><Users size={18} /></button>
                        {trip.ownerId === user.uid && (<button onClick={(e) => { e.stopPropagation(); handleEditClick(trip); }} className="bg-white/90 p-2 rounded-full shadow hover:text-blue-600 text-gray-500 hover:scale-110 transition-all" title="編輯行程資訊"><Edit3 size={18} /></button>)}
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
          </main>

          {/* Modal */}
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
                    <input type="text" placeholder="例如：東京五天四夜爆食之旅" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500" value={newTrip.title} onChange={e => setNewTrip({ ...newTrip, title: e.target.value })} />
                  </div>
                  
                  {/* Google Autocomplete */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">目的地 (輸入後自動搜尋)</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3 text-gray-400 z-10" size={18} />
                      {isMapScriptLoaded && (
                        <Autocomplete onLoad={ref => autocompleteRef.current = ref} onPlaceChanged={onPlaceChanged}>
                          <input type="text" placeholder="輸入城市或機場 (如: Osaka)" className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500" value={newTrip.destination} onChange={e => setNewTrip({ ...newTrip, destination: e.target.value })} />
                        </Autocomplete>
                      )}
                    </div>
                  </div>

                  {/* 🟢 雙月份日期選擇器 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">旅遊日期 (點選起訖日)</label>
                    <div className="relative">
                       <DatePicker
                          selectsRange={true}
                          startDate={startDateObj}
                          endDate={endDateObj}
                          onChange={handleDateChange}
                          isClearable={true}
                          placeholderText="請選擇去程與回程日期"
                          dateFormat="yyyy/MM/dd"
                          monthsShown={isMobile ? 1 : 2}
                          className="w-full"
                          // locale="zh-TW" // 移除此行，暫時使用英文介面
                       />
                       <Calendar className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={18} />
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
          
          <ShareModal 
            isOpen={!!shareModalData} 
            onClose={() => setShareModalData(null)} 
            trip={shareModalData}
            currentUser={user}
          />
        </>
      )}
    </div>
  );
}