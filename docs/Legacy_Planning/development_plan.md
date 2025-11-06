# HRAFN Development Plan: 3-Step Implementation Strategy

**See also:** [Architecture Overview](../docs/architecture_overview.md) | [Data Model](../docs/data_model.md) | [Security RLS](../docs/security_rls.md)

This document outlines a phased development approach for the HRAFN dealer intelligence platform, organized into three major steps that can be discussed with the client.

---

## Overview

The development plan is structured to deliver incremental value while building toward a demo-ready AI-native dealer intelligence platform within **3 months (12 weeks)**. Each step builds upon the previous one, with an MVP-first approach to ensure core functionality is delivered quickly.

**Important:** This is a **demo-focused timeline**. Production hardening and advanced features will follow after the demo phase.

---

## Architecture Decision: Next.js Full-Stack Framework

**Rationale:** This plan uses **Next.js as a full-stack framework** (frontend + backend in one codebase), not just a React frontend. This is essential for secure integrations with Tekion, CDK Global, and other dealer systems that require protected API keys, authentication, ETL orchestration, and data transformation.

**Critical:** React alone is insufficient for this project. Direct browser connections to external APIs would expose credentials, violate security best practices, and cannot handle the required ETL operations.

### Architecture Pattern

```
React (Next.js Frontend) → Next.js API Routes (Secure Backend) → External APIs + Supabase
```

**Data Flow:**

1. **Frontend (React/Next.js):** User interface, dashboard views, real-time updates
2. **Backend (Next.js API Routes):** All secure operations happen here:
   - Authentication with Tekion, CDK Global APIs (credentials stored in environment variables)
   - Data fetching from external dealer systems
   - Data transformation and normalization
   - Writing to Supabase using service role keys
   - ETL orchestration (scheduling, retries, monitoring)
   - Aggregate rollups and snapshot jobs
3. **Database (Supabase):** Central data store with RLS enforcement, authentication, real-time capabilities

### Security Benefits

- **No Credential Exposure:** API keys, tokens, and Supabase service keys stored in server-side environment variables (never in browser)
- **Secure External Integrations:** Tekion and CDK API calls happen exclusively in Next.js API routes, not from browser
- **No Direct Database Access:** Frontend never connects directly to Supabase; all access through Next.js API layer
- **Server-Side Validation:** All business logic, data validation, and transformation happen server-side
- **Enhanced RLS Security:** RLS policies enforced server-side with proper service role handling
- **API Gateway Pattern:** Centralized authentication, rate limiting, and security controls

### ETL & Integration Capabilities

- **Secure API Integrations:** Next.js API routes handle all Tekion/CDK authentication and data fetching
- **ETL Orchestration:** Server-side scheduling, retry logic, and monitoring for data sync jobs
- **Data Transformation:** Normalize and validate data server-side before writing to Supabase
- **Aggregate Processing:** Server-side aggregation jobs for benchmark tables
- **Background Jobs:** Support for long-running ETL processes and scheduled tasks
- **Error Handling & Logging:** Centralized server-side error tracking and audit logs

### Scalability & Performance

- **Server-Side Rendering (SSR):** Faster initial page loads and better SEO
- **API Route Caching:** Built-in caching strategies for frequently accessed data
- **Middleware Layer:** Ability to add caching, rate limiting, and request transformation
- **Better Error Handling:** Centralized error handling and logging
- **High-Volume Data Pulls:** Server-side execution handles large data volumes from Tekion/CDK

### Future-Proof Architecture

- **Single Codebase:** Frontend and backend in one Next.js project (simplifies deployment and maintenance)
- **Easy Integration:** Simple to add microservices, queues, or additional external APIs
- **Deployment Flexibility:** Can deploy to Vercel, AWS, or any Node.js hosting
- **Type Safety:** End-to-end type safety with TypeScript across API routes and frontend
- **Developer Experience:** Better tooling, debugging, and development workflow

### Technology Stack

