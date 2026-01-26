import { useState, useRef, useCallback, useEffect } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link, Undo, Redo, AtSign } from 'lucide-react'

export interface TeamMember {
  id: string
  name: string
  email?: string
  avatar?: string
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minHeight?: string
  teamMembers?: TeamMember[]
  onMention?: (member: TeamMember) => void
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter text...',
  disabled = false,
  className = '',
  minHeight = '120px',
  teamMembers = [],
  onMention,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedSelectionRef = useRef<{ node: Node; offset: number } | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)

  // Filter team members based on query
  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    (member.email && member.email.toLowerCase().includes(mentionQuery.toLowerCase()))
  ).slice(0, 5)

  // Execute formatting command
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    // Update parent with new content
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
    // Keep focus on editor
    editorRef.current?.focus()
  }, [onChange])

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)

      // Check for @ mentions
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const text = range.startContainer.textContent || ''
        const cursorPos = range.startOffset

        // Find @ symbol before cursor
        const textBeforeCursor = text.substring(0, cursorPos)
        const atIndex = textBeforeCursor.lastIndexOf('@')

        if (atIndex !== -1) {
          const query = textBeforeCursor.substring(atIndex + 1)
          // Only show if no space after @ (still typing the mention)
          if (!query.includes(' ') && teamMembers.length > 0) {
            setMentionQuery(query)
            setShowMentions(true)
            setSelectedMentionIndex(0)

            // Calculate position for dropdown
            const rect = range.getBoundingClientRect()
            const editorRect = editorRef.current?.getBoundingClientRect()
            if (editorRect) {
              setMentionPosition({
                top: rect.bottom - editorRect.top + 4,
                left: rect.left - editorRect.left,
              })
            }
            // Save selection for later restoration when clicking dropdown
            savedSelectionRef.current = {
              node: range.startContainer,
              offset: range.startOffset,
            }
            return
          }
        }
      }
      setShowMentions(false)
    }
  }, [onChange, teamMembers])

  // Handle paste - strip formatting from pasted text (optional, can be adjusted)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Allow rich text paste - don't prevent default
    // If you want plain text only, uncomment below:
    // e.preventDefault()
    // const text = e.clipboardData.getData('text/plain')
    // document.execCommand('insertText', false, text)
  }, [])

  // Insert mention
  const insertMention = useCallback((member: TeamMember) => {
    if (!editorRef.current || !savedSelectionRef.current) {
      setShowMentions(false)
      setMentionQuery('')
      return
    }

    // Restore focus to editor
    editorRef.current.focus()

    // Get saved selection info
    const { node, offset } = savedSelectionRef.current
    const text = node.textContent || ''

    // Find @ symbol before saved cursor position
    const textBeforeCursor = text.substring(0, offset)
    const atIndex = textBeforeCursor.lastIndexOf('@')

    if (atIndex !== -1) {
      // Create a range for the @query text
      const range = document.createRange()
      range.setStart(node, atIndex)
      range.setEnd(node, offset)
      range.deleteContents()

      // Insert mention span
      const mentionSpan = document.createElement('span')
      mentionSpan.className = 'mention inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-sm font-medium'
      mentionSpan.contentEditable = 'false'
      mentionSpan.dataset.memberId = member.id
      mentionSpan.dataset.memberName = member.name
      mentionSpan.textContent = `@${member.name}`

      range.insertNode(mentionSpan)

      // Add a space after the mention and move cursor there
      const space = document.createTextNode('\u00A0')
      mentionSpan.after(space)

      // Move cursor after the space
      const selection = window.getSelection()
      if (selection) {
        range.setStartAfter(space)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      // Update parent with new content
      onChange(editorRef.current.innerHTML)

      // Call onMention callback
      onMention?.(member)
    }

    setShowMentions(false)
    setMentionQuery('')
    savedSelectionRef.current = null
  }, [onChange, onMention])

  // Handle keyboard navigation in mentions dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex(prev =>
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex(prev =>
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        )
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredMembers[selectedMentionIndex])
      } else if (e.key === 'Escape') {
        setShowMentions(false)
      }
    }
  }, [showMentions, filteredMembers, selectedMentionIndex, insertMention])

  // Handle link insertion
  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:')
    if (url) {
      execCommand('createLink', url)
    }
  }, [execCommand])

  // Handle @ button click
  const insertAtSymbol = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus()
      document.execCommand('insertText', false, '@')
      handleInput()
    }
  }, [handleInput])

  // Close mentions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
        setShowMentions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Toolbar button component
  const ToolbarButton = ({
    icon: Icon,
    command,
    title,
    onClick,
  }: {
    icon: React.ElementType
    command?: string
    title: string
    onClick?: () => void
  }) => (
    <button
      type="button"
      onClick={() => onClick ? onClick() : command && execCommand(command)}
      disabled={disabled}
      className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      title={title}
      aria-label={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  )

  return (
    <div className={`relative border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden ${
      isFocused ? 'ring-2 ring-primary-500 border-transparent' : ''
    } ${disabled ? 'opacity-50' : ''} ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <ToolbarButton icon={Bold} command="bold" title="Bold (Ctrl+B)" />
        <ToolbarButton icon={Italic} command="italic" title="Italic (Ctrl+I)" />
        <ToolbarButton icon={Underline} command="underline" title="Underline (Ctrl+U)" />

        <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

        <ToolbarButton icon={List} command="insertUnorderedList" title="Bullet List" />
        <ToolbarButton icon={ListOrdered} command="insertOrderedList" title="Numbered List" />

        <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

        <ToolbarButton icon={Link} title="Insert Link" onClick={insertLink} />

        {teamMembers.length > 0 && (
          <>
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />
            <ToolbarButton icon={AtSign} title="Mention team member (@)" onClick={insertAtSymbol} />
          </>
        )}

        <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

        <ToolbarButton icon={Undo} command="undo" title="Undo (Ctrl+Z)" />
        <ToolbarButton icon={Redo} command="redo" title="Redo (Ctrl+Y)" />
      </div>

      {/* Editable content area */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none overflow-auto prose prose-sm dark:prose-invert max-w-none [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_a]:text-primary-600 [&_a]:dark:text-primary-400 [&_.mention]:inline-flex [&_.mention]:items-center [&_.mention]:px-1.5 [&_.mention]:py-0.5 [&_.mention]:mx-0.5 [&_.mention]:bg-primary-100 [&_.mention]:dark:bg-primary-900/30 [&_.mention]:text-primary-700 [&_.mention]:dark:text-primary-300 [&_.mention]:rounded [&_.mention]:text-sm [&_.mention]:font-medium`}
        style={{ minHeight }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Mentions dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div
          className="absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto"
          style={{ top: mentionPosition.top, left: mentionPosition.left, minWidth: '200px' }}
        >
          {filteredMembers.map((member, index) => (
            <button
              key={member.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
              onClick={() => insertMention(member)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                index === selectedMentionIndex ? 'bg-slate-100 dark:bg-slate-700' : ''
              }`}
            >
              {member.avatar ? (
                <img src={member.avatar} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-300">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {member.name}
                </div>
                {member.email && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {member.email}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Placeholder styling */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

// Helper to strip HTML tags for plain text preview
export function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

// Helper to check if content has any formatting
export function hasFormatting(html: string): boolean {
  return /<[^>]+>/.test(html)
}

// Helper to extract mentions from HTML content
export function extractMentions(html: string): { id: string; name: string }[] {
  const mentions: { id: string; name: string }[] = []
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const mentionElements = tmp.querySelectorAll('.mention')
  mentionElements.forEach(el => {
    const id = el.getAttribute('data-member-id')
    const name = el.getAttribute('data-member-name')
    if (id && name) {
      mentions.push({ id, name })
    }
  })
  return mentions
}
