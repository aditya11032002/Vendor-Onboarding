/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: 'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          850: 'rgb(var(--slate-850) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
          950: 'rgb(var(--slate-950) / <alpha-value>)',
        },
        emerald: {
          950: 'rgb(var(--emerald-950) / <alpha-value>)',
          800: 'rgb(var(--emerald-800) / <alpha-value>)',
          400: 'rgb(var(--emerald-400) / <alpha-value>)',
        },
        amber: {
          950: 'rgb(var(--amber-950) / <alpha-value>)',
          800: 'rgb(var(--amber-800) / <alpha-value>)',
          400: 'rgb(var(--amber-400) / <alpha-value>)',
        },
        rose: {
          950: 'rgb(var(--rose-950) / <alpha-value>)',
          800: 'rgb(var(--rose-800) / <alpha-value>)',
          400: 'rgb(var(--rose-400) / <alpha-value>)',
        },
        purple: {
          950: 'rgb(var(--purple-950) / <alpha-value>)',
          800: 'rgb(var(--purple-800) / <alpha-value>)',
          400: 'rgb(var(--purple-400) / <alpha-value>)',
        },
        indigo: {
          950: 'rgb(var(--indigo-950) / <alpha-value>)',
          900: 'rgb(var(--indigo-900) / <alpha-value>)',
          700: 'rgb(var(--indigo-700) / <alpha-value>)',
          400: 'rgb(var(--indigo-400) / <alpha-value>)',
          300: 'rgb(var(--indigo-300) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