- **Full-Stack Framework:** Next.js 14+ (App Router) - Frontend (React 18, TypeScript, shadcn/ui) + Backend (API Routes/Server Actions)
- **Backend Layer:** Next.js API Routes handle all secure operations:
  - External API integrations (Tekion, CDK Global) with secure credential storage
  - ETL orchestration and data transformation
  - Supabase writes using service role keys
- **Database:** Supabase (PostgreSQL) - accessed only through Next.js API routes
- **Authentication:** Next.js middleware + Supabase Auth (server-side)
- **External Integrations:** Tekion, CDK Global APIs - called exclusively from Next.js API routes
- **LLM/NLP:** OpenAI API for development/demo (switch to Llama for production) - server-side only
- **Real-time:** Supabase Realtime via Next.js API routes (polling or Server-Sent Events for demo)
- **Deployment:** Vercel (optimal Next.js hosting) or alternative Node.js hosting

---

## LLM Strategy: OpenAI → Llama Migration

**Development Phase (Demo):** Use **OpenAI API** for NLP tasks

- **Rationale:** Faster development, reliable API, good for prototyping
- **Use Cases:** NLQ parsing, recommendation generation, semantic search
- **Cost:** Pay-per-use API calls during development

**Production Phase:** Migrate to **Llama** (self-hosted or cloud)

- **Rationale:** Cost control, data privacy, no vendor lock-in
- **Benefits:** Lower long-term costs, full data control, customizable models
- **Migration Strategy:** Abstract LLM interface to enable easy switching

### Implementation Approach

- **LLM Abstraction Layer:** Create a unified interface/abstraction for LLM calls
- **Provider-Agnostic:** Design code to support multiple LLM providers
- **Easy Migration:** Switch providers by changing configuration, not code
- **Fallback Support:** Ability to fall back to OpenAI if Llama is unavailable

### Fine-Tuning Strategy: Core Focus for Agents & NLQ Pipeline

**Overview:** Fine-tune multiple specialized models for both the NLQ processing pipeline AND specialist agents to handle various user requirements accurately. Each agent needs domain-specific fine-tuning to understand its business context.

**Development Phase:** Fine-tune OpenAI models (gpt-3.5-turbo or gpt-4) for each task with domain-specific training data

**Production Phase:** Fine-tune corresponding Llama models with the same training datasets for consistency

**Total Models: 12 Fine-Tuned Models** (6 NLQ Pipeline + 6 Specialist Agents)

#### NLQ Pipeline Models (6 Models):

1. **Intent Classification Model**
   - **Purpose:** Classify user intent (e.g., query data, generate recommendation, compare benchmarks, update pricing)
   - **Training Data:** Natural language queries → intent categories
   - **Use Case:** Route query to appropriate handler or specialist agent

2. **Entity Extraction Model**
   - **Purpose:** Extract entities and parameters from natural language (e.g., vehicle types, date ranges, price ranges, dealer IDs)
   - **Training Data:** Natural language queries → structured entity extraction (JSON)
   - **Use Case:** Extract query parameters for downstream processing

3. **Query Planning Model**
   - **Purpose:** Generate query execution plan (determine which tables, joins, aggregations needed)
   - **Training Data:** Natural language queries + entities → query plan structure
   - **Use Case:** Plan multi-step queries and data retrieval strategy

4. **SQL Generation Model**
   - **Purpose:** Generate accurate SQL queries from natural language with schema awareness
   - **Training Data:** Natural language queries + schema context → SQL queries
   - **Use Case:** Convert user queries to executable SQL

5. **Recommendation Generation Model**
   - **Purpose:** Generate actionable recommendations based on query results and context
   - **Training Data:** Query results + context → recommendation text with rationale
   - **Use Case:** Generate pricing recommendations, inventory suggestions, etc.

6. **Response Formatting Model**
   - **Purpose:** Format query results and recommendations into user-friendly responses
   - **Training Data:** Raw results → formatted, conversational responses
   - **Use Case:** Generate natural language summaries and explanations

#### Specialist Agent Models (6 Models) - Domain-Specific Fine-Tuning:

1. **Inventory Agent Model**
   - **Purpose:** Specialized agent for inventory management, slow-moving stock, aging analysis
   - **Training Data:** Inventory-specific queries + business logic → inventory insights and recommendations
   - **Domain Expertise:** Days on lot, inventory velocity, pricing strategies, stock rotation
   - **Use Case:** Handle all inventory-related user requirements

