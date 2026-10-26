/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        card: 'var(--card)',
        muted: 'var(--muted)',
        primary: 'var(--primary)',
        'primary-fg': 'var(--primary-fg)',
        border: 'var(--border)',
        'risk-low': 'var(--risk-low)',
        'risk-moderate': 'var(--risk-moderate)',
        'risk-high': 'var(--risk-high)',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
