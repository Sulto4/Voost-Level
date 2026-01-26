import { useState, useEffect, useCallback, useRef } from 'react'

interface UseFormDraftOptions<T> {
  /** Unique key for storing the draft in localStorage */
  storageKey: string
  /** Initial form data */
  initialData: T
  /** Debounce delay in milliseconds (default: 1000) */
  debounceMs?: number
  /** Whether draft saving is enabled (default: true) */
  enabled?: boolean
}

interface UseFormDraftReturn<T> {
  /** Current form data */
  data: T
  /** Update form data (will trigger auto-save) */
  setData: (data: T | ((prev: T) => T)) => void
  /** Whether there was a restored draft */
  hasDraft: boolean
  /** Clear the saved draft */
  clearDraft: () => void
  /** Dismiss the draft notification without clearing */
  dismissDraftNotice: () => void
  /** Reset to initial data and clear draft */
  resetForm: () => void
  /** Whether auto-save just occurred (for UI feedback) */
  justSaved: boolean
  /** Last saved timestamp */
  lastSaved: Date | null
}

/**
 * Hook for auto-saving form drafts to localStorage
 *
 * @example
 * const { data, setData, hasDraft, clearDraft, resetForm } = useFormDraft({
 *   storageKey: 'add-client-draft',
 *   initialData: { name: '', email: '' },
 * })
 */
export function useFormDraft<T extends Record<string, unknown>>({
  storageKey,
  initialData,
  debounceMs = 1000,
  enabled = true,
}: UseFormDraftOptions<T>): UseFormDraftReturn<T> {
  const [data, setDataInternal] = useState<T>(initialData)
  const [hasDraft, setHasDraft] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevEnabledRef = useRef(false)

  // Full storage key with prefix
  const fullStorageKey = `voost-draft-${storageKey}`

  // Check if data is empty (all values are empty strings, null, undefined, or empty arrays)
  const isDataEmpty = useCallback((formData: T): boolean => {
    return Object.entries(formData).every(([, value]) => {
      if (value === null || value === undefined || value === '') return true
      if (Array.isArray(value) && value.length === 0) return true
      if (typeof value === 'object' && Object.keys(value).length === 0) return true
      return false
    })
  }, [])

  // Load draft from localStorage when enabled changes from false to true (modal opens)
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current
    prevEnabledRef.current = enabled

    // Only load draft when transitioning from disabled to enabled
    if (!enabled || wasEnabled) return

    try {
      const savedDraft = localStorage.getItem(fullStorageKey)
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft)
        if (parsed.data && !isDataEmpty(parsed.data)) {
          setDataInternal(parsed.data)
          setHasDraft(true)
          if (parsed.savedAt) {
            setLastSaved(new Date(parsed.savedAt))
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load form draft:', error)
      // Clear corrupted draft
      localStorage.removeItem(fullStorageKey)
    }
  }, [fullStorageKey, enabled, isDataEmpty])

  // Save draft to localStorage (debounced)
  const saveDraft = useCallback((formData: T) => {
    if (!enabled) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      try {
        // Don't save empty forms
        if (isDataEmpty(formData)) {
          localStorage.removeItem(fullStorageKey)
          setLastSaved(null)
          return
        }

        const draftData = {
          data: formData,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(fullStorageKey, JSON.stringify(draftData))
        setLastSaved(new Date())

        // Show "just saved" indicator briefly
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2000)
      } catch (error) {
        console.warn('Failed to save form draft:', error)
      }
    }, debounceMs)
  }, [fullStorageKey, debounceMs, enabled, isDataEmpty])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Wrapper for setData that triggers auto-save
  const setData = useCallback((dataOrUpdater: T | ((prev: T) => T)) => {
    setDataInternal(prev => {
      const newData = typeof dataOrUpdater === 'function'
        ? (dataOrUpdater as (prev: T) => T)(prev)
        : dataOrUpdater
      saveDraft(newData)
      return newData
    })
  }, [saveDraft])

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    localStorage.removeItem(fullStorageKey)
    setHasDraft(false)
    setLastSaved(null)
  }, [fullStorageKey])

  // Dismiss draft notice without clearing data
  const dismissDraftNotice = useCallback(() => {
    setHasDraft(false)
  }, [])

  // Reset form to initial data and clear draft
  const resetForm = useCallback(() => {
    setDataInternal(initialData)
    clearDraft()
  }, [initialData, clearDraft])

  return {
    data,
    setData,
    hasDraft,
    clearDraft,
    dismissDraftNotice,
    resetForm,
    justSaved,
    lastSaved,
  }
}