2. **Sales Agent Model**
   - **Purpose:** Specialized agent for sales analysis, performance tracking, forecasting
   - **Training Data:** Sales-specific queries + business logic → sales insights and recommendations
   - **Domain Expertise:** Sales trends, conversion rates, lead quality, sales forecasting
   - **Use Case:** Handle all sales-related user requirements

3. **CRM Agent Model**
   - **Purpose:** Specialized agent for customer relationship management, lead management
   - **Training Data:** CRM-specific queries + business logic → CRM insights and recommendations
   - **Domain Expertise:** Lead scoring, customer segmentation, follow-up strategies
   - **Use Case:** Handle all CRM-related user requirements

4. **VM Agent Model (Vehicle Merchandising)**
   - **Purpose:** Specialized agent for vehicle merchandising, pricing optimization, promotions
   - **Training Data:** VM-specific queries + business logic → merchandising recommendations
   - **Domain Expertise:** Pricing strategies, promotional campaigns, vehicle positioning
   - **Use Case:** Handle all merchandising-related user requirements

5. **Web Comps Agent Model**
   - **Purpose:** Specialized agent for competitive intelligence, web scraping, market analysis
   - **Training Data:** Competitive intelligence queries + business logic → competitive insights
   - **Domain Expertise:** Competitor pricing, market trends, competitive positioning
   - **Use Case:** Handle all competitive intelligence requirements

6. **Incentives Agent Model**
   - **Purpose:** Specialized agent for OEM incentives, rebates, financing offers
   - **Training Data:** Incentive-specific queries + business logic → incentive optimization
   - **Domain Expertise:** Incentive effectiveness, rebate optimization, financing strategies
   - **Use Case:** Handle all incentive-related user requirements

#### Key Requirements:

- **Database schema documentation** and metadata for all models
- **Training datasets** for each model type (100-200+ examples per model minimum)
- **Domain-specific vocabulary** and business logic documentation for each agent
- **Agent-specific training data** that reflects real dealer business scenarios
- **Validation frameworks** for each model's output
- **Integration testing** to validate end-to-end NLQ pipeline and agent coordination
- **Agent orchestration** to route queries to appropriate specialist agents

---

## Step 1: Foundation & Data Infrastructure

**Goal:** Establish secure, scalable data foundation with basic dealer data ingestion and isolation.

**Timeline:** 3-4 weeks (Weeks 1-4)

### Core Deliverables (MVP Focus)

1. **Database Schema & Security** (Week 1)
   - Set up Supabase project with Postgres
   - Implement core dealer-scoped tables (`dealers`, `inventory_listings`, `offers`) - **MVP: focus on inventory + offers only**
   - Implement Row-Level Security (RLS) policies for dealer isolation
   - Create essential indexes (dealer_id, key lookups only)
   - Set up authentication with JWT claims for `dealer_id`
   - **Document database schema** for fine-tuning (table structures, relationships, field descriptions, constraints)
   - **Defer:** `sales_leads`, `sales_activity_history` for later phases

2. **Basic Data Ingestion** (Week 2)
   - Build minimal MCP adapter framework (structure for future adapters)
   - Implement **one working adapter** (prioritize inventory feed or DMS adapter - Tekion or CDK)
   - **Create Next.js API routes for adapter integration** (server-side only):
     - Secure API key storage in environment variables (never exposed to browser)
     - Authentication handling with external APIs (Tekion/CDK OAuth, tokens)
     - Data fetching from external APIs (server-side only)
     - Error handling and retry logic
   - Create basic normalization pipeline (server-side transformation in Next.js API routes)
   - Set up simple ETL jobs (Next.js API routes with scheduling via cron or manual trigger)
   - Write normalized data to Supabase using service role (server-side only)
   - **Defer:** Snapshot tables (can add in Step 3 if needed for demo)

