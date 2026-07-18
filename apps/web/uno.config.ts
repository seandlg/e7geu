import { defineConfig, presetWind3 } from 'unocss';

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    fontFamily: {
      sans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
  },
  shortcuts: {
    'focus-ring':
      'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
    'glass-panel': 'border border-white/12 bg-white/8 shadow-xl shadow-black/15 backdrop-blur-xl',
  },
});
