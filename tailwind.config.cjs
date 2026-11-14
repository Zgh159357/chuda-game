/** @type {import('tailwindcss').Config} */
const path = require('path');
module.exports = {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-deep': 'var(--paper-deep)',
        ink: 'var(--ink)',
        seal: 'var(--seal)',
        field: 'var(--field)',
        earth: 'var(--earth)',
        indigo: 'var(--indigo)',
        warn: 'var(--warn)',
        fail: 'var(--fail)',
        line: 'var(--line)',
      },
      fontFamily: {
        serif: ['Songti SC', 'SimSun', 'Noto Serif SC', 'serif'],
        kai: ['KaiTi', 'STKaiti', 'Kaiti SC', 'cursive'],
        sans: ['Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'sans-serif'],
      },
      letterSpacing: {
        seal: '0.2em',
        title: '0.35em',
      },
    },
  },
  plugins: [],
};
