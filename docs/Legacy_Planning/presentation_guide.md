# HRAFN Development Plan: Client Presentation Guide

**Purpose:** Diagrams, visualizations, and talking points for client presentation

**Based on:** [Development Plan](./development_plan.md)

---

## Slide 1: Project Overview

### Title: HRAFN Dealer Intelligence Platform - 3-Month Development Plan

**Key Points:**
- AI-native dealer intelligence platform
- 3-month timeline (12 weeks) for demo-ready system
- Secure, scalable architecture with Next.js full-stack framework
- MVP-first approach to deliver value quickly

---

## Slide 2: Architecture Overview

### Architecture Diagram

```mermaid
graph TB
    subgraph Frontend["Frontend Layer"]
        UI[React Dashboard<br/>Next.js Frontend<br/>shadcn/ui Components]
    end
    
    subgraph Backend["Backend Layer - Next.js API Routes"]
        API[API Routes<br/>Server Actions]
        ETL[ETL Orchestration<br/>Scheduling & Retries]
        INTEG[External Integrations<br/>Tekion, CDK Global]
        AUTH[Authentication &<br/>Credential Management]
    end
    
    subgraph External["External Systems"]
        TEKION[Tekion DMS]
        CDK[CDK Global]
        OEM[OEM Feeds]
        WEB[Competitor Sites]
    end
    
    subgraph Database["Database Layer"]
        SUPABASE[(Supabase PostgreSQL<br/>RLS Enforcement<br/>Real-time Capabilities)]
    end
    
    subgraph AI["AI Layer - Server-Side Only"]
        LLM[Fine-Tuned Models<br/>OpenAI → Llama]
        DRAGIN[DRAGIN Retrieval<br/>Vector Search]
        AGENTS[Specialist Agents<br/>Inventory, Recommendations]
    end
    
    UI -->|API Calls| API
    API -->|Secure Auth| INTEG
    INTEG -->|Fetch Data| TEKION
    INTEG -->|Fetch Data| CDK
    INTEG -->|Fetch Data| OEM
    INTEG -->|Fetch Data| WEB
    INTEG -->|Transform & Write| SUPABASE
    API -->|Read/Write| SUPABASE
    API -->|LLM Calls| LLM
    LLM -->|Context Retrieval| DRAGIN
    DRAGIN -->|Query| SUPABASE
    AGENTS -->|Generate Recs| API
    ETL -->|Orchestrate| INTEG
    ETL -->|Aggregate Data| SUPABASE
    
    style UI fill:#4A90E2,stroke:#2C5282,stroke-width:2px,color:#fff
    style API fill:#FF8C42,stroke:#CC6D35,stroke-width:2px,color:#fff
    style SUPABASE fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style LLM fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style INTEG fill:#E67E22,stroke:#C86019,stroke-width:2px,color:#fff
```

**Key Talking Points:**
- **Security First:** All external API calls happen server-side (Next.js API routes)
- **No Browser Exposure:** Credentials never leave the server
- **Single Codebase:** Frontend and backend in one Next.js project
- **Scalable Design:** Supports high-volume data pulls from Tekion/CDK
- **DRAGIN Layer:** Distributed RAG (Retrieval-Augmented Generation) over integrations - combines semantic vector search with SQL queries for intelligent data retrieval

---

## Slide 3: Why Next.js Full-Stack?

### Architecture Comparison

```mermaid
graph LR
    subgraph Wrong["❌ React Frontend Only"]
        R1[React App]
        R1 -->|Exposes API Keys| EXT1[External APIs]
        R1 -->|Direct Connection| DB1[(Supabase)]
    end
    
    subgraph Right["✅ Next.js Full-Stack"]
        N1[React Frontend]
        N2[Next.js API Routes]
        N1 -->|Secure API Calls| N2
        N2 -->|Protected Credentials| EXT2[External APIs]
        N2 -->|Service Role| DB2[(Supabase)]
    end
    
    style Wrong fill:#E74C3C,stroke:#C0392B,stroke-width:2px,color:#fff
    style Right fill:#27AE60,stroke:#229954,stroke-width:2px,color:#fff
```

