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
        heading: 'var(--heading)',
        fresh: 'var(--fresh)',
        mint: 'var(--mint)',
        signal: 'var(--signal)',
        'muted-fg': 'var(--muted-fg)',
        'surface-soft': 'var(--surface-soft)',
        'risk-low': 'var(--risk-low)',
        'risk-moderate': 'var(--risk-moderate)',
        'risk-high': 'var(--risk-high)',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(23 33 27 / 0.04), 0 4px 16px -4px rgb(23 33 27 / 0.08)',
        lift: '0 2px 4px 0 rgb(23 33 27 / 0.06), 0 12px 32px -8px rgb(23 33 27 / 0.14)',
      },
    },
  },
  plugins: [],
};
