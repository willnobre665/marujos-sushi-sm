import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta dark premium — Marujos Sushi
        background: '#0A0A0A',
        surface: '#141414',
        'surface-elevated': '#1C1C1C',
        'surface-hover': '#242424',
        border: '#2A2A2A',
        'border-subtle': '#1E1E1E',

        gold: {
          DEFAULT: '#C9A84C',
          light: '#E0C068',
          dark: '#A8893A',
          muted: '#C9A84C26', // 15% opacity
        },

        ivory: {
          DEFAULT: '#F5F0E8',
          muted: '#C8C4BC',
        },

        gray: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D4D4D4',
          300: '#B0B0B0',
          400: '#8A8A8A',
          500: '#666666',
          600: '#444444',
          700: '#333333',
          800: '#242424',
          900: '#1A1A1A',
          950: '#0F0F0F',
        },

        // Cores semânticas
        success: '#4CAF7D',
        warning: '#E8A838',
        danger: '#E85454',
        info: '#4C8AE8',
      },

      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },

      borderRadius: {
        '4xl': '2rem',
      },

      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },

      boxShadow: {
        'gold-sm': '0 0 12px rgba(201, 168, 76, 0.15)',
        'gold-md': '0 0 24px rgba(201, 168, 76, 0.20)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'bottom-bar': '0 -1px 0 rgba(255,255,255,0.06)',
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #C9A84C 0%, #E0C068 50%, #A8893A 100%)',
        'gradient-dark': 'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 60%, #0A0A0A 100%)',
      },

      animation: {
        'shimmer': 'shimmer 1.5s infinite linear',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fadeUp': 'fadeUp 0.5s ease both',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
      },

      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 4px 24px rgba(201,168,76,0.22), 0 0 28px rgba(201,168,76,0.15)' },
          '50%': { boxShadow: '0 4px 24px rgba(201,168,76,0.22), 0 0 40px rgba(201,168,76,0.30)' },
        },
        heroLogo: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        heroSlide: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        heroFade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
