import { defineConfig } from 'vite';
import path from 'node:path';

// Vite config for Electron main process bundling
export default defineConfig({
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
      external: [
        'electron',
        'electron-log',
        'electron-log/main',
        'electron-log/renderer',
        // keep node built-ins external
        'path',
        'fs',
        'url',
        'os',
        'child_process',
        'stream',
        'events',
        'util',
        'buffer',
        'http',
        'https',
        'zlib',
        'process',
        'node:process',
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
