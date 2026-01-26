import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

interface FileUploadProps {
  clientId: string
  workspaceId: string
  projectId?: string
  onUploadComplete?: () => void
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'complete' | 'error'
  error?: string
  id: string // Unique identifier for each upload
}

// Generate unique ID for each upload
function generateUploadId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Blocked file extensions for security
const BLOCKED_EXTENSIONS = [
  // Executables
  '.exe', '.msi', '.dll', '.bat', '.cmd', '.com', '.scr', '.pif',
  // Scripts
  '.js', '.vbs', '.vbe', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.ps1xml', '.ps2', '.ps2xml', '.psc1', '.psc2',
  '.msh', '.msh1', '.msh2', '.mshxml', '.msh1xml', '.msh2xml',
  // Server-side scripts
  '.php', '.php3', '.php4', '.php5', '.phtml', '.asp', '.aspx', '.cgi', '.pl', '.py', '.rb',
  // Java/Flash
  '.jar', '.class', '.swf',
  // Shortcuts and links
  '.lnk', '.url', '.scf',
  // Registry
  '.reg',
  // Shell
  '.sh', '.bash', '.zsh', '.csh', '.tcsh', '.ksh',
  // Macros and documents that can contain macros
  '.docm', '.xlsm', '.pptm', '.dotm', '.xltm', '.potm',
  // Other dangerous
  '.hta', '.inf', '.msp', '.msc', '.gadget', '.application',
]

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Validate file before upload
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  const fileName = file.name.toLowerCase()
  const extension = '.' + fileName.split('.').pop()

  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type "${extension}" is not allowed for security reasons`,
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of 50MB`,
    }
  }

  // Check for double extensions (e.g., file.pdf.exe)
  const parts = fileName.split('.')
  if (parts.length > 2) {
    for (const part of parts.slice(0, -1)) {
      if (BLOCKED_EXTENSIONS.includes('.' + part)) {
        return {
          valid: false,
          error: `Suspicious file name with multiple extensions`,
        }
      }
    }
  }

  return { valid: true }
}

