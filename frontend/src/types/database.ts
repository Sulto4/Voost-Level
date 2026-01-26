export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          settings: Json | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          settings?: Json | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          settings?: Json | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member' | 'viewer'
          invited_at: string | null
          joined_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member' | 'viewer'
          invited_at?: string | null
          joined_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member' | 'viewer'
          invited_at?: string | null
          joined_at?: string | null
        }
      }
      clients: {
        Row: {
          id: string
          workspace_id: string
          name: string
          company: string | null
          email: string | null
          phone: string | null
          website: string | null
          status: 'lead' | 'active' | 'inactive' | 'churned'
          source: string | null
          pipeline_stage_id: string | null
          value: number | null
          custom_fields: Json | null
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          company?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          status?: 'lead' | 'active' | 'inactive' | 'churned'
          source?: string | null
          pipeline_stage_id?: string | null
          value?: number | null
          custom_fields?: Json | null
          notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          company?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          status?: 'lead' | 'active' | 'inactive' | 'churned'
          source?: string | null
          pipeline_stage_id?: string | null
          value?: number | null
          custom_fields?: Json | null
          notes?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      client_contacts: {
        Row: {
          id: string
          client_id: string
          workspace_id: string
          name: string
          email: string | null
          phone: string | null
          role: string | null
          is_primary: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          workspace_id: string
          name: string
          email?: string | null
          phone?: string | null
          role?: string | null
          is_primary?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          workspace_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          role?: string | null
          is_primary?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          client_id: string
          name: string
          description: string | null
          status: 'planning' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          start_date: string | null
          due_date: string | null
          budget: number | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          description?: string | null
          status?: 'planning' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          start_date?: string | null
          due_date?: string | null
          budget?: number | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          description?: string | null
          status?: 'planning' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          start_date?: string | null
          due_date?: string | null
          budget?: number | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          parent_id: string | null
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'done'
          priority: 'low' | 'medium' | 'high'
          assigned_to: string | null
          due_date: string | null
          sort_order: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          parent_id?: string | null
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          assigned_to?: string | null
          due_date?: string | null
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          parent_id?: string | null
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'done'
          priority?: 'low' | 'medium' | 'high'
          assigned_to?: string | null
          due_date?: string | null
          sort_order?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      pipeline_stages: {
        Row: {
          id: string
          workspace_id: string
          name: string
          color: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          color?: string | null
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          color?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          client_id: string
          user_id: string
          type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'status_change'
          content: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          user_id: string
          type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'status_change'
          content?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          user_id?: string
          type?: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'status_change'
          content?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      files: {
        Row: {
          id: string
          client_id: string
          project_id: string | null
          name: string
          storage_path: string
          mime_type: string | null
          size: number | null
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          project_id?: string | null
          name: string
          storage_path: string
          mime_type?: string | null
          size?: number | null
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          project_id?: string | null
          name?: string
          storage_path?: string
          mime_type?: string | null
          size?: number | null
          uploaded_by?: string
          created_at?: string
        }
      }
      milestones: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          due_date: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      webhooks: {
        Row: {
          id: string
          workspace_id: string
          name: string
          url: string
          secret: string | null
          events: string[]
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          url: string
          secret?: string | null
          events: string[]
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          url?: string
          secret?: string | null
          events?: string[]
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      client_status: 'lead' | 'active' | 'inactive' | 'churned'
      project_status: 'planning' | 'in_progress' | 'review' | 'completed' | 'cancelled'
      task_status: 'todo' | 'in_progress' | 'done'
      task_priority: 'low' | 'medium' | 'high'
      workspace_role: 'owner' | 'admin' | 'member' | 'viewer'
      activity_type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'status_change'
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type ClientContact = Database['public']['Tables']['client_contacts']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type PipelineStage = Database['public']['Tables']['pipeline_stages']['Row']
export type Activity = Database['public']['Tables']['activities']['Row']
export type File = Database['public']['Tables']['files']['Row']
export type Milestone = Database['public']['Tables']['milestones']['Row']
export type Webhook = Database['public']['Tables']['webhooks']['Row']

export type ClientStatus = Database['public']['Enums']['client_status']
export type ProjectStatus = Database['public']['Enums']['project_status']
export type TaskStatus = Database['public']['Enums']['task_status']
export type TaskPriority = Database['public']['Enums']['task_priority']
export type WorkspaceRole = Database['public']['Enums']['workspace_role']
export type ActivityType = Database['public']['Enums']['activity_type']
