Smart Recruitment \& Screening Platform (ATS)



An  Applicant Tracking System (ATS) that automates candidate resume screening and ranking, manages the recruitment lifecycle pipeline, and enables direct candidate communication via email directly from the platform.







 System Architecture



The system is organized into three decoupled core components:



1. Frontend (Client Tier): <i>Next.js 14 App Router (React, TypeScript, Tailwind CSS) deployed on Vercel, managing recruiter state, JWT session storage, and interactive data visualization.</i>

2. Backend (API Tier): <i>Django 5 and Django REST Framework deployed on Render, handling data persistence, role-based authorization, query-optimized CRUD operations, and SMTP email dispatch.</i>

3. AI \& Screening Engine (Inference Tier): <i>hybrid engine combining a deterministic NLP scoring algorithm (TF-IDF + Cosine Similarity) with an LLM inference service (Groq Cloud / Local Ollama) and a zero-downtime heuristic fallback.</i>






Key Features



Candidate Ranking Dashboard: <i>Real-time leaderboard ranking candidates by overall match score with search, status filtering, and pipeline management.</i>

Granular Score Breakdown: Detailed multi-dimensional metrics for every resume, providing an overall match percentage along with individual breakdowns for Skills, Experience Relevance, and Keyword Density<b>.</b>

Executive AI Insights:\*\**** <i>Generates a concise candidate fit summary, identifies missing non-negotiable requirements, and formulates 3 tailored behavioral interview questions based on candidate gaps</i>

Direct Candidate Emailing: <i>Send personalized candidate correspondence (Interview Invitations, Job Offers, or Rejections) directly to candidate inboxes using pre-configured templates and live SMTP</i>

 Security:<i>Stateless JWT authentication  with a 7-day token lifetime, role-based access control (Recruiter vs. Reviewer), and protected private endpoints.</i>

Zero-Downtime Fallback: <i>A deterministic heuristic fallback that automatically generates structured insights if external AI models are offline or unreachable</i>



Scoring Engine \& Algorithm



<i>he overall candidate score is calculated deterministically:</i>



$$\\text{Total Score} = \\text{Skills Score} + \\text{Experience Score} + \\text{Keywords Score}$$



Skills Match (Default: 40%): Extracts candidate competencies from the resume's skills section and matches them against target job requirements and mandatory must-haves using regex word-boundary detection.

Experience Relevance (Default: 40%):\*\* Calculates semantic relevance by extracting work history responsibilities and applying \*\*TF-IDF vectorization and Cosine Similarity against job requirements.

Keywords Overlap (Default: 20%):\*\* Evaluates overall domain keyword density across the complete resume text body.

Dynamic Weighting: Weights are not fixed. Recruiters can configure custom weight distributions per job posting (e.g., 60% Experience for Senior roles vs. 60% Skills for Junior roles). If omitted, the engine uses the default 40 / 40 / 20 distribution.






How the AI Module Works



The AI service accepts the candidate's parsed resume and the job requirements payload. It passes a structured prompt to the LLM and requests a strictly typed JSON response containing:

1. Executive fit summary (2–3 sentences)

2. Strengths and critical red flags / skill gaps

3. 3 targeted interview questions probing candidate-specific gaps



Multi-Tier Inference Hierarchy:

<i>Cloud Mode (Production):\ Dispatches requests to Groq Cloud (`llama-3.1-8b-instant`) for sub-second, GPU-accelerated inference.</i>

Local Mode (Development): Connects to a locally running Ollama daemon (`llama3.2:3b`) on `127.0.0.1:11434`.

Heuristic Fallback: If neither AI service is reachable, the backend executes a deterministic rule-based analysis. This guarantees that API endpoints never crash and recruiters always receive actionable insights.










Frontend

<i>Framework:\\ Next.js 14 (App Router)</i>

Language: TypeScript

Styling: Tailwind CSS

Icons: Lucide React

Hosting: Vercel




<i>\Framework: Django 5.0 + Django REST Framework</i>

Authentication: `djangorestframework-simplejwt`

NLP \& Scoring: `scikit-learn` (TF-IDF, Cosine Similarity)

Document Parsing: `python-docx`, `pypdf`

WSGI \& Static Handling: Gunicorn, WhiteNoise

Hosting: Render







 Local Setup Guide



 1. Prerequisites

Python 3.10+

Node.js 18+

Git



 2. Backend Setup

```bash

cd recruiter_platform/backend



 1. Create and activate virtual environment

python -m venv venv

# Windows:

venv\\Scripts\\activate

 Mac/Linux:

source venv/bin/activate



# 2. Install dependencies

pip install -r requirements.txt



# 3. Apply database migrations

*python manage.py migrate*



# 4. Start the development server

python manage.py runserver*



3. Frontend Setup



cd recruiter\_platform/frontend



1. Install dependencies

npm install



2. Start Next.js development server

npm run dev



Environment Variables



Backend (backend/.env)

DEBUG=True

SECRET\_KEY=your-secure-django-secret-key

ALLOWED\_HOSTS=\

CORS\_ALLOW\_ALL\_ORIGINS=True



Optional: Cloud AI Acceleration

GROQ\_API\_KEY=gsk\_your\_groq\_api\_key\_here



 Optional: Live Email Delivery via Gmail

EMAIL\_BACKEND=django.core.mail.backends.smtp.EmailBackend

EMAIL\_HOST=smtp.gmail.com

EMAIL\_PORT=587

EMAIL\_USE\_TLS=True

EMAIL\_HOST\_USER=your\_email@gmail.com

EMAIL\_HOST\_PASSWORD=your\_16\_char\_google\_app\_password

DEFAULT\_FROM\_EMAIL=your\_email@gmail.com



Frontend (frontend/.env.local)



NEXT\_PUBLIC\_API\_URL=http://127.0.0.1:8000/api

 On production:

 NEXT\_PUBLIC\_API\_URL=https://your-backend.onrender.com/api



