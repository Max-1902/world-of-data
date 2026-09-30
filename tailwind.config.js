/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#080e13',
          800: '#0d161d',
          700: '#111d26',
          600: '#1c2b35',
          500: '#2a3d49',
        },
        accent: {
          green: '#69c9a7',
          blue: '#78b9d1',
          red: '#ef7373',
          yellow: '#e1b66c',
          orange: '#d5a85f',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