**Key Benefits:**
1. **Security:** API keys stored in environment variables (server-side only)
2. **ETL Capability:** Can handle scheduled jobs, retries, monitoring
3. **Data Transformation:** Server-side normalization before database writes
4. **Scalability:** Handles high-volume data pulls from Tekion/CDK
5. **Single Codebase:** Easier deployment and maintenance

---

## Slide 4: Development Timeline

### 3-Month Timeline Overview (Starting Nov 3, 2025)

```mermaid
gantt
    title HRAFN Development Timeline (12 Weeks - Nov 3, 2025 to Jan 25, 2026)
    dateFormat YYYY-MM-DD
    section Step 1: Foundation
    Database Schema & Security    :a1, 2025-11-03, 1w
    Data Ingestion (Tekion/CDK)   :a2, 2025-11-10, 1w
    Frontend Foundation           :a3, 2025-11-17, 1w
    API Layer Setup               :a4, 2025-11-24, 1w
    section Step 2: Intelligence
    DRAGIN Retrieval Layer        :b1, 2025-12-01, 1w
    Agentic Architecture          :b2, 2025-12-08, 2w
    Aggregate Analytics           :b3, 2025-12-08, 1w
    Fine-Tuning Data Prep         :b4, 2025-12-15, 1w
    NLQ Co-Pilot                  :b5, 2025-12-22, 1w
    MCP Adapters Expansion        :b6, 2025-12-29, 1w
    section Step 3: Demo Polish
    Basic Benchmarking            :c1, 2026-01-05, 1w
    Discount Flow                 :c2, 2026-01-12, 1w
    Enhanced Dashboard            :c3, 2026-01-12, 1w
    Demo Preparation              :c4, 2026-01-19, 1w
```

**Key Milestones:**
- **Week 4 (Nov 30, 2025):** Foundation complete - Data flowing from Tekion/CDK
- **Week 9 (Jan 4, 2026):** Intelligence layer operational - NLQ working
- **Week 12 (Jan 25, 2026):** Demo ready - Client presentation

---

## Slide 5: Step 1 - Foundation & Data Infrastructure (Weeks 1-4)

### Step 1 Architecture

```mermaid
sequenceDiagram
    participant User as Dealer User
    participant Frontend as Next.js Frontend
    participant API as Next.js API Routes
    participant Tekion as Tekion/CDK APIs
    participant Supabase as Supabase Database
    
    Note over User,Supabase: Week 1: Database Setup
    API->>Supabase: Create tables & RLS policies
    API->>Supabase: Set up authentication
    
    Note over User,Supabase: Week 2: Data Ingestion
    API->>Tekion: Authenticate (OAuth/API Key)
    Tekion-->>API: Return inventory/offers data
    API->>API: Transform & normalize data
    API->>Supabase: Write using service role
    
    Note over User,Supabase: Week 3: Frontend
    Frontend->>API: Request dashboard data
    API->>Supabase: Query with RLS
    Supabase-->>API: Return dealer-scoped data
    API-->>Frontend: Display inventory/offers
    
    Note over User,Supabase: Week 4: Real-time
    Frontend->>API: Subscribe to updates
    API->>Supabase: Real-time subscriptions
    Supabase-->>Frontend: Push updates
```

**Deliverables:**
- ✅ Secure database with RLS enforcement
- ✅ One working adapter (Tekion or CDK)
- ✅ Basic dashboard showing inventory and offers
- ✅ All data access server-side only

---

## Slide 6A: Agentic Architecture Overview

### Specialist Agents for Various User Requirements

