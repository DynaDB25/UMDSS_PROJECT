/** @type {import('tailwindcss').Config} */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Tight", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        canvas: withAlpha('--canvas'),
        surface: {
          DEFAULT: withAlpha('--surface'),
          sunken: withAlpha('--surface-sunken'),
        },
        ink: {
          DEFAULT: withAlpha('--ink'),
          secondary: withAlpha('--ink-secondary'),
          muted: withAlpha('--ink-muted'),
          faint: withAlpha('--ink-faint'),
        },
        rule: {
          DEFAULT: withAlpha('--rule'),
          strong: withAlpha('--rule-strong'),
        },
        accent: {
          DEFAULT: withAlpha('--accent'),
          hover: withAlpha('--accent-hover'),
          soft: withAlpha('--accent-soft'),
          on: withAlpha('--on-accent'),
        },
        band: {
          DEFAULT: withAlpha('--band'),
          on: withAlpha('--on-band'),
          muted: withAlpha('--on-band-muted'),
          rule: withAlpha('--band-rule'),
        },
        state: {
          neutral: withAlpha('--state-neutral'),
          progress: withAlpha('--state-progress'),
          attention: withAlpha('--state-attention'),
          positive: withAlpha('--state-positive'),
          negative: withAlpha('--state-negative'),
          special: withAlpha('--state-special'),
          'neutral-soft': withAlpha('--state-neutral-soft'),
          'progress-soft': withAlpha('--state-progress-soft'),
          'attention-soft': withAlpha('--state-attention-soft'),
          'positive-soft': withAlpha('--state-positive-soft'),
          'negative-soft': withAlpha('--state-negative-soft'),
          'special-soft': withAlpha('--state-special-soft'),
        },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
      // The old design leaned on `h-4.5`/`w-4.5`, which is not on Tailwind's
      // default scale and silently compiled to nothing in 20 places.
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
      },
      maxWidth: {
        content: '1400px',
        prose: '68ch',
      },
      // This system separates surfaces with hairlines, not elevation.
      // The only shadow that exists is for things floating above the page.
      boxShadow: {
        overlay: '0 24px 60px -16px rgb(var(--overlay) / 0.28), 0 8px 20px -8px rgb(var(--overlay) / 0.16)',
        none: 'none',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)',
        brand: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'skeleton-sweep': {
          '100%': { transform: 'translateX(100%)' },
        },
        'dot-pulse': {
          '0%, 80%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-3px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(3deg)' },
        },
        'float-medium': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(-2deg)' },
        },
        'float-fast': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(4deg)' },
        },
      },
      animation: {
        marquee: 'marquee 42s linear infinite',
        'skeleton-sweep': 'skeleton-sweep 1.6s infinite',
        'dot-pulse': 'dot-pulse 1.2s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'float-medium': 'float-medium 6s ease-in-out infinite',
        'float-fast': 'float-fast 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
