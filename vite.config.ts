import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './'：产物引用改为相对路径。
// 同时兼容 Vercel（根域部署）与 GitHub Pages（/仓库名/ 子路径部署），
// 不再因绝对 /assets 路径在子路径下 404 导致白屏。
// 如需显式指定（如 Pages 仓库名不匹配），可构建时传 BASE_PATH=/repo/。
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