```mermaid
flowchart TB
    subgraph Scheduler["Scheduler"]
        CRON[Cron Jobs<br/>Trigger Agents]
    end
    
    subgraph Agents["6 Specialist Agents - All Fine-Tuned"]
        AGT_INV[Inventory Agent<br/>Fine-Tuned Model<br/>Slow-moving stock, aging]
        AGT_SALES[Sales Agent<br/>Fine-Tuned Model<br/>Performance, forecasting]
        AGT_CRM[CRM Agent<br/>Fine-Tuned Model<br/>Lead management]
        AGT_VM[VM Agent<br/>Fine-Tuned Model<br/>Pricing, promotions]
        AGT_WEB[Web Comps Agent<br/>Fine-Tuned Model<br/>Competitive intelligence]
        AGT_INC[Incentives Agent<br/>Fine-Tuned Model<br/>OEM rebates, financing]
    end
    
    subgraph Evidence["Evidence Store"]
        DB[(Supabase<br/>Facts & Findings)]
        AGG[(Aggregate Tables<br/>Benchmarks)]
        LOGS[(Recommendation Logs)]
    end
    
    subgraph Orchestrator["Orchestrator"]
        ROUTE[Route to Agent<br/>Intent Classification]
        EVAL[Evaluate Evidence]
        RECS[Generate Recommendations]
    end
    
    subgraph Output["Delivery"]
        UI[Dashboard<br/>Recommendations]
        ALERT[Alerts &<br/>Notifications]
    end
    
    CRON --> AGT_INV
    CRON --> AGT_SALES
    CRON --> AGT_CRM
    CRON --> AGT_VM
    CRON --> AGT_WEB
    CRON --> AGT_INC
    
    AGT_INV --> DB
    AGT_SALES --> DB
    AGT_CRM --> DB
    AGT_VM --> DB
    AGT_WEB --> DB
    AGT_INC --> DB
    
    AGT_INV --> AGG
    AGT_SALES --> AGG
    AGT_CRM --> AGG
    
    ROUTE --> AGT_INV
    ROUTE --> AGT_SALES
    ROUTE --> AGT_CRM
    ROUTE --> AGT_VM
    ROUTE --> AGT_WEB
    ROUTE --> AGT_INC
    
    DB --> EVAL
    AGG --> EVAL
    EVAL --> RECS
    RECS --> LOGS
    RECS --> UI
    RECS --> ALERT
    
    style AGT_INV fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_SALES fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_CRM fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_VM fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_WEB fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_INC fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
```

**Why Fine-Tuning is Essential:**
- Each agent handles different user requirements
- Domain-specific expertise requires fine-tuned models
- Accurate recommendations need agent understanding of business context
- 12 fine-tuned models total (6 agents + 6 NLQ pipeline)

---

## Slide 6: Step 2 - Intelligence Layer (Weeks 5-9)

### Agentic Architecture with Specialist Agents

```mermaid
graph TB
    subgraph Input["User Requirements"]
        REQ1[Inventory Query]
        REQ2[Sales Analysis]
        REQ3[CRM Insights]
        REQ4[Pricing Recommendations]
        REQ5[Competitive Intelligence]
        REQ6[Incentive Optimization]
    end
    
    subgraph Agents["Specialist Agents - Fine-Tuned"]
        AGT_INV[Inventory Agent<br/>Fine-Tuned Model]
        AGT_SALES[Sales Agent<br/>Fine-Tuned Model]
        AGT_CRM[CRM Agent<br/>Fine-Tuned Model]
        AGT_VM[VM Agent<br/>Fine-Tuned Model]
        AGT_WEB[Web Comps Agent<br/>Fine-Tuned Model]
        AGT_INC[Incentives Agent<br/>Fine-Tuned Model]
    end
    
    subgraph NLQ["NLQ Pipeline - Fine-Tuned"]
        IC[Intent Classification]
        EE[Entity Extraction]
        SQL[SQL Generation]
        REC[Recommendation]
    end
    
    subgraph Output["Domain-Specific Results"]
        RES1[Inventory Insights]
        RES2[Sales Recommendations]
        RES3[CRM Actions]
        RES4[Pricing Strategies]
        RES5[Competitive Analysis]
        RES6[Incentive Plans]
    end
    
    REQ1 --> AGT_INV
    REQ2 --> AGT_SALES
    REQ3 --> AGT_CRM
    REQ4 --> AGT_VM
    REQ5 --> AGT_WEB
    REQ6 --> AGT_INC
    
    AGT_INV --> IC
    AGT_SALES --> IC
    AGT_CRM --> IC
    
    IC --> EE
    EE --> SQL
    SQL --> REC
    
    AGT_INV --> RES1
    AGT_SALES --> RES2
    AGT_CRM --> RES3
    AGT_VM --> RES4
    AGT_WEB --> RES5
    AGT_INC --> RES6
    
    style AGT_INV fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_SALES fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_CRM fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_VM fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_WEB fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_INC fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
```

