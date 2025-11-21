import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      // We'll control the manifest manually (client/admin) via index.html
      manifest: false,
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
      },
      includeAssets: ['favicon.ico', 'amauri-logo.png']
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separa bibliotecas grandes em chunks próprios
          if (id.includes('node_modules')) {
            // React e React DOM
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // Supabase
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // Radix UI (componentes UI)
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            // Lucide (ícones)
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // TanStack Query
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // Outras dependências grandes
            return 'vendor-other';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600, // Aumenta um pouco o limite (padrão é 500kb)
  },
}));
