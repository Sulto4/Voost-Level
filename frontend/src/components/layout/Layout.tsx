import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileSidebar } from './MobileSidebar'

export function Layout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // Listen for changes to sidebar collapsed state
  useEffect(() => {
    function handleStorageChange() {
      setIsSidebarCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
    }

    // Use a custom event since storage event doesn't fire in same window
    const interval = setInterval(() => {
      const collapsed = localStorage.getItem('sidebar-collapsed') === 'true'
      if (collapsed !== isSidebarCollapsed) {
        setIsSidebarCollapsed(collapsed)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isSidebarCollapsed])

  // Listen for online/offline events
  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
      // Dispatch custom event so pages can sync data
      window.dispatchEvent(new CustomEvent('app:reconnected'))
      console.log('[Sync] Connection restored - triggering data sync')
    }
    function handleOffline() {
      setIsOffline(true)
      console.log('[Sync] Connection lost - offline mode active')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background-dark">
      {/* Offline Indicator Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            You're offline. Some features may not be available.
          </span>
        </div>
      )}
      {/* Skip to content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />
      <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'} ${isOffline ? 'mt-10' : ''}`}>
        <Header onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main id="main-content" className="p-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
