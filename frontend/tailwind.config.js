/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5B5BD6',
        success: '#22C55E',
        warning: '#F59E0B',
      }
    },
  },
  plugins: [],
}