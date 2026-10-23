import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import './server/env.js';
import { handleApi, startBackgroundWork } from './server/api.js';

// Serve the API (accounts, shared catalogue, reviews, Luna) from the Vite dev/preview server so `npm run dev` just works.
const api = {
  name: 'popcorn-api',
  configureServer(server) {
    server.middlewares.use('/api', handleApi);
    startBackgroundWork();
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api', handleApi);
    startBackgroundWork();
  },
};

export default defineConfig({ plugins: [react(), api] });
