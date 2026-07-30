import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El proxy evita CORS en desarrollo: el navegador ve todo en el mismo origen.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    proxy: { '/api': 'http://localhost:3100' },
  },
  preview: {
    port: 5177,
    proxy: { '/api': 'http://localhost:3100' },
  },
});
