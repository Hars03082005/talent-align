# TalentAlign — Proactive Talent Alignment for Sustainable Employment

> **An end-to-end ML, Agentic AI, and Career Intelligence platform that forecasts IT role demand, discovers emerging career clusters, evaluates Gartner technology maturity risk, and delivers personalized role matching, skill-gap analysis, 6-month roadmaps, and live job matching.**

---

## System Architecture

```
RAW LABOR MARKET DATA (Adzuna + LinkedIn + Naukri + O*NET + ESCO)
    │
    ├── PIPELINE A: LightGBM Known-Role Forecasting
    │   └── 39 established IT roles × walk-forward validation × SHAP explainability
    │
    ├── PIPELINE B: SBERT + HDBSCAN Emerging-Role Discovery
    │   └── 12 quarterly windows → cluster tracking → Holt-Damped growth forecast (21 clusters)
    │
    └── GARTNER MATURITY LAYER (config/gartner_maturity_map.json)
        └── Hype Cycle Stage, Years to Plateau, Career Risk Profile & Strategic Rationale
                        │
              UNIFIED 60-ROLE CATALOG
                        │
         ┌──────────────┴──────────────┐
         │    RECOMMENDATION ENGINE    │
         │  BAIO adaptive assessment   │
         │  6-factor composite scoring │
         │  Deterministic skill gap    │
         │  4-stage 6-month roadmap    │
         └──────────────┬──────────────┘
                        │
         ┌──────────────┴──────────────────────────────────┐
         │      BACKEND & AGENTIC AI LAYER (FastAPI)       │
         │  • SQLite + SQLAlchemy ORM (Snapshots & Jobs)   │
         │  • LangGraph 4-Agent Supervisor + SqliteSaver   │
         │  • Hybrid RAG (Dense Embeddings + BM25 + Rerank)│
         │  • FastMCP Server (ML, RAG, Jobs, Profile tools)│
         │  • Resume Intelligence (PyMuPDF + Qwen 2.5)     │
         └──────────────┬──────────────────────────────────┘
                        │
       React + Vite + TypeScript UI (http://localhost:5173)
       (Dashboard, 60-Role Explorer, 4-Tab Role Deep Dive,
        Jobs Board, Onboarding & AI Copilot Drawer)
```

---

## Key Capabilities & Highlights

| Component | Details |
|---|---|
| **Unified Role Catalog** | **60 IT roles** (39 established Pipeline-A roles + 21 HDBSCAN emerging clusters) |
| **Gartner Maturity & Risk** | Dynamic Hype Cycle stage, years to plateau, career risk profile, and rationale on all 60 roles |
| **Pipeline A (LightGBM)** | Known-role 6M/12M demand forecasting with chronological walk-forward validation & SHAP drivers |
| **Pipeline B (SBERT + HDBSCAN)** | Unsupervised semantic clustering (`all-MiniLM-L6-v2`) + Holt-Damped forecasting |
| **Agentic AI Copilot** | 4-Agent LangGraph Supervisor (*Career Advisor*, *Resume Intelligence*, *Skill Development*, *Job Intelligence*) with `SqliteSaver` memory & output validator |
| **Hybrid RAG** | Dense SentenceTransformers + Sparse BM25 + Cross-Encoder re-ranking over curated role, SHAP, roadmap & Gartner chunks |
| **MCP Integration** | Standardized Model Context Protocol server (`backend/mcp/server.py`) via `fastmcp` |
| **Resume Parser** | `PyMuPDF` text extraction + Ollama Qwen 2.5 structured parsing filtered against canonical skill taxonomy |
| **Application Database** | **SQLite + SQLAlchemy ORM** (`data/application/career_recommendation.db` & `langgraph_checkpoints.db`) |
| **Modern Frontend** | **React 18 + TypeScript + Vite + Tailwind CSS + Recharts** (`frontend/src/`) |
| **Automated Tests** | **62/62 Pytest tests passing** (`tests/`) + clean `tsc && vite build` |

---

## Quick Start

### Option 1: Local Development (Recommended)

#### Prerequisites
- **Python 3.10+** (verified on Python 3.13)
- **Node.js 18+** & `npm`
- **Ollama** (for local AI Copilot & Resume Parsing):
  ```bash
  ollama pull qwen2.5:3b
  ollama pull qwen2.5:7b-instruct
  ```

#### 1. Install Dependencies & Initialize DB
```bash
# Backend Python dependencies
pip install -r requirements.txt

# Initialize SQLite application database
python -m backend.init_db

# Frontend dependencies
cd frontend
npm install
cd ..
```

#### 2. Start Backend & Frontend
- **Windows:** `start_app.bat`
- **Unix/Mac:** `bash start_app.sh`
- **Or run manually in two terminals:**
  ```bash
  # Terminal 1: FastAPI Backend
  uvicorn backend.main:app --reload --port 8000

  # Terminal 2: React + Vite Frontend
  cd frontend && npm run dev
  ```

- **React Web App**: http://localhost:5173
- **FastAPI Swagger Docs**: http://localhost:8000/docs

---

### Option 2: Docker Compose

```bash
docker-compose up --build
```
- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:5173

*(Ensure Ollama is running on the host on port `11434` so `host.docker.internal:11434` is reachable.)*

---

## Running ML Pipelines & Tests

