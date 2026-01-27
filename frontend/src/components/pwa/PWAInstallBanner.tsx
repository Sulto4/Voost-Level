import { X, Download, Share, Plus } from 'lucide-react';
import { usePWA } from '../../context/PWAContext';

export function PWAInstallBanner() {
  const { showInstallBanner, isIOS, promptInstall, dismissInstallPrompt } = usePWA();

  if (!showInstallBanner) {
    return null;
  }

  const handleInstall = async () => {
    if (isIOS) {
      // iOS doesn't support programmatic install, show instructions
      return;
    }
    await promptInstall();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg animate-slide-up">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Install Voost Level</h3>
            {isIOS ? (
              <p className="text-sm text-white/90">
                Tap <Share className="inline w-4 h-4 mx-1" /> then "Add to Home Screen" <Plus className="inline w-4 h-4 mx-1" />
              </p>
            ) : (
              <p className="text-sm text-white/90">
                Get quick access from your home screen
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-white/90 transition-colors"
            >
              Install
            </button>
          )}
          <button
            onClick={dismissInstallPrompt}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Dismiss install banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Settings page install section component
export function PWAInstallSection() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWA();

  if (isInstalled) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
            <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-medium text-green-800 dark:text-green-200">App Installed</h3>
            <p className="text-sm text-green-600 dark:text-green-400">
              Voost Level is installed on your device
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInstallable) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <Download className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Install App</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Use a supported browser (Chrome, Edge, Safari) to install
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-800 rounded-full flex items-center justify-center">
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-medium text-indigo-800 dark:text-indigo-200">Install App</h3>
            {isIOS ? (
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                Tap <Share className="inline w-4 h-4 mx-1" /> then "Add to Home Screen"
              </p>
            ) : (
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                Install Voost Level for quick access
              </p>
            )}
          </div>
        </div>
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
