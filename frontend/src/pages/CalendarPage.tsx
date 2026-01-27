import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Flag, CheckSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clsx } from 'clsx'

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'project' | 'task' | 'milestone'
  projectId?: string
  projectName?: string
  status?: string
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of month and total days
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

  // Generate calendar days
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  // Fetch events
  useEffect(() => {
    fetchEvents()
  }, [currentDate])

  async function fetchEvents() {
    setLoading(true)
    const startOfMonth = new Date(year, month, 1).toISOString()
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    const allEvents: CalendarEvent[] = []

    // Fetch projects with due dates
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, due_date, status')
      .gte('due_date', startOfMonth)
      .lte('due_date', endOfMonth)

    if (projects) {
      for (const project of projects) {
        if (project.due_date) {
          allEvents.push({
            id: `project-${project.id}`,
            title: project.name,
            date: project.due_date,
            type: 'project',
            projectId: project.id,
            status: project.status,
          })
        }
      }
    }

    // Fetch tasks with due dates
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, status, project_id, projects(name)')
      .gte('due_date', startOfMonth)
      .lte('due_date', endOfMonth)

    if (tasks) {
      for (const task of tasks) {
        if (task.due_date) {
          allEvents.push({
            id: `task-${task.id}`,
            title: task.title,
            date: task.due_date,
            type: 'task',
            projectId: task.project_id,
            projectName: (task.projects as any)?.name,
            status: task.status,
          })
        }
      }
    }

    // Fetch milestones with due dates
    const { data: milestones } = await supabase
      .from('milestones')
      .select('id, name, due_date, completed, project_id, projects(name)')
      .gte('due_date', startOfMonth)
      .lte('due_date', endOfMonth)

    if (milestones) {
      for (const milestone of milestones) {
        if (milestone.due_date) {
          allEvents.push({
            id: `milestone-${milestone.id}`,
            title: milestone.name,
            date: milestone.due_date,
            type: 'milestone',
            projectId: milestone.project_id,
            projectName: (milestone.projects as any)?.name,
            status: milestone.completed ? 'completed' : 'pending',
          })
        }
      }
    }

    setEvents(allEvents)
    setLoading(false)
  }

  function getEventsForDay(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(event => event.date.startsWith(dateStr))
  }

  function previousMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  function goToToday() {
    setCurrentDate(new Date())
    const today = new Date()
    setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get selected day's events
  const selectedDayEvents = selectedDate
    ? events.filter(event => event.date.startsWith(selectedDate))
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Calendar</h1>
          <p className="text-slate-500 dark:text-slate-400">
            View project deadlines, tasks, and milestones
          </p>
        </div>
        <button onClick={goToToday} className="btn-outline">
          Today
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </button>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="aspect-square" />
                  }

                  const dayEvents = getEventsForDay(day)
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = isCurrentMonth && today.getDate() === day
                  const isSelected = selectedDate === dateStr
                  const hasEvents = dayEvents.length > 0

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dateStr)}
                      className={clsx(
                        'aspect-square p-1 rounded-lg transition-colors relative flex flex-col items-center justify-start',
                        isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                        isToday && !isSelected && 'bg-slate-100 dark:bg-slate-800'
                      )}
                    >
                      <span className={clsx(
                        'text-sm font-medium',
                        isToday
                          ? 'text-primary-600 dark:text-primary-400 font-bold'
                          : 'text-slate-700 dark:text-slate-300'
                      )}>
                        {day}
                      </span>
                      {hasEvents && (
                        <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                          {dayEvents.slice(0, 3).map((event, i) => (
                            <div
                              key={i}
                              className={clsx(
                                'w-1.5 h-1.5 rounded-full',
                                event.type === 'project' && 'bg-blue-500',
                                event.type === 'task' && 'bg-green-500',
                                event.type === 'milestone' && 'bg-amber-500'
                              )}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Projects
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Tasks
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Milestones
            </div>
          </div>
        </div>

        {/* Event Details Sidebar */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary-600" />
            {selectedDate
              ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })
              : 'Select a date'}
          </h3>

          {!selectedDate ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Click on a date to see events
            </p>
          ) : selectedDayEvents.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              No events on this date
            </p>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map(event => (
                <Link
                  key={event.id}
                  to={`/projects/${event.projectId}`}
                  className="block p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={clsx(
                      'p-1.5 rounded-lg flex-shrink-0',
                      event.type === 'project' && 'bg-blue-100 dark:bg-blue-900/30',
                      event.type === 'task' && 'bg-green-100 dark:bg-green-900/30',
                      event.type === 'milestone' && 'bg-amber-100 dark:bg-amber-900/30'
                    )}>
                      {event.type === 'project' && <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      {event.type === 'task' && <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />}
                      {event.type === 'milestone' && <Flag className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {event.title}
                      </p>
                      {event.projectName && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {event.projectName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={clsx(
                          'text-xs px-1.5 py-0.5 rounded capitalize',
                          event.type === 'project' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                          event.type === 'task' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                          event.type === 'milestone' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        )}>
                          {event.type}
                        </span>
                        {event.status && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {event.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
