import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  install: () => Promise<void>;
  showIOSInstructions: boolean;
  setShowIOSInstructions: (show: boolean) => void;
}

export const usePWAInstall = (): PWAInstallState => {
  const location = useLocation();
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('appinstalled event fired');
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    // For testing - always allow install on non-iOS devices
    if (!iOS) {
      setTimeout(() => {
        console.log('Setting installable to true for testing');
        setIsInstallable(true);
      }, 1000);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Force manifest update when route changes - but don't interfere with ManifestManager
  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/admin') || 
                        location.pathname.includes('admin') ||
                        location.hash.includes('admin');
    
    console.log('🔄 Route changed, isAdminRoute:', isAdminRoute, 'pathname:', location.pathname, 'hash:', location.hash);
    
    // Only update if ManifestManager hasn't already set a data URL
    const manifestLink = document.getElementById('pwa-manifest') as HTMLLinkElement;
    if (manifestLink && !manifestLink.href.startsWith('data:')) {
      const manifestPath = isAdminRoute ? '/manifest-admin.json' : '/manifest-client.json';
      
      if (manifestLink.href !== `${window.location.origin}${manifestPath}`) {
        console.log('📋 Updating manifest to:', manifestPath);
        manifestLink.href = manifestPath;
        
        // Force reload the manifest
        const newLink = document.createElement('link');
        newLink.rel = 'manifest';
        newLink.href = manifestPath;
        newLink.id = 'pwa-manifest';
        
        const oldLink = document.getElementById('pwa-manifest');
        if (oldLink) {
          document.head.removeChild(oldLink);
        }
        document.head.appendChild(newLink);
      }
    } else {
      console.log('📋 Manifest already managed by ManifestManager (data URL)');
    }
  }, [location.pathname, location.hash]);

  const install = async () => {
    console.log('Install function called', { installPrompt: !!installPrompt, isIOS, isInstallable });
    
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choiceResult = await installPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          setIsInstallable(false);
          setInstallPrompt(null);
        }
      } catch (error) {
        console.error('Error during install prompt:', error);
      }
    } else if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      // Fallback: show instructions for any device
      console.log('No install prompt available, showing instructions');
      setShowIOSInstructions(true);
    }
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    installPrompt,
    install,
    showIOSInstructions,
    setShowIOSInstructions,
  };
};
