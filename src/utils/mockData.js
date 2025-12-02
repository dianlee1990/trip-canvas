// src/utils/mockData.js

export const TODAY = new Date();
export const DATE_NEAR = new Date(TODAY); DATE_NEAR.setDate(TODAY.getDate() + 2); 
export const DATE_FAR = new Date(TODAY); DATE_FAR.setDate(TODAY.getDate() + 180); 

export const WEATHER_DB = {
  1: { type: 'rain', temp: '11°C - 14°C', precip: '80%', alert: '大雨特報：建議安排室內備案' },
  2: { type: 'sun', temp: '15°C - 22°C', precip: '10%', alert: null },
  3: { type: 'cloud', temp: '14°C - 19°C', precip: '30%', alert: null },
};

export const SEARCH_RESULTS = [
  { id: 's1', name: '晴空塔 (Skytree)', rating: 4.6, type: 'spot', image: 'https://images.unsplash.com/photo-1545389332-687834a34bb8?w=400', tags: ['地標', '購物'], pos: { top: 25, left: 75 } },
  { id: 's2', name: '阿美橫丁', rating: 4.3, type: 'spot', image: 'https://images.unsplash.com/photo-1583246826620-1120463b7235?w=400', tags: ['平價', '小吃'], pos: { top: 45, left: 35 } },
  { id: 's3', name: '秋葉原電器街', rating: 4.5, type: 'spot', image: 'https://images.unsplash.com/photo-1578553956983-3882755257f8?w=400', tags: ['動漫', '3C'], pos: { top: 40, left: 55 } },
];

export const RECOMMENDED_FAVORITES = [
  { id: 'f1', name: '銀座 LoFt', rating: 4.8, type: 'spot', image: 'https://images.unsplash.com/photo-1551644783-c28f987f62d1?w=400', tags: ['文具', '雜貨'], note: '必買手帳', pos: { top: 60, left: 60 } },
  { id: 'f2', name: '藍瓶咖啡 清澄白河', rating: 4.5, type: 'food', image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400', tags: ['咖啡', '網美'], note: '想去拍照', pos: { top: 70, left: 80 } },
];

export const ACCOMMODATION = {
    id: 'hotel-1',
    name: '淺草雷門酒店',
    type: 'hotel',
    location: 'Asakusa',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
    pos: { top: 30, left: 70 }
};