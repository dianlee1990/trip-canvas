/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'Noto Sans TC', 'sans-serif'],
          serif: ['Playfair Display', 'serif'],
          display: ['Cinzel', 'serif'],
          fashion: ['Abril Fatface', 'cursive'],
          japanese: ['Noto Serif JP', 'serif'],
          art: ['Cormorant Garamond', 'serif'],
          travel: ['DM Serif Display', 'serif'],
          diary: ['Gaegu', 'Noto Sans TC', 'sans-serif'],
          manga: ['Bangers', 'Noto Sans TC', 'cursive'],
          mangaTitle: ['Knewave', 'cursive'],
        },
        colors: {
          'diary-bg': '#FFF0F5', 
          'diary-pink': '#FF9EB5',
          'diary-text': '#5D4037',
          'art-dark': '#0a0a0a',
          'art-gold': '#D4AF37',
          'manga-ink': '#111',
          'manga-paper': '#fff',
          'manga-screen': '#ccc',
        },
        boxShadow: {
          'float': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          'magazine': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          'sticker': '3px 3px 0px rgba(0,0,0,0.1)',
          'comic': '4px 4px 0px 0px #000',
        },
        dropShadow: {
          'art-text': '0 2px 4px rgba(0,0,0,0.8)',
        },
        animation: {
          'in': 'fadeIn 0.3s ease-out',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          }
        }
      },
    },
    plugins: [],
  }