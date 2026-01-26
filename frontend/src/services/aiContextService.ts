import { supabase } from '../lib/supabase'
import type { Client, Project, Activity } from '../types/database'

export interface AIContextExport {
  client: {
    id: string
    name: string
    company: string | null
    email: string | null
    phone: string | null
    website: string | null
    status: string
    source: string | null
    value: number | null
    notes: string | null
    custom_fields: Record<string, unknown> | null
    created_at: string
    updated_at: string
  }
  projects: {
    id: string
    name: string
    description: string | null
    status: string
    start_date: string | null
    due_date: string | null
    budget: number | null
    created_at: string
  }[]
  recent_activities: {
    id: string
    type: string
    content: string | null
    metadata: Record<string, unknown> | null
    created_at: string
  }[]
  summary: {
    total_projects: number
    active_projects: number
    completed_projects: number
    total_activities: number
    total_value: number | null
    last_activity_date: string | null
  }
  exported_at: string
}

/**
 * Fetches structured context for a client, optimized for AI agent consumption.
 * This provides a comprehensive snapshot of a client's data including:
 * - Client information
 * - All projects
 * - Recent activities (last 20)
 * - Summary statistics
 */
export async function getClientContext(clientId: string): Promise<{ data: AIContextExport | null; error: string | null }> {
  try {
    // Fetch client, projects, and activities in parallel for efficiency
    const [clientResult, projectsResult, activitiesResult] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('projects')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('activities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20)
    ])

    if (clientResult.error) {
      return { data: null, error: `Client not found: ${clientResult.error.message}` }
    }

    const client = clientResult.data as Client
    const projects = (projectsResult.data || []) as Project[]
    const activities = (activitiesResult.data || []) as Activity[]

    // Calculate summary statistics
    const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'review').length
    const completedProjects = projects.filter(p => p.status === 'completed').length
    const lastActivityDate = activities.length > 0 ? activities[0].created_at : null

    const contextExport: AIContextExport = {
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        website: client.website,
        status: client.status,
        source: client.source,
        value: client.value,
        notes: client.notes,
        custom_fields: client.custom_fields as Record<string, unknown> | null,
        created_at: client.created_at,
        updated_at: client.updated_at
      },
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        start_date: p.start_date,
        due_date: p.due_date,
        budget: p.budget,
        created_at: p.created_at
      })),
      recent_activities: activities.map(a => ({
        id: a.id,
        type: a.type,
        content: a.content,
        metadata: a.metadata as Record<string, unknown> | null,
        created_at: a.created_at
      })),
      summary: {
        total_projects: projects.length,
        active_projects: activeProjects,
        completed_projects: completedProjects,
        total_activities: activities.length,
        total_value: client.value,
        last_activity_date: lastActivityDate
      },
      exported_at: new Date().toISOString()
    }

    return { data: contextExport, error: null }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    return { data: null, error: errorMessage }
  }
}

/**
 * Returns the API endpoint URL for client context
 * This can be used to share the endpoint with AI agents
 */
export function getClientContextEndpoint(clientId: string): string {
  return `/api/clients/${clientId}/context`
}
