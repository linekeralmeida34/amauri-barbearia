import { useState, useEffect } from 'react';

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
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

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

  // Manifest switching is now handled by useManifestForRoute hook

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