export function FileUpload({ clientId, workspaceId, projectId, onUploadComplete }: FileUploadProps) {
  const { user } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const progressIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      progressIntervalsRef.current.forEach(interval => clearInterval(interval))
      progressIntervalsRef.current.clear()
    }
  }, [])

  // Update progress for a specific file
  const updateFileProgress = useCallback((uploadId: string, progress: number, status?: 'uploading' | 'complete' | 'error', error?: string) => {
    setUploadingFiles(prev =>
      prev.map(uf =>
        uf.id === uploadId
          ? { ...uf, progress, ...(status && { status }), ...(error && { error }) }
          : uf
      )
    )
  }, [])

  // Start simulated progress animation for smoother UX
  const startProgressAnimation = useCallback((uploadId: string, fileSize: number) => {
    // Estimate upload time based on file size (rough estimate)
    // Smaller files: faster progress, larger files: slower progress
    const estimatedDurationMs = Math.min(Math.max(fileSize / 10000, 1000), 30000) // 1-30 seconds
    const updateInterval = 100 // Update every 100ms
    const totalSteps = estimatedDurationMs / updateInterval
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep++
      // Use easing function: fast at start, slower as it approaches 90%
      // We stop at 90% because actual completion happens when upload finishes
      const rawProgress = currentStep / totalSteps
      const easedProgress = 1 - Math.pow(1 - rawProgress, 3) // Cubic ease-out
      const progress = Math.min(Math.round(easedProgress * 85), 85) // Cap at 85%

      updateFileProgress(uploadId, progress)

      if (currentStep >= totalSteps) {
        clearInterval(interval)
        progressIntervalsRef.current.delete(uploadId)
      }
    }, updateInterval)

    progressIntervalsRef.current.set(uploadId, interval)
  }, [updateFileProgress])

  // Stop progress animation
  const stopProgressAnimation = useCallback((uploadId: string) => {
    const interval = progressIntervalsRef.current.get(uploadId)
    if (interval) {
      clearInterval(interval)
      progressIntervalsRef.current.delete(uploadId)
    }
  }, [])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(Array.from(files))
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleFiles(files: File[]) {
    if (!user) {
      toast.error('You must be logged in to upload files')
      return
    }

    // Validate all files first
    const validFiles: File[] = []
    const invalidFiles: { file: File; error: string }[] = []

    for (const file of files) {
      const validation = validateFile(file)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        invalidFiles.push({ file, error: validation.error || 'Invalid file' })
      }
    }

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      for (const { file, error } of invalidFiles) {
        toast.error(`"${file.name}": ${error}`)
      }
    }

    // If no valid files, return early
    if (validFiles.length === 0) {
      return
    }

    setUploading(true)

    // Create upload entries with unique IDs
    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
      id: generateUploadId(),
    }))
    setUploadingFiles(prev => [...prev, ...newUploadingFiles])

    // Start progress animations for all files
    newUploadingFiles.forEach(uf => {
      startProgressAnimation(uf.id, uf.file.size)
    })

    let successCount = 0
    let errorCount = invalidFiles.length // Count invalid files as errors

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const uploadId = newUploadingFiles[i].id

      try {
        // Generate unique file path with robust path traversal prevention
        const timestamp = Date.now()
        // Sanitize filename to prevent path traversal attacks:
        // 1. Get only the base filename (remove any path components)
        // 2. Remove any directory separators and path traversal sequences
        // 3. Replace any remaining unsafe characters
        // 4. Ensure no consecutive dots that could form '..'
        let sanitizedName = file.name
          .split(/[/\\]/).pop() || 'file' // Get basename, remove any path
          .replace(/\.\./g, '_') // Replace any '..' sequences
          .replace(/[/\\:*?"<>|]/g, '_') // Remove path separators and unsafe chars
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Only allow safe characters
          .replace(/\.{2,}/g, '.') // Collapse multiple dots to single dot
          .replace(/^[.-]+/, '') // Remove leading dots/dashes that could be problematic
          .trim()

        // Ensure we have a valid filename
        if (!sanitizedName || sanitizedName.length === 0) {
          sanitizedName = 'file'
        }

        // Limit filename length
        if (sanitizedName.length > 200) {
          const ext = sanitizedName.split('.').pop() || ''
          const name = sanitizedName.substring(0, 200 - ext.length - 1)
          sanitizedName = ext ? `${name}.${ext}` : name
        }

        const storagePath = `${workspaceId}/${clientId}/${timestamp}_${sanitizedName}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('client-files')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        // Storage upload complete - jump to 90%
        stopProgressAnimation(uploadId)
        updateFileProgress(uploadId, 90)

        // Create file record in database
        const { error: dbError } = await supabase
          .from('files')
          .insert({
            client_id: clientId,
            project_id: projectId || null,
            name: file.name,
            storage_path: storagePath,
            mime_type: file.type || 'application/octet-stream',
            size: file.size,
            uploaded_by: user.id,
          })

        if (dbError) {
          // Try to clean up the uploaded file
          await supabase.storage.from('client-files').remove([storagePath])
          throw dbError
        }

        // Mark as complete with 100%
        updateFileProgress(uploadId, 100, 'complete')
        successCount++

      } catch (error) {
        console.error('Error uploading file:', error)
        stopProgressAnimation(uploadId)
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        updateFileProgress(uploadId, 0, 'error', errorMessage)
        errorCount++
      }
    }

    setUploading(false)

    // Show appropriate toast message
    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`)
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} file${successCount > 1 ? 's' : ''} uploaded, ${errorCount} failed`)
    } else if (errorCount > 0) {
      toast.error(`Failed to upload ${errorCount} file${errorCount > 1 ? 's' : ''}`)
    }

    // Clear completed files after a delay
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(uf => uf.status !== 'complete'))
      onUploadComplete?.()
    }, 2500)
  }

  function removeUploadingFile(uploadId: string) {
    stopProgressAnimation(uploadId)
    setUploadingFiles(prev => prev.filter(uf => uf.id !== uploadId))
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <Upload className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-300 mb-2">
          Drag and drop files here, or{' '}
          <label
            htmlFor="file-upload"
            className="text-primary-600 dark:text-primary-400 cursor-pointer hover:underline"
          >
            browse
          </label>
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Upload any file type up to 50MB
        </p>
      </div>

      {/* Uploading files list with progress indicators */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uf) => (
            <div
              key={uf.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                uf.status === 'error'
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : uf.status === 'complete'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {uf.status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              ) : uf.status === 'complete' ? (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {uf.file.name}
                  </p>
                  {uf.status === 'uploading' && (
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400 ml-2">
                      {uf.progress}%
                    </span>
                  )}
                  {uf.status === 'complete' && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 ml-2">
                      Complete
                    </span>
                  )}
                </div>
                {uf.status === 'uploading' && (
                  <div className="mt-1.5 h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-150 ease-out"
                      style={{ width: `${uf.progress}%` }}
                    />
                  </div>
                )}
                {uf.status === 'error' && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{uf.error}</p>
                )}
                {uf.status === 'complete' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    File uploaded successfully
                  </p>
                )}
              </div>
              {(uf.status === 'uploading' || uf.status === 'error') && (
                <button
                  onClick={() => removeUploadingFile(uf.id)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Cancel"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
