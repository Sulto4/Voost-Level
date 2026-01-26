import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-500">404</h1>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mt-4">
          Page not found
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. Please check the URL or go back to the homepage.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => window.history.back()}
            className="btn-outline"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Go Back
          </button>
          <Link to="/dashboard" className="btn-primary">
            <Home className="h-5 w-5 mr-2" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
