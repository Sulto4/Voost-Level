import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Check } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  className = '',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Ensure selected is always an array
  const selectedArray = selected || []

  function toggleOption(value: string) {
    if (selectedArray.includes(value)) {
      onChange(selectedArray.filter(v => v !== value))
    } else {
      onChange([...selectedArray, value])
    }
  }

  function removeOption(e: React.MouseEvent, value: string) {
    e.stopPropagation()
    onChange(selectedArray.filter(v => v !== value))
  }

  const selectedLabels = selectedArray.map(
    value => options.find(opt => opt.value === value)?.label || value
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full min-h-[44px] px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-left flex items-center justify-between gap-2 transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
        } ${isOpen ? 'ring-2 ring-primary-500 border-transparent' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex-1 flex flex-wrap gap-1.5">
          {selectedArray.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          ) : (
            selectedLabels.map((label, index) => (
              <span
                key={selectedArray[index]}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-sm"
              >
                {label}
                <button
                  type="button"
                  onClick={(e) => removeOption(e, selectedArray[index])}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                  aria-label={`Remove ${label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 text-slate-400 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              No options available
            </div>
          ) : (
            <div role="listbox" aria-multiselectable="true">
              {options.map(option => {
                const isSelected = selectedArray.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                      isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
