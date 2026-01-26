import { useState } from 'react'
import { FileText, Download, Trash2, Calendar, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { File as FileType } from '../../types/database'

interface FileWithUser extends FileType {
  uploader?: {
    full_name: string | null
    email: string
  }
}

interface FileListProps {
  files: FileWithUser[]
  loading: boolean
  onFileDeleted?: () => void
  canEdit?: boolean
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return '📄'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType === 'application/pdf') return '📕'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️'
  return '📄'
}

export function FileList({ files, loading, onFileDeleted, canEdit = true }: FileListProps) {
  const toast = useToast()
  const [deletingFile, setDeletingFile] = useState<FileWithUser | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDownload(file: FileWithUser) {
    try {
      // First verify the user has access to this file through the database
      // This ensures RLS policies are enforced before attempting download
      const { data: fileRecord, error: accessError } = await supabase
        .from('files')
        .select('id, storage_path')
        .eq('id', file.id)
        .single()

      if (accessError || !fileRecord) {
        console.error('Access denied or file not found:', accessError)
        toast.error('Access denied: You do not have permission to download this file')
        return
      }

      // User has database access, proceed with storage download
      // Storage RLS will also verify access independently
      const { data, error } = await supabase.storage
        .from('client-files')
        .download(fileRecord.storage_path)

      if (error) {
        // Handle specific storage errors
        if (error.message?.includes('not authorized') || error.message?.includes('403')) {
          toast.error('Access denied: You do not have permission to download this file')
          return
        }
        throw error
      }

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    }
  }

  async function handleDelete() {
    if (!deletingFile) return

    setDeleting(true)
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('client-files')
        .remove([deletingFile.storage_path])

      if (storageError) {
        console.warn('Storage delete error:', storageError)
        // Continue even if storage delete fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', deletingFile.id)

      if (dbError) throw dbError

      toast.success('File deleted successfully')
      onFileDeleted?.()
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error('Failed to delete file')
    } finally {
      setDeleting(false)
      setIsDeleteDialogOpen(false)
      setDeletingFile(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400">Loading files...</p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No files uploaded yet</p>
        <p className="text-sm mt-2">Upload files to share with your team.</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 -mx-2 rounded transition-colors"
          >
            <div className="text-2xl flex-shrink-0">
              {getFileIcon(file.mime_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">
                {file.name}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span>{formatFileSize(file.size)}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(file.created_at)}
                </span>
                {file.uploader && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {file.uploader.full_name || file.uploader.email}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleDownload(file)}
                className="btn-outline p-2 min-w-[44px] min-h-[44px]"
                title="Download file"
              >
                <Download className="h-4 w-4" />
              </button>
{canEdit && (
                <button
                  onClick={() => {
                    setDeletingFile(file)
                    setIsDeleteDialogOpen(true)
                  }}
                  className="btn-outline p-2 min-w-[44px] min-h-[44px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Delete file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setDeletingFile(null)
        }}
        onConfirm={handleDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${deletingFile?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}
