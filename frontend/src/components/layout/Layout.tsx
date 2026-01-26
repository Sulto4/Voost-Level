import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileSidebar } from './MobileSidebar'

export function Layout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background-dark">
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
      <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <Header onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main id="main-content" className="p-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
