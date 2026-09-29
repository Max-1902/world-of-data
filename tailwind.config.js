/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0a0d08',
          800: '#0d1210',
          700: '#141e16',
          600: '#1c2e20',
          500: '#2a3e2e',
        },
        accent: {
          green: '#00ff88',
          blue: '#44aaff',
          red: '#ff3344',
          yellow: '#ccaa00',
          orange: '#ff6600',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
