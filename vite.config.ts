import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { serviceWorkerSource } from './src/sw-template';

function filesAt(root: string, current = root): string[] {
  return readdirSync(current).flatMap((entry) => {
    const path = join(current, entry);
    return statSync(path).isDirectory() ? filesAt(root, path) : [relative(root, path).replaceAll('\\', '/')];
  });
}

function deliveryServiceWorker(): Plugin {
  return {
    name: 'delivery-service-worker',
    apply: 'build',
    closeBundle() {
      const output = resolve(process.cwd(), 'dist');
      const assets = filesAt(output).filter((file) => file !== 'sw.js').map((file) => `/${file}`);
      const shell = ['/', '/index.html', ...assets.filter((file) => file.startsWith('/assets/') || file.startsWith('/icons/') || file === '/manifest.webmanifest' || file === '/offline.html' || file === '/demo/index.html')];
      writeFileSync(join(output, 'sw.js'), serviceWorkerSource('delivery-receipt-v1.1.0', [...new Set(shell)]));
    }
  };
}

export default defineConfig({
  plugins: [deliveryServiceWorker()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        index: new URL('./index.html', import.meta.url).pathname,
        demo: new URL('./demo/index.html', import.meta.url).pathname,
        privacy: new URL('./privacy/index.html', import.meta.url).pathname,
        terms: new URL('./terms/index.html', import.meta.url).pathname,
        notFound: new URL('./404.html', import.meta.url).pathname
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
