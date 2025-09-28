/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          300: '#cbd5a0',
          400: '#b8c77a',
          500: '#9aad54',
          600: '#7d8f3e',
          700: '#5f6b2e'
        }
      }
    }
  },
  plugins: [],
};
