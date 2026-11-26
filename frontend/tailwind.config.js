/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          500: '#6366F1',
          600: '#4F46E5', // Primary indigo accent
          700: '#4338CA',
        },
        slate: {
          900: '#0F172A', // Primary text
          600: '#475569', // Secondary text
          400: '#94A3B8', // Muted text
          200: '#E2E8F0', // Border
          100: '#F1F5F9', // Subtle surface
          50: '#F8FAFC',  // Canvas
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
