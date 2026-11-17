/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-ibm-plex-arabic)',
          'var(--font-inter)',
          'var(--font-cairo)',
          'IBM Plex Sans Arabic',
          'Inter',
          'Cairo',
          'system-ui',
          'sans-serif',
        ],
        arabic: ['var(--font-ibm-plex-arabic)', 'var(--font-cairo)', 'IBM Plex Sans Arabic', 'Cairo', 'sans-serif'],
        inter: ['var(--font-inter)', 'Inter', 'sans-serif'],
        cairo: ['var(--font-cairo)', 'Cairo', 'sans-serif'],
        poppins: ['var(--font-inter)', 'var(--font-poppins)', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        ds: {
          canvas: 'var(--ds-bg-canvas)',
          surface: 'var(--ds-bg-surface)',
          elevated: 'var(--ds-bg-elevated)',
          subtle: 'var(--ds-bg-subtle)',
          accent: 'var(--ds-accent)',
          positive: 'var(--ds-positive)',
          negative: 'var(--ds-negative)',
          warning: 'var(--ds-warning)',
          unavailable: 'var(--ds-unavailable)',
        },
        diyar: {
          navyDark: '#040B1C',
          navyDeep: '#0B1D42',
          navyCard: '#0F2356',
          navyBottom: '#07112B',
          royalBlue: '#1E3A8A',
          royalLight: '#1D63B8',
          skyGlow: '#00A8E8',
          skyLight: '#38BDF8',
          skyIce: '#BAE6FD',
          skyPale: '#E0F2FE',
        },
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
        },
        gold: {
          300: 'rgb(var(--gold-300) / <alpha-value>)',
          400: 'rgb(var(--gold-400) / <alpha-value>)',
          500: 'rgb(var(--gold-500) / <alpha-value>)',
          600: 'rgb(var(--gold-600) / <alpha-value>)',
        },
        mist: {
          100: 'rgb(var(--mist-100) / <alpha-value>)',
          300: 'rgb(var(--mist-300) / <alpha-value>)',
          400: 'rgb(var(--mist-400) / <alpha-value>)',
          500: 'rgb(var(--mist-500) / <alpha-value>)',
        },
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        'ds-card': 'var(--ds-shadow-card)',
        'ds-elevated': 'var(--ds-shadow-elevated)',
      },
      transitionTimingFunction: {
        ds: 'var(--ds-ease-out)',
      },
      gridTemplateColumns: {
        13: 'repeat(13, minmax(0, 1fr))',
        14: 'repeat(14, minmax(0, 1fr))',
        15: 'repeat(15, minmax(0, 1fr))',
        16: 'repeat(16, minmax(0, 1fr))',
        24: 'repeat(24, minmax(0, 1fr))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
}
