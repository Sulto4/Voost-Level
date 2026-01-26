import { useState, useEffect, DragEvent } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import type { PipelineStage } from '../../types/database'

interface EditStagesModalProps {
  isOpen: boolean
  onClose: () => void
  onStagesUpdated?: () => void
}

interface StageFormData {
  id?: string
  name: string
  color: string
  position: number
  isNew?: boolean
  isDeleted?: boolean
}

const colorOptions = [
  { value: '#6366F1', label: 'Indigo' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#22C55E', label: 'Green' },
  { value: '#EF4444', label: 'Red' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#F97316', label: 'Orange' },
]

export function EditStagesModal({ isOpen, onClose, onStagesUpdated }: EditStagesModalProps) {
  const { currentWorkspace } = useWorkspace()
  const [stages, setStages] = useState<StageFormData[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Fetch existing stages when modal opens
  useEffect(() => {
    if (isOpen && currentWorkspace) {
      fetchStages()
    }
  }, [isOpen, currentWorkspace])

  async function fetchStages() {
    if (!currentWorkspace) return

    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('position', { ascending: true })

    if (fetchError) {
      setError('Failed to load stages')
      console.error('Error fetching stages:', fetchError)
    } else if (data && data.length > 0) {
      setStages(data.map(stage => ({
        id: stage.id,
        name: stage.name,
        color: stage.color || '#6366F1',
        position: stage.position,
      })))
    } else {
      // Initialize with default stages if none exist
      setStages([
        { name: 'Lead', color: '#6366F1', position: 0, isNew: true },
        { name: 'Contacted', color: '#F59E0B', position: 1, isNew: true },
        { name: 'Proposal', color: '#10B981', position: 2, isNew: true },
        { name: 'Negotiation', color: '#8B5CF6', position: 3, isNew: true },
        { name: 'Won', color: '#22C55E', position: 4, isNew: true },
        { name: 'Lost', color: '#EF4444', position: 5, isNew: true },
      ])
    }

    setLoading(false)
  }

  function addStage() {
    const maxPosition = stages.length > 0
      ? Math.max(...stages.filter(s => !s.isDeleted).map(s => s.position))
      : -1

    setStages([...stages, {
      name: '',
      color: colorOptions[stages.length % colorOptions.length].value,
      position: maxPosition + 1,
      isNew: true,
    }])
  }

  function updateStage(index: number, field: keyof StageFormData, value: string | number) {
    const updated = [...stages]
    updated[index] = { ...updated[index], [field]: value }
    setStages(updated)
  }

  function deleteStage(index: number) {
    const updated = [...stages]
    if (updated[index].id) {
      // Mark existing stage as deleted
      updated[index] = { ...updated[index], isDeleted: true }
    } else {
      // Remove new stage entirely
      updated.splice(index, 1)
    }
    setStages(updated)
  }

  // Drag and drop handlers for reordering
  function handleDragStart(e: DragEvent<HTMLDivElement>, index: number) {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragEnd() {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  function handleDragLeave() {
    setDragOverIndex(null)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, dropIndex: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // Get active stages only (excluding deleted)
    const activeStages = stages.filter(s => !s.isDeleted)
    const deletedStages = stages.filter(s => s.isDeleted)

    // Reorder active stages
    const newActiveStages = [...activeStages]
    const [draggedStage] = newActiveStages.splice(draggedIndex, 1)
    newActiveStages.splice(dropIndex, 0, draggedStage)

    // Update positions based on new order
    const reorderedStages = newActiveStages.map((stage, idx) => ({
      ...stage,
      position: idx,
    }))

    // Combine with deleted stages
    setStages([...reorderedStages, ...deletedStages])
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  async function handleSave() {
    if (!currentWorkspace) return

    // Validate stages
    const activeStages = stages.filter(s => !s.isDeleted)
    for (const stage of activeStages) {
      if (!stage.name.trim()) {
        setError('All stages must have a name')
        return
      }
    }

    setSaving(true)
    setError('')

    try {
      // Delete marked stages
      const toDelete = stages.filter(s => s.isDeleted && s.id)
      for (const stage of toDelete) {
        const { error: deleteError } = await supabase
          .from('pipeline_stages')
          .delete()
          .eq('id', stage.id)

        if (deleteError) {
          throw new Error(`Failed to delete stage: ${deleteError.message}`)
        }
      }

      // Update existing stages
      const toUpdate = activeStages.filter(s => s.id && !s.isNew)
      for (const stage of toUpdate) {
        const { error: updateError } = await supabase
          .from('pipeline_stages')
          .update({
            name: stage.name.trim(),
            color: stage.color,
            position: stage.position,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stage.id)

        if (updateError) {
          throw new Error(`Failed to update stage: ${updateError.message}`)
        }
      }

      // Create new stages
      const toCreate = activeStages.filter(s => s.isNew)
      if (toCreate.length > 0) {
        const { error: createError } = await supabase
          .from('pipeline_stages')
          .insert(toCreate.map(stage => ({
            workspace_id: currentWorkspace.id,
            name: stage.name.trim(),
            color: stage.color,
            position: stage.position,
          })))

        if (createError) {
          throw new Error(`Failed to create stages: ${createError.message}`)
        }
      }

      onStagesUpdated?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stages')
    } finally {
      setSaving(false)
    }
  }

  const activeStages = stages.filter(s => !s.isDeleted)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Pipeline Stages" size="lg">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Customize your pipeline stages. Drag to reorder or click the trash icon to remove.
            </p>

            <div className="space-y-2">
              {activeStages.map((stage, index) => {
                const realIndex = stages.findIndex(s => s === stage)
                return (
                  <div
                    key={stage.id || `new-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg transition-all ${
                      draggedIndex === index ? 'opacity-50 scale-95' : ''
                    } ${
                      dragOverIndex === index ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <GripVertical className="h-5 w-5 text-slate-400 cursor-grab active:cursor-grabbing" />

                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />

                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => updateStage(realIndex, 'name', e.target.value)}
                      className="input flex-1"
                      placeholder="Stage name"
                    />

                    <select
                      value={stage.color}
                      onChange={(e) => updateStage(realIndex, 'color', e.target.value)}
                      className="input w-32"
                    >
                      {colorOptions.map(color => (
                        <option key={color.value} value={color.value}>
                          {color.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => deleteStage(realIndex)}
                      className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                      aria-label="Delete stage"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={addStage}
              className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center justify-center gap-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Stage
            </button>
          </>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary flex items-center"
            disabled={saving || loading}
          >
            {saving ? <LoadingSpinner size="sm" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
