import { defineConfig } from 'vite';

export default defineConfig({
  // 🚨 修正：GitHub Pages 部署路徑，名稱需與你的 Repo 一致
  base: '/tradingview/', 
  build: {
    outDir: 'dist',
  }
});