3. **Frontend Foundation** (Week 3)
   - Set up Next.js 14+ project with App Router, TypeScript, and shadcn/ui
   - Configure Next.js authentication middleware (Supabase Auth integration)
   - Create **core dashboard pages** (inventory list, offers list) with server components
   - Implement client components for interactive UI elements
   - Basic navigation structure (single dealer view for demo)
   - Set up Next.js environment variables for API configuration
   - **Defer:** Multi-dealer context switching, advanced UI polish

4. **API Layer** (Week 4)
   - Set up Next.js API routes (`/api/inventory`, `/api/offers`, etc.)
   - Implement server-side Supabase client (service role for RLS enforcement)
   - Create API route handlers for basic read operations (GET requests)
   - Implement authentication middleware for API routes (JWT verification)
   - Set up basic error handling and logging in API routes
   - Implement data fetching patterns (Server Components + API routes)
   - **Defer:** Full CRUD operations, real-time subscriptions (can use polling for demo), advanced error handling

### Success Criteria

- ✅ Dealers can authenticate and view only their own data
- ✅ At least one dealer system can ingest inventory/offers data successfully
- ✅ Data is stored securely with RLS enforced server-side
- ✅ Basic dashboard displays dealer inventory and offers (via Next.js API routes)
- ✅ All database access happens server-side (no direct client connections)

### Dependencies

- Supabase account and project setup (Day 1)
- Access to at least one dealer system for testing (Week 1)
- Basic design mockups/wireframes (Week 1)

---

## Step 2: Intelligence Layer & Agentic Architecture

**Goal:** Enable AI-powered recommendations and insights using simplified agentic architecture with DRAGIN retrieval.

**Timeline:** 4-5 weeks (Weeks 5-9)

### Core Deliverables (Simplified MVP Approach)

1. **DRAGIN Retrieval Layer** (Week 5)
   - Implement basic vector index store (use Supabase pgvector extension)
   - Build simplified retriever that combines semantic + SQL queries
   - Create basic normalization schemas (focus on inventory/offers)
   - Set up minimal prompt library (3-5 core prompts)
   - **Create LLM abstraction layer** (interface for OpenAI, designed for future Llama migration)
   - Integrate OpenAI API for semantic search and NLP tasks
   - **Defer:** Advanced semantic search, complex query orchestration

2. **Agentic Passive Architecture (MVP)** (Week 6-7)
   - Implement **one specialist agent** (prioritize Inventory Agent) - **using fine-tuned model**
   - Build basic evidence store in Supabase (`recommendation_logs` table)
   - Create simplified orchestrator (single agent, no consensus needed for demo)
   - Set up agent routing logic (Intent Classification routes to appropriate agent)
   - Set up basic scheduled jobs (Supabase cron or simple scheduler)
   - Implement recommendation logs table
   - **Prepare for fine-tuning:** Design agent interfaces for fine-tuned model integration
   - **Defer:** Multiple specialist agents (will be added in Step 3 with their fine-tuned models), consensus mechanism, advanced scoring

3. **Aggregate Analytics Foundation** (Week 7)
   - Create **one aggregate table** (`aggregate_inventory_metrics` only)
   - Implement basic k-anonymity enforcement (suppress cells with N<5)
   - **Build ETL job for aggregate rollups** (Next.js API route with server-side processing):
     - Read from dealer-scoped tables using service role
     - Aggregate and anonymize data (server-side transformation)
     - Write to aggregate tables (server-side only)
     - Scheduling via cron or manual trigger (server-side orchestration)
   - Set up SELECT-only analytics role
   - **Fine-Tuning Data Preparation** (Week 7 - parallel work) - **CORE FOCUS**
     - Generate comprehensive database schema documentation (tables, columns, types, relationships, constraints)
     - **Create training datasets for NLQ Pipeline Models (6 models):**
       - Intent Classification: NLQ → intent categories (100-150 examples)
       - Entity Extraction: NLQ → structured entities (100-150 examples)
       - Query Planning: NLQ + entities → query plans (100-150 examples)
       - SQL Generation: NLQ + schema → SQL queries (100-200 examples)
       - Recommendation Generation: Query results → recommendations (100-150 examples)
       - Response Formatting: Raw results → formatted responses (100-150 examples)
     - **Create training datasets for Specialist Agent Models (6 models):**
       - Inventory Agent: Inventory queries + business logic → inventory insights (100-200 examples)
       - Sales Agent: Sales queries + business logic → sales insights (100-200 examples)
       - CRM Agent: CRM queries + business logic → CRM insights (100-200 examples)
       - VM Agent: Merchandising queries + business logic → VM recommendations (100-200 examples)
       - Web Comps Agent: Competitive queries + business logic → competitive insights (100-200 examples)
       - Incentives Agent: Incentive queries + business logic → incentive optimization (100-200 examples)
     - Document common query patterns, business logic, and domain vocabulary for EACH agent domain
     - Document agent-specific business rules and decision-making criteria
     - Prepare schema context templates for prompt engineering
     - Prepare domain-specific templates for each specialist agent
     - Validate all training examples (SQL queries, entity extractions, agent outputs) against actual database
     - Create test datasets for model validation (20-30 examples per model = 240-360 total test examples)
   - **Defer:** Multiple aggregate tables, benchmark baselines, advanced analytics

