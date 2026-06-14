import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#23272f',
        shadowDark: '#15181d',
        shadowLight: '#2f343d',
        accent: '#2F9BFF',
        accent2: '#57b0ff',
        txt: '#d7dce4',
        muted: '#838a96',
        bright: '#f0f2f6',
        bg: '#121317',
      },
      fontFamily: { sans: ['Geist', 'system-ui', 'sans-serif'] },
      boxShadow: {
        neu: '7px 7px 15px #15181d, -7px -7px 15px #2f343d',
        'neu-sm': '5px 5px 10px #15181d, -5px -5px 10px #2f343d',
        'neu-inset': 'inset 4px 4px 8px #15181d, inset -4px -4px 8px #2f343d',
        'neu-lg': '14px 14px 30px #090a0d, -10px -10px 26px #232830',
      },
      borderRadius: { neu: '20px', 'neu-lg': '36px' },
    },
  },
  plugins: [],
} satisfies Config
