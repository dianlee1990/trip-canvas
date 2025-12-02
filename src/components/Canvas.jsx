// ... (前方 imports 保持不變)

const SortableTripItem = ({ item, index, onRemove, onPlaceSelect, onUpdateItem, isGenerating }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { item } });
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const isOverlayOpen = showTimePicker || showDurationPicker;

    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 999 : (isOverlayOpen ? 100 : 1), position: 'relative' };

    // 產生 Google Maps 連結 (如果 item.url 空白才用這個)
    const fallbackMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}&query_place_id=${item.place_id || ''}`;
    const displayMapsUrl = item.url || fallbackMapsUrl;

    // ... (handleTimeSave, handleDurationSave 保持不變)

    // 【關鍵修改】點擊卡片時，傳遞完整資訊給 MapZone
    const handleCardSelect = () => {
        if (!isDragging && onPlaceSelect) {
            onPlaceSelect({
                id: item.id,
                name: item.name,
                lat: item.lat,
                lng: item.lng,
                // 補上這兩個關鍵欄位
                rating: item.rating,
                url: displayMapsUrl, 
                pos: { lat: item.lat, lng: item.lng }
            });
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="group mb-4 outline-none">
            {/* ... (連線與時間軸 UI 保持不變) ... */}
            
            {/* 卡片本體 */}
            <div 
                onClick={handleCardSelect} // 改用新的 handler
                className={`flex-1 bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group/card ${isGenerating ? 'animate-pulse' : ''}`}
            >
                <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1 w-full">
                        <h4 className="font-bold text-gray-800 text-base line-clamp-1">{item.name}</h4>
                        
                        {/* 評分顯示 */}
                        <div className="flex items-center gap-2 text-xs">
                            {item.rating > 0 ? (
                                <span className="flex items-center text-orange-500 font-bold bg-orange-50 px-1.5 py-0.5 rounded-md">
                                    {item.rating} <Star size={10} fill="currentColor" className="ml-0.5"/>
                                </span>
                            ) : (
                                <span className="text-gray-400 text-[10px]">尚無評分</span>
                            )}
                            {item.price_level > 0 && (
                                <span className="text-gray-500 font-medium">
                                    {[...Array(item.price_level)].map((_, i) => <span key={i} className="text-gray-800">$</span>)}
                                </span>
                            )}
                        </div>
                    </div>
                    <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-600 p-1 cursor-grab active:cursor-grabbing"><GripVertical size={16} /></button>
                </div>

                {/* ... (AI 摘要與底部按鈕區 保持不變，但 Map 按鈕連結要更新) ... */}
                
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                    {/* ... (左側時間按鈕 保持不變) ... */}
                    
                    <div className="flex items-center gap-2">
                        {/* 訂位按鈕 (保持不變) */}
                        {/* ... */}

                        {/* Google Maps 按鈕：使用 displayMapsUrl */}
                        <a href={displayMapsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-blue-600 flex items-center gap-1 text-[10px] bg-gray-50 px-2 py-1 rounded hover:bg-blue-50 transition-colors border border-gray-100" title="在 Google 地圖查看評論">
                            <MapPin size={12}/> 地圖/評論
                        </a>

                        <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} className="text-gray-300 hover:text-red-500 p-1 ml-1 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... (DateEditor, Canvas export 保持不變)
export default function Canvas({ activeDay, setActiveDay, currentTrip, handleUpdateTrip, itinerary, isGenerating, aiStatus, setIsAIModalOpen, handleRemoveFromItinerary, onPlaceSelect, onBack, handleUpdateItem }) {
    // ... (內容保持不變)
    // 確保傳遞 onPlaceSelect 給 SortableTripItem 即可
    // ...
    return (
         // ...
         <SortableTripItem 
             // ...
             onPlaceSelect={onPlaceSelect} 
             // ...
         />
         // ...
    );
}