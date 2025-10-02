import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useManifestForRoute = () => {
  const location = useLocation();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const isAdminRoute = location.pathname === '/admin/login' || 
                        location.hash === '#/admin/login' ||
                        window.location.href.includes('/admin/login');

    console.log('🔍 useManifestForRoute check:', {
      pathname: location.pathname,
      hash: location.hash,
      href: window.location.href,
      isAdminRoute
    });

    // Clear existing manifests
    const allManifests = document.querySelectorAll('link[rel="manifest"]');
    allManifests.forEach(link => link.remove());

    if (isAdminRoute) {
      // Set admin manifest
      const adminManifest = {
        name: "Amauri Barbearia - Admin",
        short_name: "Amauri Admin",
        description: "Painel administrativo da Amauri Barbearia",
        start_url: `${window.location.origin}/#/admin/login`,
        display: "standalone",
        background_color: "#1a1a1a",
        theme_color: "#ffffff",
        orientation: "portrait-primary",
        scope: `${window.location.origin}/`,
        icons: [
          {
            src: `${window.location.origin}/amauri-logo.png`,
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: `${window.location.origin}/amauri-logo.png`,
            sizes: "512x512",
            type: "image/png"
          }
        ],
        categories: ["business", "productivity"],
        lang: "pt-BR"
      };

      // Create data URL
      const dataUrl = 'data:application/json;base64,' + btoa(JSON.stringify(adminManifest, null, 2));
      
      // Add manifest
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = dataUrl;
      link.id = 'pwa-manifest';
      document.head.appendChild(link);

      console.log('✅ Admin manifest set:', adminManifest);
    } else {
      // Set client manifest
      const clientManifest = {
        name: "Amauri Barbearia - Cliente",
        short_name: "Amauri Cliente",
        description: "Agende seu horário na Amauri Barbearia",
        start_url: `${window.location.origin}/#/`,
        display: "standalone",
        background_color: "#1a1a1a",
        theme_color: "#ffffff",
        orientation: "portrait-primary",
        scope: `${window.location.origin}/`,
        icons: [
          {
            src: `${window.location.origin}/amauri-logo.png`,
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: `${window.location.origin}/amauri-logo.png`,
            sizes: "512x512",
            type: "image/png"
          }
        ],
        categories: ["lifestyle", "business"],
        lang: "pt-BR"
      };

      // Create data URL
      const dataUrl = 'data:application/json;base64,' + btoa(JSON.stringify(clientManifest, null, 2));
      
      // Add manifest
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = dataUrl;
      link.id = 'pwa-manifest';
      document.head.appendChild(link);

      console.log('✅ Client manifest set:', clientManifest);
    }
  }, [location]);
};
