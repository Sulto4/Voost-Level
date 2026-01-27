import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => Promise<boolean>;
  dismissInstallPrompt: () => void;
  showInstallBanner: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function PWAProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if running on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  // Check if app is installed (running in standalone mode)
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true
        || document.referrer.includes('android-app://');
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Listen for changes in display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);

    return () => mediaQuery.removeEventListener('change', checkInstalled);
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Store the event for later use
      setInstallPrompt(e as BeforeInstallPromptEvent);

      // Check if user has previously dismissed the banner
      const dismissedTime = localStorage.getItem('pwa-install-dismissed');
      if (dismissedTime) {
        const dismissedDate = new Date(parseInt(dismissedTime));
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        // Show banner again after 7 days
        if (daysSinceDismissed < 7) {
          setDismissed(true);
        }
      }

      // Show the banner if not dismissed
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App was installed');
      setIsInstalled(true);
      setShowInstallBanner(false);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [dismissed]);

  const promptInstall = async (): Promise<boolean> => {
    if (!installPrompt) {
      console.log('[PWA] Install prompt not available');
      return false;
    }

    try {
      // Show the install prompt
      await installPrompt.prompt();

      // Wait for the user's choice
      const choiceResult = await installPrompt.userChoice;
      console.log('[PWA] User choice:', choiceResult.outcome);

      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        setShowInstallBanner(false);
        return true;
      } else {
        console.log('[PWA] User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Error prompting install:', error);
      return false;
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const value: PWAContextType = {
    isInstallable: !!installPrompt || isIOS,
    isInstalled,
    isIOS,
    installPrompt,
    promptInstall,
    dismissInstallPrompt,
    showInstallBanner: showInstallBanner && !isInstalled && !dismissed,
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}