**Key Features:**
- **6 Specialist Agents:** Each fine-tuned for specific domain (Inventory, Sales, CRM, VM, Web Comps, Incentives)
- **6 NLQ Pipeline Models:** Handle natural language processing
- **Domain Expertise:** Each agent understands its specific business context
- **Handles Various Requirements:** Different agents for different user needs
- **Total: 12 Fine-Tuned Models** for complete system

---

## Slide 6B: What is DRAGIN?

### DRAGIN: Distributed RAG over Integrations

```mermaid
graph TB
    subgraph Input["Query Input"]
        NLQ[Natural Language Query<br/>Example Query]
    end
    
    subgraph DRAGIN["DRAGIN Retrieval Layer"]
        RQ[Retriever Orchestrator<br/>Combines Semantic + SQL]
        IDX[Unified Index<br/>Vector Store<br/>pgvector]
        PIP[Normalization Schemas<br/>Data Standardization]
    end
    
    subgraph Sources["Data Sources"]
        SQL[SQL Queries<br/>PostgreSQL<br/>RLS Enforced]
        VEC[Vector Search<br/>Semantic Similarity<br/>Embeddings]
        EXT[External APIs<br/>Tekion, CDK<br/>Competitive Data]
    end
    
    subgraph Output["Context Output"]
        CTX[Consolidated Context<br/>Relevant Data + Embeddings]
    end
    
    NLQ --> RQ
    RQ --> IDX
    RQ --> SQL
    RQ --> EXT
    IDX --> VEC
    PIP --> IDX
    PIP --> SQL
    EXT --> PIP
    SQL --> CTX
    VEC --> CTX
    CTX --> AGENTS[Agents Use Context]
    
    style RQ fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style IDX fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style PIP fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style CTX fill:#FF8C42,stroke:#CC6D35,stroke-width:2px,color:#fff
```

**What DRAGIN Does:**
- **Distributed RAG:** Retrieval-Augmented Generation across multiple data sources
- **Semantic + SQL:** Combines vector search (semantic similarity) with SQL queries (structured data)
- **Unified Index:** Single vector store for all dealer data (inventory, offers, etc.)
- **Normalization:** Standardizes data from different sources (Tekion, CDK, websites)
- **Context Retrieval:** Provides relevant context to agents and LLM models

**Key Components:**
1. **Retriever Orchestrator:** Routes queries to appropriate sources (SQL or vector search)
2. **Unified Index Vector Store:** Uses Supabase pgvector for semantic search
3. **Normalization Schemas:** Transforms data from different sources into unified format

**Why It's Important:**
- Agents need relevant context to generate accurate recommendations
- Combines structured data (SQL) with semantic understanding (vector search)
- Enables intelligent retrieval across all dealer data sources

---

## Slide 7: Fine-Tuning Strategy - Core Focus

### Comprehensive Fine-Tuning for Agents & NLQ Pipeline

