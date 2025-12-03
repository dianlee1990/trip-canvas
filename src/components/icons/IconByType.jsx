import React from 'react';
import { Camera, Utensils, Bed, Train, MapPin } from 'lucide-react';

export const IconByType = ({ type, size = 16, color = "currentColor", className = "" }) => {
    // 根據地點類型回傳對應的 Icon
    switch (type) {
        case 'food':
        case 'restaurant':
        case 'cafe':
            return <Utensils size={size} color={color} className={className} />;
        
        case 'hotel':
        case 'lodging':
            return <Bed size={size} color={color} className={className} />;
        
        case 'connection':
        case 'transit':
            return <Train size={size} color={color} className={className} />;
        
        case 'spot':
        case 'tourist_attraction':
        default:
            // 預設顯示相機 (景點)
            return <Camera size={size} color={color} className={className} />;
    }
};