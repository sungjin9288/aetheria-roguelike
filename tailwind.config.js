/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        rajdhani: ['Rajdhani', 'sans-serif'],
        fira: ['"Fira Code"', 'monospace'],
      },
      colors: {
        cyber: {
          green: '#00ff9d',
          blue: '#00ccff',
          pink: '#ff00ff',
          purple: '#bc13fe',
          black: '#0a0a0f',
          dark: '#050505',
          slate: '#1a1a2e',
        }
      },
      boxShadow: {
        'neon-green': '0 0 5px #00ff9d, 0 0 20px rgba(0, 255, 157, 0.4)',
        'neon-blue': '0 0 5px #00ccff, 0 0 20px rgba(0, 204, 255, 0.4)',
        'neon-pink': '0 0 5px #ff00ff, 0 0 20px rgba(255, 0, 255, 0.4)',
      },
      animation: {
        'scanline': 'scanline 8s linear infinite',
        'glitch': 'glitch 1s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glitch: {
          '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
          '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
          '62%': { transform: 'translate(0,0) skew(5deg)' },
        }
      }
    },
  },
  plugins: [],
}