4. **NLQ Co-Pilot (Basic Demo)** (Week 8)
   - **Fine-Tune All OpenAI Models - CORE FOCUS** (Week 8 - early to mid)
     - Prepare fine-tuning datasets in OpenAI format (JSONL) for all 12 models
     - **Fine-tune NLQ Pipeline Models (6 models):**
       - Intent Classification model (gpt-3.5-turbo or gpt-4)
       - Entity Extraction model (gpt-3.5-turbo or gpt-4)
       - Query Planning model (gpt-3.5-turbo or gpt-4)
       - SQL Generation model (gpt-3.5-turbo or gpt-4) with schema-aware data
       - Recommendation Generation model (gpt-3.5-turbo or gpt-4)
       - Response Formatting model (gpt-3.5-turbo or gpt-4)
     - **Fine-tune Specialist Agent Models (6 models):**
       - Inventory Agent model (gpt-3.5-turbo or gpt-4) - domain-specific training
       - Sales Agent model (gpt-3.5-turbo or gpt-4) - domain-specific training
       - CRM Agent model (gpt-3.5-turbo or gpt-4) - domain-specific training
       - VM Agent model (gpt-3.5-turbo or gpt-4) - domain-specific training
       - Web Comps Agent model (gpt-3.5-turbo or gpt-4) - domain-specific training
       - Incentives Agent model (gpt-3.5-turbo or gpt-4) - domain-specific training
     - Validate each fine-tuned model with test datasets
     - Test end-to-end NLQ pipeline accuracy and safety
     - Test each specialist agent's domain expertise and recommendations
     - Test agent orchestration (routing queries to correct agents)
   - **Implement NLQ Processing Pipeline** using fine-tuned models (via LLM abstraction layer)
     - Intent classification step (route to appropriate handler)
     - Entity extraction step (extract query parameters)
     - Query planning step (determine execution strategy)
     - SQL generation step (generate executable queries)
     - Recommendation generation step (if applicable)
     - Response formatting step (format results for user)
   - Create Next.js API route for NLQ processing (`/api/nlq`) with multi-step pipeline
   - Integrate schema context into NLQ prompts (table structures, field descriptions)
   - Create 3-5 parameterized stored procedure templates (inventory-focused)
   - Build basic DRAGIN integration for context retrieval (server-side, using fine-tuned models)
   - Simple Munin agent integration for generating inventory recommendations (server-side, using fine-tuned models)
   - Basic NLQ UI component in dashboard (chat interface calling Next.js API)
   - **Query Validation & Safety** (RLS check, parameter sanitization, query explain before execution, intent validation)
   - **Defer:** Advanced NLQ parsing, multi-intent support, complex queries, additional fine-tuning iterations, additional model types

