import { defineConfig } from 'vite';
import path from 'node:path';
import { builtinModules } from 'node:module';

// Vite config for Electron main process bundling
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-electron',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'main.ts'),
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      // Externalize Electron and all Node built-ins (including both 'assert' and 'node:assert')
      external: [
        'electron',
        'electron-log',
        'electron-log/main',
        'electron-log/renderer',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'node22',
    minify: false,
  },
});
