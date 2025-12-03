import React, { useState } from 'react';
import { X, Copy, Mail, User, Trash2, Check } from 'lucide-react';
import { updateDoc, doc, arrayRemove } from 'firebase/firestore';
import { db } from '../../utils/firebase';

const appId = 'default-app-id'; // 暫時寫死，未來可優化

export default function ShareModal({ isOpen, onClose, trip, currentUser }) {
  const [activeTab, setActiveTab] = useState('invite'); // 'invite' or 'members'
  const [email, setEmail] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !trip) return null;

  const tripUrl = `${window.location.origin}/trip/${trip.id}`;
  const isOwner = trip.ownerId === currentUser?.uid;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(tripUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleEmailInvite = () => {
    // MVP 方案：開啟使用者的 Email 軟體，並自動帶入連結
    const subject = `邀請你加入行程：${trip.title}`;
    const body = `嗨！我正在使用 TripCanvas 規劃 ${trip.destination} 的行程，邀請你一起來編輯：\n\n${tripUrl}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleRemoveMember = async (uid) => {
    if (!confirm('確定要移除這位成員嗎？')) return;
    try {
      const tripRef = doc(db, 'artifacts', appId, 'trips', trip.id);
      await updateDoc(tripRef, {
        collaborators: arrayRemove(uid)
      });
      alert('已移除成員');
    } catch (e) {
      console.error(e);
      alert('移除失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">邀請與成員管理</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* 分頁切換 */}
        <div className="flex border-b">
          <button 
            onClick={() => setActiveTab('invite')}
            className={`flex-1 py-3 text-sm font-bold ${activeTab === 'invite' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500'}`}
          >
            邀請加入
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-sm font-bold ${activeTab === 'members' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500'}`}
          >
            成員名單 ({trip.collaborators?.length || 0})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'invite' ? (
            <div className="space-y-6">
              {/* 方式 1: 連結 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">分享連結 (對方登入後點擊即可加入)</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={tripUrl} className="flex-1 bg-gray-100 border rounded-lg px-3 py-2 text-sm text-gray-600 outline-none" />
                  <button onClick={handleCopyLink} className="bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-1 min-w-[80px] justify-center">
                    {isCopied ? <Check size={16}/> : <Copy size={16}/>}
                    <span className="text-xs">{isCopied ? '已複製' : '複製'}</span>
                  </button>
                </div>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">或是</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* 方式 2: Email */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">透過 Email 寄送邀請</label>
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="輸入對方 Email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-teal-500" 
                  />
                  <button onClick={handleEmailInvite} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                    <Mail size={16}/>
                    <span className="text-xs">寄送</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {trip.collaborators?.map((uid, index) => (
                <div key={uid} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                      <User size={14}/>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-700">{uid === currentUser?.uid ? '我 (擁有者)' : `成員 ${uid.slice(0, 4)}...`}</div>
                      <div className="text-[10px] text-gray-400">{uid}</div>
                    </div>
                  </div>
                  {isOwner && uid !== currentUser?.uid && (
                    <button onClick={() => handleRemoveMember(uid)} className="text-gray-300 hover:text-red-500 p-2">
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}