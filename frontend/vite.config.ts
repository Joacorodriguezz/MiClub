import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Configuración base de Vite.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
