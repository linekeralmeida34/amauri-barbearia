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
  // Mantemos a configuração padrão de chunks do Vite.
  // Se os avisos de bundle grande voltarem a incomodar, podemos
  // revisitar uma estratégia de divisão mais simples e bem testada.
  build: {
    chunkSizeWarningLimit: 600, // Aumenta um pouco o limite (padrão é 500kb)
  },
}));