5. **MCP Adapters Expansion** (Week 9)
   - Add **one more adapter** (prioritize based on demo needs - likely Website/Competitor crawler or second DMS)
   - **All external API integrations in Next.js API routes:**
     - Secure credential storage (environment variables, server-side only)
     - Authentication with external systems (OAuth, API keys, tokens)
     - Data fetching and transformation (server-side only)
     - Error handling, retries, and monitoring
   - Implement basic web crawler for competitive intelligence (if needed for demo) - server-side only
   - Create Next.js API routes for all adapter integrations (no browser-based API calls)
   - Add simple async queue for action execution (Next.js API routes with background jobs or simple queue)
   - ETL monitoring and logging (server-side error tracking)
   - **Defer:** Multiple adapters, advanced retry logic, complex error handling, full ETL orchestration platform

### Success Criteria

- ✅ Inventory Agent can retrieve dealer data using DRAGIN
- ✅ Recommendations are generated and logged for inventory domain
- ✅ Aggregate inventory metrics table is populated (k-anonymity enforced)
- ✅ Basic NLQ queries work (e.g., "Show me slow-moving inventory", "Which vehicles need price adjustments?")
- ✅ At least 2 dealer system adapters are functional (inventory feed + one more)

### Dependencies

- Step 1 completed
- OpenAI API access and API key (for development/demo) - Week 5
- **OpenAI Fine-Tuning API access** (for model customization) - Week 7
- Supabase pgvector extension enabled - Week 5
- Access to dealer systems for testing - Week 6
- LLM abstraction layer designed and implemented (for future Llama migration) - Week 5
- Database schema documentation completed (for fine-tuning data preparation) - Week 7
- Domain expertise for creating accurate training examples for all models - Week 7
- **Multiple fine-tuning datasets** prepared (12 model types total):
  - 6 NLQ Pipeline models: intent, entity extraction, query planning, SQL, recommendations, response formatting
  - 6 Specialist Agent models: Inventory, Sales, CRM, VM, Web Comps, Incentives - Week 7
- **Agent domain expertise** - Access to experts in each domain (inventory, sales, CRM, merchandising, competitive intelligence, incentives) - Week 7

---

## Step 3: Demo Polish & Core Features

**Goal:** Complete demo-ready platform with core benchmarking, improved UI, and essential features.

**Timeline:** 3-4 weeks (Weeks 10-12)

### Core Deliverables (Demo-Focused)

1. **Basic Benchmarking** (Week 10)
   - Create basic benchmark baseline table (aggregate inventory metrics baseline)
   - Implement simple baseline math (percentiles, averages)
   - Build basic dealer comparison view (dealer vs. aggregate)
   - Simple benchmark refresh job (manual or nightly)
   - **Defer:** Advanced cohort analytics, anomaly detection, complex suppression rules

2. **Core NLQ Co-Pilot & Discount Flow** (Week 10-11)
   - Complete basic discount flow (NLQ → Next.js API → recommendation → display)
   - Create Next.js API routes for recommendation approval workflow
   - Simple recommendation approval workflow (UI calls Next.js API, no execution for demo)
   - Implement polling or Server-Sent Events for recommendation updates (via Next.js API)
   - Enhanced NLQ to support pricing questions (server-side processing)
   - **Defer:** Full action execution through adapters (can be simulated for demo)

3. **Enhanced Dashboard & UI** (Week 11)
   - Complete dealer dashboard pages (inventory, offers, recommendations) using Next.js Server Components
   - Basic aggregate dashboard with benchmarking visualizations (data via Next.js API routes)
   - Recommendation feed with polling or Server-Sent Events (via Next.js API)
   - Simple approval workflow UI (approve/reject buttons calling Next.js API routes)
   - Basic responsive design (desktop-first, mobile acceptable)
   - **Defer:** Full mobile optimization, advanced visualizations

4. **Essential Observability** (Week 11-12)
   - Basic audit logging (recommendation logs, key actions)
   - Simple monitoring (Supabase dashboard + basic error tracking)
   - Basic error tracking (console logs + Supabase logs)
   - **Defer:** Comprehensive monitoring, Huginn agent, advanced tracing

5. **Security Essentials** (Week 12)
   - RLS policies verified and tested (enforced server-side)
   - Basic rate limiting on Next.js API routes (using middleware or Next.js built-in)
   - Secrets management (Next.js environment variables, never exposed to client)
   - API route authentication middleware verified
   - Basic security review checklist
   - **Defer:** Full security risk model, PII scrubbing, KMS integration, penetration testing

