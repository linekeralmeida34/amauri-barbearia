// Utility para gerenciar manifests PWA
export class ManifestManager {
  private static instance: ManifestManager;
  private currentManifest: string = '';

  static getInstance(): ManifestManager {
    if (!ManifestManager.instance) {
      ManifestManager.instance = new ManifestManager();
    }
    return ManifestManager.instance;
  }

  async switchToManifest(manifestPath: string): Promise<void> {
    // Only run on client side
    if (typeof window === 'undefined') return;

    if (this.currentManifest === manifestPath) {
      console.log('Manifest already set to:', manifestPath);
      return;
    }

    console.log('Switching manifest to:', manifestPath);

    // Remove all existing manifest links
    const existingLinks = document.querySelectorAll('link[rel="manifest"]');
    existingLinks.forEach(link => link.remove());
    
    // Clear any cached manifests
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes('manifest') || cacheName.includes('pwa')) {
            await caches.delete(cacheName);
            console.log('🧹 Cleared cache:', cacheName);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not clear caches:', error);
      }
    }

    // For admin manifest, use dynamic URL based on environment
    let finalManifestPath = manifestPath;
    if (manifestPath === '/manifest-admin.json') {
      const isProduction = window.location.hostname === 'amauri-barbearia-fawn.vercel.app';
      const baseUrl = isProduction 
        ? 'https://amauri-barbearia-fawn.vercel.app' 
        : window.location.origin;
      
      console.log('🔍 Debug ManifestManager:', {
        hostname: window.location.hostname,
        isProduction,
        baseUrl,
        manifestPath,
        currentUrl: window.location.href
      });
      
      // Create dynamic manifest for admin
      const adminManifest = {
        name: "Amauri Barbearia - Admin",
        short_name: "Amauri Admin",
        description: "Painel administrativo da Amauri Barbearia",
        start_url: `${baseUrl}/#/admin/login`,
        display: "standalone",
        background_color: "#1a1a1a",
        theme_color: "#ffffff",
        orientation: "portrait-primary",
        scope: `${baseUrl}/`,
        icons: [
          {
            src: `${baseUrl}/amauri-logo.png`,
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: `${baseUrl}/amauri-logo.png`,
            sizes: "512x512",
            type: "image/png"
          }
        ],
        categories: ["business", "productivity"],
        lang: "pt-BR"
      };
      
      console.log('📱 Admin Manifest Generated:', adminManifest);
      
      // Create data URL for dynamic manifest
      finalManifestPath = 'data:application/json;base64,' + btoa(JSON.stringify(adminManifest, null, 2));
      console.log('✅ Using dynamic admin manifest with baseUrl:', baseUrl);
    }

    // Create new manifest link
    const newLink = document.createElement('link');
    newLink.rel = 'manifest';
    newLink.href = finalManifestPath;
    newLink.id = 'pwa-manifest';
    document.head.appendChild(newLink);

    // Update current manifest
    this.currentManifest = manifestPath;

    // Force reload by updating href with timestamp (only for file manifests)
    if (!finalManifestPath.startsWith('data:')) {
      setTimeout(() => {
        newLink.href = `${finalManifestPath}?t=${Date.now()}`;
      }, 100);
    }

    console.log('Manifest switched successfully to:', manifestPath);
  }

  getCurrentManifest(): string {
    return this.currentManifest;
  }

  async clearCache(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        console.log('Service Worker cache cleared');
      } catch (error) {
        console.error('Error clearing service worker cache:', error);
      }
    }
  }
}
