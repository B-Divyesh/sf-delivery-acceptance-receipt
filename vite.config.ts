import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index: new URL('./index.html', import.meta.url).pathname,
        privacy: new URL('./privacy/index.html', import.meta.url).pathname,
        terms: new URL('./terms/index.html', import.meta.url).pathname
      },
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (asset) => asset.names.some((name) => name.endsWith('.css')) ? 'assets/app.css' : 'assets/[name][extname]'
      }
    }
  }
});
