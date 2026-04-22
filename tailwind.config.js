/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        gold: '#C5A059',
        'gold-soft': '#D4B06A',
        'gold-bg': '#FBF7EE',
        'gold-light': '#F5ECD7',
        'gold-dark': '#8B6B2F',
        crimson: '#BE123C',
        'app-bg': '#FCFCFC',
        'text-primary': '#1c1917',
        'text-secondary': '#78716c',
        'text-muted': '#a8a29e',
        'app-border': '#f2f1ec',
      },
      fontFamily: {
        serif: ['EBGaramond_400Regular'],
        'serif-italic': ['EBGaramond_400Regular_Italic'],
        'serif-medium': ['EBGaramond_500Medium'],
        'serif-medium-italic': ['EBGaramond_500Medium_Italic'],
        'sans-reg': ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
