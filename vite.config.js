import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleLuna } from './server/luna.js';

// Serve the Luna API from the Vite dev/preview server so `npm run dev` just works.
const lunaApi = {
  name: 'luna-api',
  configureServer(server) {
    server.middlewares.use('/api/luna', handleLuna);
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/luna', handleLuna);
  },
};

export default defineConfig({ plugins: [react(), lunaApi] });