```bash
# Run full ML pipeline (forecasting + discovery + catalog build)
python run_pipeline.py

# Run individual ML stages
python run_pipeline.py --known-only       # Pipeline A only (LightGBM)
python run_pipeline.py --discovery-only   # Pipeline B only (SBERT + HDBSCAN)
python run_pipeline.py --backtest         # Historical emergence backtest
python run_pipeline.py --validate-only    # Leakage tests + assertions
python run_pipeline.py --shap-only        # SHAP explanations only
python run_pipeline.py --dashboard        # Regenerate HTML dashboard

# Run backend test suite (62 tests)
pytest tests/ -q

# Build production React bundle
cd frontend && npm run build
```

---

## Persistent Databases (SQLite)

The application isolates ML training artifacts from runtime user data:
1. **`data/application/career_recommendation.db`** (SQLAlchemy ORM):
   - `users`, `assessment_sessions`, `assessment_answers`, `role_recommendations`, `recommendation_snapshots`, `feedback`, `job_listings`, `job_applications`, `career_action_plans`.
2. **`data/application/langgraph_checkpoints.db`** (`SqliteSaver`):
   - Multi-turn conversation state & memory per `session_id` / `thread_id`.

> [!NOTE]
> Raw datasets (`data/01_raw/`, `data/raw/`), heavy `.npy` embeddings, and runtime `.db` files are excluded via `.gitignore`. ML model weights (`models/final_model.joblib`), canonical mappings, and role catalogs (`data/role_catalog/emerging_roles.json`) remain immutable on disk; Gartner maturity fields are enriched dynamically in `backend/data_loader.py`.

---

## Project Structure

```
talent-align/
├── backend/
│   ├── ai/                     # LangGraph supervisor, agents, Hybrid RAG, validator
│   ├── jobs/                   # Job collector, deterministic matcher, APScheduler
│   ├── mcp/                    # FastMCP server & client adapter
│   ├── routers/                # Modular FastAPI routers (ai_chat, ai_resume, jobs)
│   ├── data_loader.py          # Role catalog loader, name sanitizer & Gartner enrichment
│   ├── database.py             # SQLAlchemy engine & session setup
│   ├── db_models.py            # ORM models
│   ├── db_repository.py        # Persistence CRUD & snapshot queries
│   ├── main.py                 # FastAPI entrypoint
│   └── models.py               # Pydantic request/response schemas
├── config/
│   ├── gartner_maturity_map.json # Gartner Hype Cycle & career risk mappings
│   ├── pipeline_config.yaml      # ML pipeline hyperparameters
│   └── recommendation_config.yaml
├── data/
│   ├── features/               # Master role-month panel features
│   ├── mappings/               # Canonical role & skill mappings
│   └── role_catalog/           # Unified 60-role catalog (emerging_roles.json)
├── docs/                       # Complete architecture & pipeline documentation
├── frontend/
│   ├── src/
│   │   ├── api/                # Typed backend API client
│   │   ├── components/         # AppShell, AIChatDrawer, shared UI
│   │   ├── pages/              # Onboarding, Dashboard, Explorer, RoleDetail, Jobs
│   │   ├── types/              # TypeScript interfaces
│   │   └── utils/              # Shared formatting helpers (formatPercent)
│   ├── package.json
│   └── vite.config.ts
├── models/                     # Trained LightGBM artifacts
├── outputs/                    # Forecasts, SHAP explanations & evaluation reports
├── scripts/                    # Preprocessing, leakage audit & training scripts
├── src/                        # Core ML modules (clustering, forecasting, SHAP, recommendation)
├── tests/                      # 62 automated unit & integration tests
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── run_pipeline.py
```

---

## Documentation Index

| Document | Purpose |
|---|---|
| [`docs/END_TO_END_DATA_AND_ML_PIPELINE.md`](docs/END_TO_END_DATA_AND_ML_PIPELINE.md) | Complete data cleaning, feature engineering, ML training, RAG & UI pipeline |
| [`MASTER_TECHNICAL_REPORT.md`](MASTER_TECHNICAL_REPORT.md) | Master technical architecture and methodology report |
| [`docs/FINAL_SYSTEM_ARCHITECTURE.md`](docs/FINAL_SYSTEM_ARCHITECTURE.md) | System architecture specification |
| [`docs/KNOWN_ROLE_FORECASTING_REPORT.md`](docs/KNOWN_ROLE_FORECASTING_REPORT.md) | Pipeline A LightGBM walk-forward validation report |
| [`docs/EMERGING_ROLE_BACKTEST_REPORT.md`](docs/EMERGING_ROLE_BACKTEST_REPORT.md) | Pipeline B HDBSCAN emergence backtest report |
| [`docs/RECOMMENDATION_ENGINE_SPEC.md`](docs/RECOMMENDATION_ENGINE_SPEC.md) | BAIO & 6-factor recommendation engine specification |
| [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) | Annotated repository layout |

---

## Core Technologies

| Layer | Technologies |
|---|---|
| **ML & Forecasting** | LightGBM 4.6.0, scikit-learn 1.9.0, statsmodels 0.14.6, SHAP 0.52.0 |
| **NLP & Clustering** | SentenceTransformers (`all-MiniLM-L6-v2`), HDBSCAN 0.8.44, rank-bm25 |
| **Agentic AI & MCP** | LangGraph, `langgraph-checkpoint-sqlite`, Ollama (`qwen2.5:3b`, `qwen2.5:7b-instruct`), FastMCP, PyMuPDF |
| **Backend & DB** | FastAPI 0.136.3, Uvicorn 0.49.0, Pydantic 2.12.5, SQLAlchemy + SQLite, APScheduler |
| **Frontend** | React 18, TypeScript 5.4, Vite 5.1, Tailwind CSS 3.4, Recharts, TanStack React Query |
| **Testing & DevOps** | pytest 8.4.2, httpx, Docker & Docker Compose |
