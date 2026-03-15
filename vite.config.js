import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: '/f-888',
  server: {
    proxy: {
      '/api-market': {
        target: 'https://baiyefundwork.preview.aliyun-zeabur.cn',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api-market/, '/api')
      },
      '/api-rank': {
        target: 'https://fund.eastmoney.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api-rank/, ''),
        headers: { Referer: 'https://fund.eastmoney.com/data/fundranking.html' }
      },
      '/api-nav': {
        target: 'https://fund.eastmoney.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api-nav/, ''),
        headers: { Referer: 'https://fund.eastmoney.com/fund.html' }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'echarts': ['echarts'],
          'supabase': ['@supabase/supabase-js'],
        }
      }
    }
  }
})
