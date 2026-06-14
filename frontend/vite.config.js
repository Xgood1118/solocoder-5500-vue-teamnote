import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE || 'http://localhost:3001';
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: apiBase.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
    },
  };
});
