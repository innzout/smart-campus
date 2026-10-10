import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, open: false },
  optimizeDeps: {
    // Recharts and motion ship hundreds of small ES modules. Left to itself the
    // dev server transforms and serves them individually the first time a
    // charting route is opened, which is seconds of delay on a modest machine.
    // Pre-bundling them makes that first navigation as quick as the rest.
    include: ['recharts', 'motion/react', 'lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the charting library in its own chunk rather than letting it
        // get hoisted into whichever route happens to import it first.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('hookform')) {
            return 'forms';
          }
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/')) {
            return 'react';
          }
          return 'vendor';
        },
      },
    },
  },
});
