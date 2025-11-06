# HRAFN Discount Flow: NLQ Co-Pilot Example

**See also:** [NLQ Planner](./nlq_planner_spec.md) | [Architecture Overview](./architecture_overview.md) | [Agentic Passive](./agentic_passive.md) | [Data Model](./data_model.md)

This document illustrates an end-to-end natural language query flow for dealer pricing recommendations.

```mermaid
sequenceDiagram
  autonumber
  participant GM as Dealer GM
  participant UI as Dealer Copilot
  participant API as Edge API
  participant SB as Supabase
  participant NLQ as NLQ Parser Planner
  participant RQ as DRAGIN Retriever
  participant MUN as Munin Agent
  participant MCP as MCP Adapters
  participant DMS as DMS CRM Inventory
  participant WEB as Web Competitor Sites

  %% 1) User asks a natural language question
  GM->>UI: "Which SUVs should we discount this week?"

  %% 2) UI sends authenticated NLQ request
  UI->>API: POST to nlq endpoint with jwt and prompt

  %% 3) Parse NLQ to an executable plan (metrics, filters, SQL + retrieval)
  API->>NLQ: Parse intent to entities and constraints
  NLQ-->>API: Return plan with proc template and features

  %% 4) Retrieve dealer-scoped context (RLS applies)
  API->>RQ: Execute plan
  RQ->>SB: CALL sp_my_inventory_sales_age with filters
  SB-->>RQ: Result set dealer-scoped RLS enforced
  RQ->>MCP: Fetch competitor prices and incentives
  MCP-->>WEB: Crawl and Query
  WEB-->>MCP: Competitive data
  MCP-->>RQ: Normalized comps
  RQ-->>API: Consolidated dataset

  %% 5) Generate recommendations
  API->>MUN: Build pricing recs with context
  MUN->>SB: INSERT recommendations and logs

  %% 6) Stream results to UI
  UI->>SB: Subscribe to recommendations with RLS
  SB-->>UI: Return recommendation results
  UI-->>GM: Show ranked actions with rationale

  %% 7) Approval and execution
  GM->>UI: Approve selected actions
  UI->>API: POST price_update with rec_ids
  API->>MCP: Enqueue adapter jobs idempotent
  MCP-->>DMS: Apply price changes
  MCP-->>API: Webhook executed
  API->>SB: UPDATE recommendation_logs status executed
  UI-->>GM: Confirmed audit trail available
```

**Legend:**

- **Dealer GM**: Dealer General Manager (user)
- **Dealer Copilot**: Natural language query interface (NLQ UI)
- **Edge API**: Supabase Edge Function API
- **Supabase**: Postgres database with RLS
- **NLQ Parser Planner**: Natural language query parser and planner
- **DRAGIN Retriever**: Distributed RAG retrieval orchestrator
- **Munin Agent**: Recommendation and action agent (recs)
- **MCP Adapters**: Model Context Protocol adapters
- **DMS CRM Inventory**: Dealer Management System, CRM, and Inventory systems
- **Web Competitor Sites**: Web scraping for competitor analysis

## Change Log

- v0.1: Initial draft defining end-to-end NLQ co-pilot flow for pricing recommendations