```mermaid
graph TB
    subgraph Prep["Week 7: Data Preparation"]
        SCHEMA[Database Schema<br/>Documentation]
        DOMAIN[Domain Knowledge<br/>Business Logic]
        TRAIN_NLQ[NLQ Training Data<br/>6 models × 100-200 examples]
        TRAIN_AGENTS[Agent Training Data<br/>6 agents × 100-200 examples]
        TEST[Test Datasets<br/>20-30 examples/model]
    end
    
    subgraph NLQ["NLQ Pipeline Models"]
        FT1[Intent Classification]
        FT2[Entity Extraction]
        FT3[Query Planning]
        FT4[SQL Generation]
        FT5[Recommendation Gen]
        FT6[Response Formatting]
    end
    
    subgraph Agents["Specialist Agent Models"]
        AGT_INV[Inventory Agent<br/>Fine-Tuned]
        AGT_SALES[Sales Agent<br/>Fine-Tuned]
        AGT_VM[VM Agent<br/>Fine-Tuned]
        AGT_CRM[CRM Agent<br/>Fine-Tuned]
        AGT_WEB[Web Comps Agent<br/>Fine-Tuned]
        AGT_INC[Incentives Agent<br/>Fine-Tuned]
    end
    
    subgraph Validate["Validation"]
        VAL_NLQ[Test NLQ Pipeline<br/>End-to-End]
        VAL_AGENTS[Test Agents<br/>Domain Accuracy]
        SAFE[SQL Safety Checks<br/>RLS Validation]
    end
    
    SCHEMA --> FT1
    SCHEMA --> FT4
    SCHEMA --> AGT_INV
    DOMAIN --> AGT_INV
    DOMAIN --> AGT_SALES
    DOMAIN --> AGT_VM
    DOMAIN --> AGT_CRM
    DOMAIN --> AGT_WEB
    DOMAIN --> AGT_INC
    TRAIN_NLQ --> FT1
    TRAIN_NLQ --> FT2
    TRAIN_NLQ --> FT3
    TRAIN_NLQ --> FT4
    TRAIN_NLQ --> FT5
    TRAIN_NLQ --> FT6
    TRAIN_AGENTS --> AGT_INV
    TRAIN_AGENTS --> AGT_SALES
    TRAIN_AGENTS --> AGT_VM
    TRAIN_AGENTS --> AGT_CRM
    TRAIN_AGENTS --> AGT_WEB
    TRAIN_AGENTS --> AGT_INC
    FT1 --> VAL_NLQ
    FT2 --> VAL_NLQ
    FT3 --> VAL_NLQ
    FT4 --> VAL_NLQ
    FT5 --> VAL_NLQ
    FT6 --> VAL_NLQ
    AGT_INV --> VAL_AGENTS
    AGT_SALES --> VAL_AGENTS
    AGT_VM --> VAL_AGENTS
    AGT_CRM --> VAL_AGENTS
    AGT_WEB --> VAL_AGENTS
    AGT_INC --> VAL_AGENTS
    VAL_NLQ --> SAFE
    VAL_AGENTS --> SAFE
    
    style SCHEMA fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style DOMAIN fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style TRAIN_NLQ fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style TRAIN_AGENTS fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style TEST fill:#F39C12,stroke:#D68910,stroke-width:2px,color:#fff
    style FT1 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style FT2 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style FT3 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style FT4 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style FT5 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style FT6 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style AGT_INV fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style AGT_SALES fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style AGT_VM fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style AGT_CRM fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style AGT_WEB fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style AGT_INC fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style VAL_NLQ fill:#27AE60,stroke:#229954,stroke-width:2px,color:#fff
    style VAL_AGENTS fill:#27AE60,stroke:#229954,stroke-width:2px,color:#fff
    style SAFE fill:#E74C3C,stroke:#C0392B,stroke-width:2px,color:#fff
```

**Why Fine-Tuning is Critical:**
- **12 Total Models:** 6 NLQ pipeline models + 6 specialist agent models
- **Domain-Specific:** Each agent needs specialized training for its domain (Inventory, Sales, CRM, etc.)
- **Accurate Recommendations:** Fine-tuned agents understand dealer business context
- **Handles Various Requirements:** Different agents handle different user needs
- **Production Ready:** Reuse all training data for Llama migration

**Key Points:**
- **Development:** Fine-tune OpenAI models (12 models total)
- **Agent Specialization:** Each agent fine-tuned for its specific domain expertise
- **Production:** Reuse training data for Llama fine-tuning (all 12 models)
- **Quality:** 100-200+ examples per model for accuracy (1,200-2,400 total examples)
- **Domain Experts Required:** Need expertise in each agent domain (Inventory, Sales, CRM, VM, Competitive Intel, Incentives)
- **Safety:** SQL validation and RLS compliance checks
- **Critical Success Factor:** Fine-tuning quality determines system accuracy and user satisfaction

---

## Slide 8: Step 3 - Demo Polish (Weeks 10-12)

### Complete Flow Diagram

