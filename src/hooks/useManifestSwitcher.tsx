import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useManifestSwitcher = () => {
  const location = useLocation();

  useEffect(() => {
    // Aguarda um pouco para não interferir com a instalação PWA
    const timeoutId = setTimeout(() => {
      const manifestLink = document.getElementById('pwa-manifest') as HTMLLinkElement;
      
      if (!manifestLink) {
        console.warn('Manifest link not found');
        return;
      }

      // Determina qual manifest usar baseado na rota
      const isAdminRoute = location.pathname.startsWith('/admin') || 
                          location.pathname.includes('admin') ||
                          location.hash.includes('admin');

      const manifestPath = isAdminRoute ? '/manifest-admin.json' : '/manifest-client.json';
      
      console.log('Manifest Switcher:', {
        pathname: location.pathname,
        hash: location.hash,
        isAdminRoute,
        manifestPath
      });
      
      // Só atualiza se for diferente do atual
      if (manifestLink.href !== `${window.location.origin}${manifestPath}`) {
        console.log('Switching manifest from', manifestLink.href, 'to', manifestPath);
        
        // Força o navegador a recarregar o manifest
        const newLink = document.createElement('link');
        newLink.rel = 'manifest';
        newLink.href = manifestPath;
        newLink.id = 'pwa-manifest';
        
        // Remove o antigo e adiciona o novo
        const oldLink = document.getElementById('pwa-manifest');
        if (oldLink) {
          document.head.removeChild(oldLink);
        }
        document.head.appendChild(newLink);
        
        console.log('Manifest switched successfully');
      } else {
        console.log('Manifest already correct:', manifestPath);
      }
    }, 1000); // Aguarda 1 segundo para não interferir com a instalação

    return () => clearTimeout(timeoutId);
  }, [location.pathname, location.hash]);
};
