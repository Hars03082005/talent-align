import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import { collectFeed } from './worker/feed';
import snapshot from './src/workspace/jobs.snapshot.json';

function employerFeed(): Plugin {
  let inFlight: ReturnType<typeof collectFeed> | undefined;
  let recent: Awaited<ReturnType<typeof collectFeed>> | undefined;
  return {
    name: 'talentalign-employer-feed',
    configureServer(server) {
      server.middlewares.use('/api/workspace/jobs', async (request, response) => {
        const refresh = new URL(request.url ?? '/', 'http://localhost').searchParams.get('refresh') === '1';
        if (refresh || !recent || Date.now() - Date.parse(recent.checked) > 30 * 60 * 1000) {
          inFlight ??= collectFeed().finally(() => { inFlight = undefined; });
          const result = await inFlight;
          if (result.jobs.length) recent = result;
        }
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'private, no-store');
        response.end(JSON.stringify(recent ?? snapshot));
      });
    },
  };
}


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), employerFeed()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