```mermaid
sequenceDiagram
    participant GM as Dealer GM
    participant UI as Dashboard
    participant API as Next.js API
    participant LLM as Fine-Tuned Models
    participant DB as Supabase
    participant BENCH as Benchmark Tables
    
    GM->>UI: "Which SUVs should we discount?"
    UI->>API: POST /api/nlq
    API->>LLM: Intent Classification
    LLM-->>API: Intent: Recommendation
    API->>LLM: Entity Extraction
    LLM-->>API: Entities: {type: SUV, action: discount}
    API->>LLM: Query Planning
    LLM-->>API: Query Plan
    API->>LLM: SQL Generation
    LLM-->>API: SQL Query
    API->>DB: Execute Query (RLS enforced)
    DB-->>API: Inventory Data
    API->>BENCH: Get Benchmark Data
    BENCH-->>API: Market Averages
    API->>LLM: Recommendation Generation
    LLM-->>API: Recommendations with Rationale
    API->>LLM: Response Formatting
    LLM-->>API: Formatted Response
    API-->>UI: Display Recommendations
    UI-->>GM: Show ranked actions
```

**Demo Features:**
- ✅ Natural language query → SQL → Results
- ✅ Benchmark comparisons
- ✅ Actionable recommendations
- ✅ Approval workflow (UI)

---

## Slide 9: Technology Stack

### Complete Technology Overview

```mermaid
graph TB
    subgraph Frontend["Frontend"]
        NEXT[Next.js 14+<br/>App Router]
        REACT[React 18<br/>TypeScript]
        UI[shadcn/ui<br/>Components]
    end
    
    subgraph Backend["Backend"]
        API_ROUTES[Next.js API Routes<br/>Server Actions]
        ENV[Environment Variables<br/>Secure Credentials]
        ETL_JOB[ETL Orchestration<br/>Cron/Scheduler]
    end
    
    subgraph Database["Database"]
        SUPABASE[Supabase<br/>PostgreSQL]
        RLS[Row-Level Security<br/>Dealer Isolation]
        REALTIME[Real-time<br/>Subscriptions]
    end
    
    subgraph AI["AI/ML"]
        OPENAI[OpenAI API<br/>Development]
        LLAMA[Llama<br/>Production]
        VECTOR[pgvector<br/>Semantic Search]
    end
    
    subgraph External["External APIs"]
        TEKION[Tekion DMS]
        CDK[CDK Global]
    end
    
    NEXT --> API_ROUTES
    REACT --> NEXT
    UI --> REACT
    API_ROUTES --> ENV
    API_ROUTES --> ETL_JOB
    API_ROUTES --> SUPABASE
    API_ROUTES --> OPENAI
    API_ROUTES --> TEKION
    API_ROUTES --> CDK
    SUPABASE --> RLS
    SUPABASE --> REALTIME
    SUPABASE --> VECTOR
    OPENAI -.->|Migration| LLAMA
    
    style NEXT fill:#4A90E2,stroke:#2C5282,stroke-width:2px,color:#fff
    style REACT fill:#4A90E2,stroke:#2C5282,stroke-width:2px,color:#fff
    style UI fill:#4A90E2,stroke:#2C5282,stroke-width:2px,color:#fff
    style API_ROUTES fill:#FF8C42,stroke:#CC6D35,stroke-width:2px,color:#fff
    style ENV fill:#F39C12,stroke:#D68910,stroke-width:2px,color:#fff
    style ETL_JOB fill:#FF8C42,stroke:#CC6D35,stroke-width:2px,color:#fff
    style SUPABASE fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style RLS fill:#27AE60,stroke:#229954,stroke-width:2px,color:#fff
    style REALTIME fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style OPENAI fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style LLAMA fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style VECTOR fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style TEKION fill:#E67E22,stroke:#C86019,stroke-width:2px,color:#fff
    style CDK fill:#E67E22,stroke:#C86019,stroke-width:2px,color:#fff
```

---

## Slide 10: Security Architecture

### Security Layers

