import { useState, useEffect, useMemo } from 'react'
import { BarChart3, TrendingUp, Activity, Calendar, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import type { Activity as ActivityType, ActivityType as ActivityTypeEnum } from '../types/database'

type TimeRange = '7d' | '14d' | '30d' | '90d'

interface DayActivity {
  date: string
  label: string
  total: number
  byType: Record<ActivityTypeEnum, number>
}

export function ReportsPage() {
  const { currentWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [isTimeRangeDropdownOpen, setIsTimeRangeDropdownOpen] = useState(false)

  const timeRangeOptions: { value: TimeRange; label: string; days: number }[] = [
    { value: '7d', label: 'Last 7 days', days: 7 },
    { value: '14d', label: 'Last 14 days', days: 14 },
    { value: '30d', label: 'Last 30 days', days: 30 },
    { value: '90d', label: 'Last 90 days', days: 90 },
  ]

  const selectedTimeRange = timeRangeOptions.find(t => t.value === timeRange)!

  useEffect(() => {
    if (currentWorkspace) {
      fetchActivities()
    }
  }, [currentWorkspace, timeRange])

  async function fetchActivities() {
    if (!currentWorkspace) return

    setLoading(true)

    // Get start date based on time range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - selectedTimeRange.days)
    startDate.setHours(0, 0, 0, 0)

    // First get all client IDs for this workspace
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id')
      .eq('workspace_id', currentWorkspace.id)

    if (clientsError) {
      console.error('Error fetching clients:', clientsError)
      setLoading(false)
      return
    }

    const clientIds = clientsData?.map(c => c.id) || []

    if (clientIds.length === 0) {
      setActivities([])
      setLoading(false)
      return
    }

    // Fetch activities for these clients
    const { data: activitiesData, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .in('client_id', clientIds)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
    } else {
      setActivities(activitiesData || [])
    }

    setLoading(false)
  }

  // Process activities into daily trend data
  const trendData = useMemo<DayActivity[]>(() => {
    const days: DayActivity[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create array of dates for the selected time range
    for (let i = selectedTimeRange.days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      days.push({
        date: dateStr,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: 0,
        byType: {
          note: 0,
          call: 0,
          email: 0,
          meeting: 0,
          task: 0,
          status_change: 0,
        },
      })
    }

    // Count activities per day
    activities.forEach(activity => {
      const activityDate = new Date(activity.created_at).toISOString().split('T')[0]
      const dayData = days.find(d => d.date === activityDate)
      if (dayData) {
        dayData.total++
        dayData.byType[activity.type]++
      }
    })

    return days
  }, [activities, selectedTimeRange.days])

  // Calculate stats
  const totalActivities = activities.length
  const averagePerDay = selectedTimeRange.days > 0
    ? (totalActivities / selectedTimeRange.days).toFixed(1)
    : '0'
  const maxDayActivities = Math.max(...trendData.map(d => d.total), 1)

  // Activity breakdown by type
  const activityBreakdown = useMemo(() => {
    const breakdown: Record<ActivityTypeEnum, number> = {
      note: 0,
      call: 0,
      email: 0,
      meeting: 0,
      task: 0,
      status_change: 0,
    }

    activities.forEach(activity => {
      breakdown[activity.type]++
    })

    return breakdown
  }, [activities])

  const activityTypeColors: Record<ActivityTypeEnum, { bg: string; text: string; bar: string }> = {
    call: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500' },
    email: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500' },
    meeting: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500' },
    note: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500' },
    task: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500' },
    status_change: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-500' },
  }

  const activityTypeLabels: Record<ActivityTypeEnum, string> = {
    call: 'Calls',
    email: 'Emails',
    meeting: 'Meetings',
    note: 'Notes',
    task: 'Tasks',
    status_change: 'Status Changes',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Reports
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Track activity trends and performance metrics
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="relative">
          <button
            onClick={() => setIsTimeRangeDropdownOpen(!isTimeRangeDropdownOpen)}
            className="btn-outline flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            {selectedTimeRange.label}
            <ChevronDown className={clsx(
              'h-4 w-4 transition-transform',
              isTimeRangeDropdownOpen && 'rotate-180'
            )} />
          </button>

          {isTimeRangeDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
              {timeRangeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTimeRange(option.value)
                    setIsTimeRangeDropdownOpen(false)
                  }}
                  className={clsx(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg',
                    timeRange === option.value
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Activity className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Activities</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalActivities}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg. per Day</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{averagePerDay}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Peak Day</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{maxDayActivities} activities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Trend Chart */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Activity Trend
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
            <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
            <p>No activity data for this period</p>
            <p className="text-sm mt-1">Start logging activities to see trends</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bar Chart */}
            <div className="relative h-48 flex items-end gap-1" role="img" aria-label="Activity trend bar chart">
              {trendData.map((day, index) => {
                const height = maxDayActivities > 0
                  ? (day.total / maxDayActivities) * 100
                  : 0

                // Show fewer labels on smaller screens
                const showLabel = selectedTimeRange.days <= 14 || index % Math.ceil(selectedTimeRange.days / 10) === 0

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center"
                    title={`${day.label}: ${day.total} activities`}
                  >
                    <div className="relative w-full flex justify-center mb-1">
                      {day.total > 0 && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {day.total}
                        </span>
                      )}
                    </div>
                    <div
                      className={clsx(
                        'w-full rounded-t transition-all duration-300',
                        day.total > 0
                          ? 'bg-primary-500 hover:bg-primary-600 cursor-pointer'
                          : 'bg-slate-200 dark:bg-slate-700'
                      )}
                      style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
                    />
                    {showLabel && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 transform -rotate-45 origin-top-left whitespace-nowrap">
                        {day.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Chart Legend */}
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Activities per day</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity Breakdown by Type */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Activity Breakdown
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : totalActivities === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>No activities to break down</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.entries(activityBreakdown) as [ActivityTypeEnum, number][])
              .filter(([_, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const percentage = totalActivities > 0 ? (count / totalActivities) * 100 : 0
                const colors = activityTypeColors[type]

                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-3 h-3 rounded', colors.bar)} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {activityTypeLabels[type]}
                        </span>
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all duration-500', colors.bar)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
