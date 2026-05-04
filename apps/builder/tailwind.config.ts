import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        // Бренд W8 Shipping — малиновый
        accent: {
          50: '#fdf2f5',
          100: '#fce7ed',
          200: '#facfdb',
          300: '#f5a8bc',
          400: '#ed7493',
          500: '#e3004f',
          600: '#d42e5b',
          700: '#b01e48',
          800: '#931c40',
          900: '#7d1c3b',
        },
        // Нейтральные тона для UI
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.25rem',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-out-left': 'slideOutLeft 0.25s ease-in',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(32px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-32px)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