```mermaid
graph TB
    subgraph Client["Client Layer"]
        BROWSER[Browser<br/>No Credentials]
    end
    
    subgraph Server["Server Layer - Next.js"]
        API[API Routes]
        ENV_VARS[Environment Variables<br/>API Keys, Tokens]
        AUTH[Authentication<br/>Middleware]
        VALID[Validation<br/>& Sanitization]
    end
    
    subgraph Database["Database Layer"]
        RLS_POL[RLS Policies<br/>Dealer Isolation]
        SERVICE_ROLE[Service Role<br/>Server-Side Only]
        USER_AUTH[User Auth<br/>JWT Claims]
    end
    
    BROWSER -->|API Calls Only| API
    API -->|Read Only| ENV_VARS
    API -->|Verify| AUTH
    API -->|Validate| VALID
    API -->|Service Role| SERVICE_ROLE
    SERVICE_ROLE -->|RLS Enforced| RLS_POL
    BROWSER -.->|Never Direct| RLS_POL
    
    style BROWSER fill:#E74C3C,stroke:#C0392B,stroke-width:2px,color:#fff
    style ENV_VARS fill:#F39C12,stroke:#D68910,stroke-width:2px,color:#fff
    style RLS_POL fill:#27AE60,stroke:#229954,stroke-width:2px,color:#fff
```

**Security Highlights:**
- ✅ Credentials never exposed to browser
- ✅ RLS ensures dealer data isolation
- ✅ All external API calls server-side
- ✅ Service role keys never in client code

---

## Slide 11: Data Flow - ETL Process

### Complete Data Ingestion Flow

```mermaid
graph LR
    subgraph External["External Systems"]
        TEKION[Tekion DMS]
        CDK[CDK Global]
    end
    
    subgraph ETL["ETL Layer - Next.js API"]
        AUTH[Authenticate<br/>OAuth/API Keys]
        FETCH[Fetch Data<br/>Inventory/Offers]
        TRANSFORM[Transform &<br/>Normalize]
        VALIDATE[Validate Data]
        WRITE[Write to Supabase<br/>Service Role]
    end
    
    subgraph Storage["Supabase Database"]
        DEALER[Dealer Tables<br/>RLS Protected]
        AGG[Aggregate Tables<br/>k-anonymity]
        SNAP[Snapshot Tables<br/>Historical]
    end
    
    subgraph Schedule["Scheduling"]
        CRON[Cron Jobs<br/>Hourly/Nightly]
        RETRY[Retry Logic<br/>Error Handling]
        MONITOR[Monitoring<br/>Data Freshness]
    end
    
    TEKION -->|API Calls| AUTH
    CDK -->|API Calls| AUTH
    AUTH --> FETCH
    FETCH --> TRANSFORM
    TRANSFORM --> VALIDATE
    VALIDATE --> WRITE
    WRITE --> DEALER
    WRITE --> AGG
    WRITE --> SNAP
    CRON --> AUTH
    RETRY --> AUTH
    MONITOR --> WRITE
    
    style ETL fill:#FF8C42,stroke:#CC6D35,stroke-width:2px,color:#fff
    style Storage fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
```

---

## Slide 12: Timeline Summary

### Key Milestones

```mermaid
timeline
    title 3-Month Development Timeline
    Week 1-4 : Foundation
              : Database Schema & RLS
              : Tekion/CDK Integration
              : Basic Dashboard
    Week 5-9 : Intelligence
              : DRAGIN Retrieval
              : Fine-Tuned Models
              : NLQ Co-Pilot
    Week 10-12 : Demo Polish
               : Benchmarking
               : Discount Flow
               : Demo Ready
```

**Deliverables by Phase:**
- **Foundation:** Secure data pipeline, basic dashboard
- **Intelligence:** AI-powered recommendations, NLQ queries
- **Demo:** Complete discount flow, benchmarking, polished UI

---

## Slide 13: Budget Considerations

### Cost Breakdown

**Development Phase (3 Months):**
- OpenAI API usage (development/demo)
- OpenAI Fine-Tuning (12 models × $0.008-$0.03 per 1K tokens)
  - 6 NLQ Pipeline models
  - 6 Specialist Agent models
- Supabase hosting (database + real-time)
- Vercel hosting (Next.js deployment)
- Domain and SSL certificates

**Production Phase (Post-Demo):**
- Llama infrastructure (self-hosted or cloud)
- Llama fine-tuning (reuse training data)
- Ongoing Supabase costs
- Ongoing hosting costs
- Monitoring and logging tools

