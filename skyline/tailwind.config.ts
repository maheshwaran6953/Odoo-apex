import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { paper: '#F7F4EE', ink: '#172033', coral: '#F45B4A', mist: '#E9E4DA', sage: '#B7C8B0' }, fontFamily: { sans: ['var(--font-geist)', 'ui-sans-serif'] } } },
  plugins: [],
};
export default config;
