import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f2eee2',
        ink:   '#141210',
        orange:'#ef4e1b',
        green: '#1ba94c',
        blue:  '#1f49d6',
        yellow:'#ffd200',
        red:   '#e22a1c',
      },
      fontFamily: {
        display: ['Anton', 'sans-serif'],
        sans:    ['Archivo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
