import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import './server/env.js';
import { handleLuna } from './server/luna.js';
import { handleOmdb } from './server/omdb.js';

// Serve the API routes (Luna, OMDb) from the Vite dev/preview server so `npm run dev` just works.
const api = {
  name: 'popcorn-api',
  configureServer(server) {
    server.middlewares.use('/api/luna', handleLuna);
    server.middlewares.use('/api/omdb', handleOmdb);
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/luna', handleLuna);
    server.middlewares.use('/api/omdb', handleOmdb);
  },
};

export default defineConfig({ plugins: [react(), api] });
