// src/components/ui/WeatherPill.jsx
import React from 'react';
import { CloudRain, Sun, Umbrella } from 'lucide-react';
import { WEATHER_DB } from '../../utils/mockData'; // 假設 mockData 放在 utils

/**
 * WeatherPill 天氣膠囊元件
 * @param {number} day - 行程日 (用於查詢 mock DB)
 * @param {boolean} isFarFuture - 是否為超過 14 天的遠期旅行
 */
export default function WeatherPill({ day, isFarFuture }) {
    if (isFarFuture) {
        // 遠期旅行不顯示精確天氣
        return (
            <div className="ml-4 flex items-center gap-2 px-3 py-1 rounded-full border text-sm bg-gray-50 border-gray-200 text-gray-500">
                <Cloud size={16}/>
                <span className="font-bold">尚無預報</span>
            </div>
        );
    }

    const data = WEATHER_DB[day] || WEATHER_DB[2]; // 預設使用 Day 2 的陽光
    
    return (
        <div 
            className={`ml-4 flex items-center gap-2 px-3 py-1 rounded-full border text-sm transition-colors duration-500 cursor-help ${
                data.type === 'rain' 
                    ? 'bg-blue-50 border-blue-200 text-blue-800' 
                    : 'bg-orange-50 border-orange-200 text-orange-800'
            }`} 
            title={data.alert || "天氣良好"}
        >
            {data.type === 'rain' ? <CloudRain size={16}/> : <Sun size={16}/>}
            <span className="font-bold">{data.temp}</span>
            {data.precip !== '0%' && (
                <span className="text-xs opacity-75 border-l border-current pl-2 ml-1 flex items-center gap-1">
                    <Umbrella size={10}/> {data.precip}
                </span>
            )}
        </div>
    );
}