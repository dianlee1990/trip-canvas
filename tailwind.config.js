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
          // Diary Style
          'diary-bg': '#FFF0F5',
          'diary-pink': '#FF9EB5',
          'diary-text': '#5D4037',
          'diary-blue': '#A2D2FF',
          'diary-yellow': '#FBE7C6',
          'diary-green': '#E2F0CB',
          // Art Style
          'art-dark': '#0a0a0a',
          'art-gold': '#D4AF37',
          // Manga
          'manga-ink': '#111',
        },
        boxShadow: {
          'magazine': '0 20px 40px -10px rgba(0,0,0,0.3)',
          'polaroid': '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          'comic': '4px 4px 0px 0px #000',
          'comic-boom': '8px 8px 0px 0px #000',
          'sticker': '3px 3px 0px rgba(0,0,0,0.1)',
        },
        backgroundImage: {
          'paper-texture': "url('https://www.transparenttextures.com/patterns/cream-paper.png')",
          'dot-pattern-dense': "radial-gradient(#FF9EB5 20%, transparent 21%)",
        }
      },
    },
    plugins: [],
  }