import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { evalResultsPlugin } from './scripts/vite-plugin-eval-results.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), evalResultsPlugin()],
});
