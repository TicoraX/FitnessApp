import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El proxy evita CORS en desarrollo: el navegador ve todo en el mismo origen.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3100' },
  },
});
