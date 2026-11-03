LOOM - Organisational Knowledge Continuity
Connect what an organisation knows. Preserve it through change.

LOOM is a web prototype for turning scattered organisational documents into reviewed, connected knowledge. It links people, responsibilities, tasks, decisions and source documents so that important context is easier to find and less likely to disappear during team changes.
Live project
- Web app: https://loom-knowledge-continuity.vercel.app
- Backend health: https://loom-api-5h14.onrender.com/api/health
- Source code: https://github.com/monikha001/loom-knowledge-continuity
What works in this Round 2 build
1. Authentication and organisation workspace - users can create an account or sign in, then create an organisation workspace.
2. Knowledge Vault - upload PDF, DOCX, TXT and CSV documents up to 10 MB; add a title, category and description; search and filter saved documents; store the original file and extracted text against the organisation.
3. Document text extraction - text is extracted in the browser using PDF.js, Mammoth and PapaParse. PDF files need a readable text layer; scanned-image OCR is not included.
4. Local knowledge analysis - the Express backend applies explicit rule-based patterns to identify project names, people and listed responsibilities, decisions/technology choices, pending tasks, dependencies, explicit ownership statements and possible documentation/ownership gaps.
5. Human review and approval - proposed entities and relationships can be selected or deselected before being saved to the knowledge database.
6. Knowledge Graph - approved entities and relationships are displayed as an interactive graph, with search, type filtering, refresh, navigation and node inspection.
Important implementation note
The current working extraction workflow is rule-based local analysis, not a generative-AI model. It does not send document text to an external LLM. The parser is intentionally transparent and pattern-based, so it works best when source documents use clear headings and explicit statements. Results should be reviewed by a person before approval.
Current scope and limitations
The Round 2 prototype focuses on the complete document-to-approved-knowledge-to-graph workflow. The Impact Simulator, Continuity Packs, and Team & Ownership sections are visible in navigation but are not implemented as complete working modules in this build. They are planned extensions, not completed features.

Other current limits:
- Supported uploads: PDF, DOCX, TXT and CSV.
- Maximum upload size: 10 MB per file.
- PDF extraction reads embedded text; scanned PDFs do not receive OCR.
- Rule-based extraction depends on explicit wording and predictable document structure; it can miss implied information or produce candidates that need correction.
- The database schema and access policies must be configured in the connected Supabase project. Setup SQL/migrations are not yet included in this repository.
- The deployed prototype has been manually smoke-tested by the builder for sign-in, organisation access, document upload, local analysis, approval and graph viewing. It has not been load-tested or independently security-audited.
Technology
- Frontend: React 19, Vite 8, JavaScript, CSS
- Backend: Node.js, Express 5
- Database, authentication and file storage: Supabase (PostgreSQL, Supabase Auth, Supabase Storage)
- Document parsing: PDF.js, Mammoth, PapaParse
- Graph visualisation: React Flow (@xyflow/react)
- Deployment: Vercel (frontend), Render (backend)
Run locally
1. Frontend
From the repository root:
npm install
npm run dev
Create a root .env.local file with:
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_API_BASE_URL=http://localhost:4000
2. Backend
In a second terminal:
cd server
npm install
npm run dev
Create server/.env with:
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
FRONTEND_URL=http://localhost:5173
Do not commit .env.local, server/.env, service-role keys, or other secrets. The repository's .gitignore excludes environment files.
3. Supabase setup
Connect the app to a Supabase project with the LOOM tables, storage bucket and row-level security policies configured. The schema setup scripts are not currently part of this repository, so a fresh Supabase project is not plug-and-play from source alone.
Round 3 direction
1. Knowledge verification and freshness: source-version tracking, stale-knowledge review, contradiction detection and claim-level evidence checks.
2. Permission-aware sharing: role-based access, scoped handover exports and safeguards for confidential information.
3. Guided knowledge recovery: departure impact analysis, backup-owner suggestions, targeted knowledge-transfer questions and handover completion tracking.
Builder
Monika Guna Sekaran - solo participant, Team Eclipse - WCC Forge Hackathon, Round 2.
