# Voost Level

**AI-Friendly CRM for Agencies**

Voost Level is a CRM application similar to Go High Level, optimized for agencies that deliver services to businesses (marketing, web development, app development). The application enables complete client management with sub-accounts per client, pipeline tracking, lead source tracking, and is designed to be used by both humans and AI agents in productive symbiosis.

## Features

### Authentication
- User registration with email/password
- Google OAuth login
- Session management and logout
- Password reset flow
- Profile management with avatar
- Multiple roles: Owner, Admin, Member, Viewer
- Role-based permissions throughout the app

### Workspace Management
- Create and manage workspaces (agencies)
- Invite team members via email
- Assign and manage roles
- Workspace settings and branding
- Support for multiple workspaces per user

### Client Management
- Sub-account per client (isolated context)
- Client profile with company info and contacts
- Client status tracking (Lead, Active, Inactive, Churned)
- Lead source tracking
- Client timeline with all interactions
- Notes and comments per client
- File attachments per client
- Custom fields per client

### Project Tracking
- Multiple projects per client
- Project status workflow (Planning, In Progress, Review, Completed)
- Project milestones and deadlines
- Task management within projects
- Time tracking (optional)
- Budget tracking (optional)

### Pipeline CRM
- Visual pipeline (Kanban board)
- Customizable pipeline stages
- Drag-and-drop between stages
- Pipeline value tracking
- Win/loss tracking
- Lead scoring (optional)

### AI Integration
- API endpoints optimized for AI agent consumption
- Structured context export per client
- Efficient data retrieval for context windows
- Webhook support for AI agent triggers
- API documentation for agent integration

### Search and Filter
- Global search across clients, projects, notes
- Full-text search in all content
- Filter by status, source, date range, tags
- Sort by name, date, value, status
- Saved search/filter presets

### Data Management
- Data validation on forms
- Import clients from CSV
- Export data to CSV/JSON
- Audit log for important changes
- Soft delete with restore option

## Technology Stack

### Frontend
- **Framework:** React with Vite
- **Styling:** Tailwind CSS
- **State Management:** React hooks and context
- **Routing:** React Router
- **Port:** 3000

### Backend (Serverless)
- **Platform:** Supabase
- **Database:** PostgreSQL via Supabase
- **Authentication:** Supabase Auth (email + Google)
- **Functions:** Supabase Edge Functions
- **Realtime:** Supabase Realtime for live updates

## Prerequisites

- Node.js 18+ installed
- npm or pnpm package manager
- Supabase project access

## Getting Started

### Quick Start

```bash
# Make the init script executable (if needed)
chmod +x init.sh

# Run the setup script
./init.sh

# Start the development server
./init.sh --start
# OR
cd frontend && npm run dev
```

### Manual Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voost-level
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Configure environment variables**

   Create or verify `.env` file in the `frontend` directory:
   ```env
   VITE_SUPABASE_URL=https://dsztivupnrzaxvrijxpu.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
voost-level/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # React context providers
│   │   ├── lib/           # Utility functions and Supabase client
│   │   ├── types/         # TypeScript type definitions
│   │   └── styles/        # Global styles
│   ├── public/            # Static assets
│   └── .env               # Environment variables
├── prompts/               # AI agent prompts (if applicable)
├── init.sh                # Development environment setup script
├── app_spec.txt           # Application specification
└── README.md              # This file
```

## Design System

### Colors
- **Primary:** #6366F1 (Indigo)
- **Secondary:** #10B981 (Emerald)
- **Accent:** #F59E0B (Amber)
- **Background Light:** #FFFFFF
- **Background Dark:** #0F172A
- **Error:** #EF4444
- **Success:** #10B981
- **Warning:** #F59E0B

### Typography
- **Font Family:** Inter, system-ui, -apple-system, sans-serif
- **Code Font:** JetBrains Mono, Consolas, monospace

## API Endpoints

The backend is powered by Supabase. Key endpoints:

### Authentication (via Supabase Auth)
- `POST /auth/v1/signup` - User registration
- `POST /auth/v1/token` - User login
- `POST /auth/v1/logout` - User logout
- `GET /auth/v1/user` - Get current user

### REST API
- `GET/POST /rest/v1/workspaces` - List/Create workspaces
- `GET/PATCH/DELETE /rest/v1/workspaces/:id` - Workspace operations
- `GET/POST /rest/v1/clients` - List/Create clients
- `GET/PATCH/DELETE /rest/v1/clients/:id` - Client operations
- `GET/POST /rest/v1/projects` - List/Create projects
- `GET/PATCH/DELETE /rest/v1/projects/:id` - Project operations

### RPC Functions (AI Integration)
- `POST /rest/v1/rpc/get_client_context` - AI-optimized client context export

#### get_client_context

Returns a structured JSON object optimized for AI agent context windows.

**Request:**
```json
POST /rest/v1/rpc/get_client_context
Content-Type: application/json
apikey: <your-anon-key>
Authorization: Bearer <your-anon-key>

{
  "p_client_id": "uuid-of-client"
}
```

**Response:**
```json
{
  "client": {
    "id": "uuid",
    "name": "Client Name",
    "company": "Company Name",
    "email": "email@example.com",
    "phone": "+1-555-0001",
    "website": "https://example.com",
    "status": "lead|active|inactive|churned",
    "source": "Website",
    "value": 1000,
    "notes": "Client notes",
    "created_at": "2026-01-26T00:00:00Z",
    "updated_at": "2026-01-26T00:00:00Z"
  },
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description",
      "status": "planning|in_progress|review|completed|cancelled",
      "start_date": "2026-01-01",
      "due_date": "2026-03-15",
      "budget": 15000,
      "tasks_count": 5,
      "tasks_completed": 2
    }
  ],
  "recent_activities": [
    {
      "id": "uuid",
      "type": "note|call|email|meeting|task|status_change",
      "content": "Activity description",
      "created_at": "2026-01-26T00:00:00Z",
      "user_name": "User Name"
    }
  ],
  "contacts": [
    {
      "id": "uuid",
      "name": "Contact Name",
      "email": "contact@example.com",
      "phone": "+1-555-0001",
      "role": "CEO",
      "is_primary": true
    }
  ],
  "summary": {
    "total_projects": 3,
    "active_projects": 1,
    "total_activities": 10,
    "last_activity_at": "2026-01-26T00:00:00Z"
  }
}
```

**Note:** The `recent_activities` array is limited to the 10 most recent activities to optimize for AI context windows.

## Database Schema

Key tables:
- `profiles` - User profiles
- `workspaces` - Workspace/agency data
- `workspace_members` - Workspace membership with roles
- `clients` - Client records
- `client_contacts` - Client contact persons
- `projects` - Project records
- `tasks` - Task records
- `pipeline_stages` - Customizable pipeline stages
- `activities` - Activity timeline entries
- `files` - File attachments

## Development

### Running Tests
```bash
cd frontend
npm run test
```

### Building for Production
```bash
cd frontend
npm run build
```

### Linting
```bash
cd frontend
npm run lint
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

Proprietary - All rights reserved

## Support

For questions or support, please contact the development team.