**Key Point:** Fine-tuning dataset is reusable for Llama migration, reducing long-term costs.

---

## Slide 14: Risk Mitigation

### Risk Management Strategy

```mermaid
mindmap
  root((Risk Management))
    Technical Risks
      RLS Performance
        Query Optimization
        Indexing Strategy
      Fine-Tuning Quality
        Multiple Iterations
        Sufficient Training Data
      Model Coordination
        End-to-End Testing
        Integration Validation
      SQL Generation Accuracy
        Validation Framework
        Safety Checks
    Business Risks
      Dealer Onboarding
        Smooth Integration Process
        Documentation
      Data Privacy
        Compliance Requirements
        RLS Enforcement
      Scalability
        Horizontal Scaling Plan
        Performance Monitoring
```

**Mitigation Strategies:**
- Early testing and validation
- Iterative fine-tuning approach
- Comprehensive error handling
- Monitoring and alerting

---

## Slide 15: Post-Demo Roadmap

### Future Enhancements

```mermaid
graph LR
    subgraph Demo["Demo (Week 12)"]
        D1[Basic NLQ]
        D2[Inventory Focus]
        D3[1-2 Adapters]
    end
    
    subgraph Phase2["Phase 2: Production"]
        P1[Llama Migration]
        P2[Full ETL Platform]
        P3[All Agents]
        P4[Advanced Benchmarking]
    end
    
    subgraph Phase3["Phase 3: Scale"]
        S1[Multiple Dealers]
        S2[Advanced Features]
        S3[Mobile App]
        S4[Enterprise Features]
    end
    
    D1 --> P1
    D2 --> P3
    D3 --> P2
    P1 --> S1
    P3 --> S2
    P2 --> S3
    
    style D1 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style D2 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style D3 fill:#3498DB,stroke:#2980B9,stroke-width:2px,color:#fff
    style P1 fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style P2 fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style P3 fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style P4 fill:#9B59B6,stroke:#7D3C98,stroke-width:2px,color:#fff
    style S1 fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style S2 fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style S3 fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style S4 fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
```

**Post-Demo Priorities:**
1. **Llama Migration** - Cost optimization
2. **Full Adapter Suite** - All dealer systems
3. **Production Hardening** - Load testing, CI/CD
4. **Advanced Features** - Multi-intent, complex queries

---

## Slide 16: Questions for Discussion

### Key Discussion Points

1. **Architecture Approval**
   - Do you approve Next.js full-stack architecture?
   - Benefits: Security, single codebase, scalability

2. **Demo Scope**
   - What are the 3-5 must-have features for demo?
   - Helps prioritize development

3. **Dealer Systems**
   - Which system first? (Tekion or CDK)
   - Focus on 1-2 for demo

4. **Demo Date**
   - Specific date for presentation?
   - Helps plan Week 12 timeline

5. **Budget**
   - OpenAI fine-tuning costs (12 models: 6 NLQ + 6 Agents)
   - Llama infrastructure planning
   - Monthly LLM usage estimates

6. **Success Metrics**
   - What would make demo successful?
   - How to measure value?

---

## Slide 17: Next Steps

### Immediate Actions

**Week 1 Requirements:**
- ✅ Supabase account setup
- ✅ Access to Tekion or CDK API (for testing)
- ✅ Design mockups/wireframes
- ✅ Database schema approval
- ✅ Architecture approval

**Parallel Work:**
- Domain expertise for fine-tuning dataset creation
- Sample dealer data (if available)
- Demo requirements clarification

---

## Slide 18: Summary

### Why This Approach Works

**Single Codebase:**
- Frontend + Backend in one Next.js project
- Easier deployment and maintenance
- Type-safe end-to-end

**Security First:**
- All credentials server-side
- No browser exposure of API keys
- RLS enforcement at database level

**Scalable Architecture:**
- Handles high-volume data pulls
- Supports multiple dealer systems
- Ready for production scaling

**AI-Native:**
- Fine-tuned models for accuracy
- Schema-aware SQL generation
- End-to-end NLQ pipeline

**3-Month Timeline:**
- MVP-first approach
- Incremental value delivery
- Demo-ready by Week 12

---
