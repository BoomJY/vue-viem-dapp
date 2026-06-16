import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置。
// 说明:使用 node:url 的 fileURLToPath 配合 import.meta.url 计算 @ 别名,
// 这样无需依赖 @types/node 的 __dirname / process 也能拿到绝对路径。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
})
