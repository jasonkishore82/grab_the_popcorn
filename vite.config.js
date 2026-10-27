import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API is the Python (FastAPI) server in backend/. Start it with `npm run api`; Vite forwards /api to it.
const API = process.env.API_URL || 'http://127.0.0.1:47123';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': API } },
  preview: { proxy: { '/api': API } },
});