6. **Demo Preparation** (Week 12)
   - Demo data preparation (sample dealer data, aggregate data)
   - Demo script and walkthrough
   - Performance optimization for demo scenarios (Next.js caching, API route optimization)
   - Basic deployment setup (Vercel for Next.js + Supabase)
   - Configure Vercel environment variables and deployment settings
   - Documentation for demo (quick start guide)
   - **Defer:** Full production hardening, load testing, disaster recovery, CI/CD automation

### Success Criteria

- ✅ Basic discount flow works (NLQ → recommendation → display → approval UI)
- ✅ Benchmarking comparisons are available and functional for demo
- ✅ Dashboard is polished and demo-ready
- ✅ Core security requirements met (RLS, basic rate limiting)
- ✅ Basic monitoring and error tracking in place
- ✅ Demo can be presented to client successfully

### Dependencies

- Step 2 completed
- Demo data prepared (Week 10)
- Client demo date confirmed (Week 12)
- Basic deployment infrastructure ready (Week 11)

---

## Risk Mitigation & Considerations

### Technical Risks

- **RLS Performance:** Monitor query performance with RLS enabled; may need query optimization (server-side)
- **OpenAI API Costs:** Implement caching and rate limiting in Next.js API routes to control OpenAI API costs during development
- **Fine-Tuning Quality:** 12 fine-tuned models may need iterations; ensure sufficient training data (100-200+ examples per model)
- **Agent Domain Expertise:** Each specialist agent needs domain-specific training data; requires access to domain experts
- **Model Coordination:** Multiple models in pipeline + multiple agents must work together correctly; end-to-end testing critical
- **Agent Orchestration:** Proper routing of queries to appropriate specialist agents requires accurate intent classification
- **SQL Generation Accuracy:** Generated SQL queries must be validated for correctness, safety, and RLS compliance
- **Intent Classification Accuracy:** Incorrect intent classification can route queries to wrong handlers
- **Entity Extraction Accuracy:** Missing or incorrect entities can cause query failures
- **Schema Changes:** Fine-tuned models (especially SQL generation) need retraining if database schema changes significantly
- **Llama Migration:** Plan for Llama integration early (abstraction layer) to ensure smooth production migration; fine-tuning data will be reusable
- **Adapter Reliability:** Build robust error handling and retry logic in Next.js API routes for external system integrations
- **Next.js Learning Curve:** Team familiarity with Next.js App Router and Server Components (mitigate with training/resources)

### Business Risks

- **Dealer Onboarding:** Ensure smooth onboarding process for dealers to connect their systems
- **Data Privacy:** Maintain strict compliance with data privacy regulations
- **Scalability:** Plan for horizontal scaling as dealer count grows

### Dependencies Management

- **External Systems:** Ensure reliable access to dealer systems (DMS, CRM, etc.)
- **LLM Providers:**
  - **Development:** OpenAI API access and budget allocation (including fine-tuning costs for 12 models)
  - **Fine-Tuning Data:** Access to domain experts to create accurate training examples:
    - NLQ Pipeline models (intent, entity extraction, query planning, SQL, recommendations, response formatting)
    - Specialist Agent models (Inventory, Sales, CRM, VM, Web Comps, Incentives) - requires domain experts for each agent
  - **Production:** Llama infrastructure planning (self-hosted or cloud deployment)
  - Fine-tuning dataset will be reusable for Llama fine-tuning
  - Implement fallback mechanism (OpenAI as backup if Llama unavailable)
- **Infrastructure:** Monitor Supabase and Vercel usage limits (Next.js hosting)
- **Next.js Version:** Ensure team is comfortable with Next.js 14+ App Router architecture

---

## Timeline Summary

