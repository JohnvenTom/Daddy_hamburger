import { defineConfig } from 'vite';

/**
 * Vite 配置：3D 汉堡店游戏
 * @returns {object} Vite 配置对象
 */
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false
  },
  build: {
    target: 'es2018',
    chunkSizeWarningLimit: 1500
  }
});
