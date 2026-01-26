-- Create milestones table
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON public.milestones(project_id);

-- Enable RLS
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view milestones for projects in their workspace"
    ON public.milestones FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON p.client_id = c.id
            JOIN public.workspace_members wm ON c.workspace_id = wm.workspace_id
            WHERE p.id = milestones.project_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert milestones for projects in their workspace"
    ON public.milestones FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON p.client_id = c.id
            JOIN public.workspace_members wm ON c.workspace_id = wm.workspace_id
            WHERE p.id = milestones.project_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update milestones for projects in their workspace"
    ON public.milestones FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON p.client_id = c.id
            JOIN public.workspace_members wm ON c.workspace_id = wm.workspace_id
            WHERE p.id = milestones.project_id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete milestones for projects in their workspace"
    ON public.milestones FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            JOIN public.clients c ON p.client_id = c.id
            JOIN public.workspace_members wm ON c.workspace_id = wm.workspace_id
            WHERE p.id = milestones.project_id
            AND wm.user_id = auth.uid()
        )
    );