| Step                     | Duration        | Key Milestones                                   | Weeks        |
| ------------------------ | --------------- | ------------------------------------------------ | ------------ |
| **Step 1: Foundation**   | 3-4 weeks       | RLS working, Data ingestion, Basic dashboard     | 1-4          |
| **Step 2: Intelligence** | 4-5 weeks       | Agents active, NLQ working, Aggregates populated | 5-9          |
| **Step 3: Demo Polish**  | 3-4 weeks       | Discount flow, Benchmarking, Demo-ready          | 10-12        |
| **Total**                | **10-13 weeks** | **Demo-ready HRAFN platform**                    | **3 months** |

### Key Timeline Notes

- **Week 4:** Internal milestone - Foundation complete, data flowing
- **Week 9:** Internal milestone - Intelligence layer operational
- **Week 12:** **Demo delivery** - Client presentation ready

---

## Questions for Client Discussion

1. **Architecture Approval:** Do you approve of the Next.js server-side architecture? (Benefits: better security, scalability, no direct DB access from frontend)
2. **Demo Scope:** What are the 3-5 must-have features for the demo? (This will help us prioritize)
3. **Dealer Systems:** Which dealer system should we prioritize for the first adapter? (We'll focus on 1-2 for demo)
4. **Demo Date:** Is there a specific date for the demo presentation? (This will help us plan Week 12)
5. **Demo Data:** Can you provide sample dealer data for the demo, or should we use synthetic data?
6. **Budget Considerations:**
   - OpenAI API costs during development/demo (pay-per-use)
   - OpenAI Fine-Tuning costs for multiple models (12 models × one-time training cost, typically $0.008-$0.03 per 1K tokens per model)
   - Budget for Llama infrastructure in production (self-hosted or cloud service)
   - Budget for Llama fine-tuning for all 12 models (if using cloud service)
   - Estimated monthly LLM usage for planning (multiple model calls per query - NLQ pipeline + agent models)
   - Time investment for creating fine-tuning datasets (12 model types × 100-200 examples each = 1,200-2,400 total examples)
   - Domain expert consultation for agent-specific training data creation
7. **Hosting Preferences:** Any preferences for hosting? (Vercel recommended for Next.js, but open to alternatives)
8. **Success Metrics:** What would make the demo successful in your eyes?
9. **Post-Demo Plans:** What happens after the demo? (This helps us understand if we need production features now or later)

## Post-Demo Phase (Beyond 3 Months)

After the demo, the following features can be prioritized based on client feedback:

### Priority 1: Production Migration

- **Llama Integration:** Migrate from OpenAI to Llama for production
  - Set up Llama infrastructure (self-hosted or cloud)
  - Fine-tune Llama model using the same training dataset (reuse from development)
  - Test and validate Llama performance vs OpenAI (SQL generation accuracy)
  - Validate fine-tuned Llama model with test queries
  - Update LLM abstraction layer with Llama provider
  - Performance optimization for Llama deployment
  - Cost analysis and comparison
- **Fine-Tuning Enhancement:**
  - Expand training datasets for all 12 models (500+ examples per model = 6,000+ total examples)
  - Iterate on fine-tuning for each model based on production feedback
  - Enhance agent domain expertise with more specialized training data
  - Add support for complex queries and multi-intent handling
  - Continuous improvement of all model accuracies:
    - NLQ Pipeline models (intent classification, entity extraction, SQL generation, etc.)
    - Specialist Agent models (domain-specific accuracy for each agent)
  - Add additional specialized agents as needed (e.g., Service Agent, Parts Agent)
  - Optimize model pipeline and agent orchestration for performance and cost (caching, model selection strategies, agent routing)

### Priority 2: Platform Enhancement

- **Full Production Hardening:** Load testing, disaster recovery, CI/CD
- **Additional Agents:** Sales Agent, CRM Agent, VM Agent, etc.
- **Advanced NLQ:** Multi-intent support, complex queries
- **Complete Adapter Suite:** All dealer system integrations
- **Advanced Benchmarking:** Cohort analytics, anomaly detection

### Priority 3: Security & Operations

- **Full Security:** Complete security risk model, PII scrubbing, KMS
- **Sales & Leads:** Sales leads and activity history tables
- **Mobile Optimization:** Full responsive design
- **Monitoring & Observability:** Comprehensive logging, alerting, tracing
