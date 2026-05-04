import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  build: {
    // Компилируем в один файл без code splitting
    lib: {
      entry: 'src/main.ts',
      name: 'MarkQuizWidget',
      fileName: 'widget',
      formats: ['iife'],  // Immediately Invoked Function Expression — для <script> тегов
    },
    rollupOptions: {
      output: {
        // Встраиваем CSS прямо в JS-файл, чтобы виджет был self-contained
        inlineDynamicImports: true,
      },
    },
    // Минимальный бандл: целевой < 15 КБ gzip
    minify: 'terser',
    target: 'es2018',
  },
})
