import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Allow overriding proxy target without rebuilding the app.
  // Examples:
  // - VITE_PROXY_TARGET=http://127.0.0.1:8000
  // - VITE_PROXY_TARGET=http://127.0.0.1:8002
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';

  return {
    // Electron loads the built app from file://, so assets must use relative paths.
    base: mode === 'production' ? './' : '/',
    plugins: [react()],
    server: {
      // Port can still be overridden by CLI/env.
      port: 3000,
      proxy: {
        // Frontend uses baseURL "/api" by default.
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
