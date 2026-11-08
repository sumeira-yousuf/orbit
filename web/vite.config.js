import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// In development the API runs on :3001 and Vite proxies /api to it, so the browser sees one origin
// (same as production on Vercel, where /api is rewritten to the serverless function).
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:3001', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 700 },
});
