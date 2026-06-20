# TaskPilot AI 🚀

TaskPilot AI is an autonomous, secure, and privacy-preserving desktop AI companion built to maximize engineering productivity and simplify manager-developer alignment. By integrating task flows, meeting intelligence, and secure execution sandboxes, TaskPilot AI reduces developer noise and accelerates team delivery.

---

## 🌟 Key Features

### 1. Real-Time Task Prioritization & Deduplication
- **Multi-Source Aggregation**: Consolidates tasks and signals from Jira, ServiceNow, GitHub, Outlook, and Slack.
- **Explainable Ranking**: TaskPilot AI prioritizes the task backlog dynamically using key parameters (severity, deadline, duplicate similarity, owner pressure).
- **Smart Deduplication**: Automatically groups identical or related tickets across systems.

### 2. Autonomous Meeting Intelligence
- **Meeting Agent**: Scans connected streams to identify calendar blocks and pending meetings.
- **Deep AI Analysis**: Extracts action items, key decisions, follow-up meetings, and risk logs.
- **Calendar Integration**: Saves confirmed meetings to the developer's calendar automatically.

### 3. Manager Assignment & Analytics
- **Balanced Allocation**: Managers get full visibility into team workloads and capacity blocks.
- **AI Task Assigner**: Recommends the best owner for new tasks using current queue loads and individual skills.
- **Team Portal**: Post real-time announcements, announcements, and direct priorities to team members.

### 4. End-of-Day PDF Report
- Generates clean, client-facing PDF reports detailing completed tasks, duration logs, and priorities for the next day with custom corporate branding.

### 5. Trusted Execution Environment (TEE)
- Runs code scans, PR checks, and local scripts inside an attested secure sandbox to verify integrity and redact credentials.

---

## 🛡️ Database & Security (RLS)

TaskPilot AI uses **Supabase (PostgreSQL)** for secure user management. Row-Level Security (RLS) is fully enabled across all primary tables to protect sensitive developer logs:

- **Engineer Profiles**:
  - Engineers can read and update their *own* profiles.
  - Managers can read *all* profiles to monitor workloads.
- **Source Connections**: Private to each engineer; only the owner can read/write.
- **Execution History**:
  - Engineers can read their own execution logs.
  - Managers can read *all* execution histories to audit task performance.

*SQL migration scripts can be found at `backend/taskpilotai/supabase/001_taskpilot_profiles.sql`.*

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla Javascript (ES Modules), Custom Styling (CSS), Electron Desktop Shell.
- **Backend**: Python (FastAPI), Vertex AI (REST client), NodeJS (helper scripts).
- **Database**: Supabase.

---

## 🚀 Setup & Execution

### 1. Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Supabase account (optional for desktop integration)

### 2. Environment Configuration
Create a `.env` file in `backend/taskpilotai/` with the following variables:
```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

### 3. Run Backend Server
```bash
cd backend/taskpilotai
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 server.py
```
*The backend server runs on `http://127.0.0.1:8787`.*

### 4. Run Frontend Server
```bash
cd frontend/taskpilotai
npm install
npm run dev
```
*The frontend server runs on `http://127.0.0.1:5173`.*

### 5. Run Desktop Application (Electron)
To build and launch the Electron application:
```bash
cd frontend/taskpilotai
npm run build
npm run electron
```
