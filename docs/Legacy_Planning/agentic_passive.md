# HRAFN Agentic Passive Architecture (V1.0)

**See also:** [Agentic Passive Benchmarks](./agentic_passive_benchmarks.md) | [Architecture Overview](./architecture_overview.md) | [Discount Flow](./discount_flow.md) | [Data Model](./data_model.md)

See [agentic_passive_benchmarks.md](./agentic_passive_benchmarks.md) for the V1.1 version with benchmarking capabilities.

```mermaid
flowchart LR
  subgraph Schedulers["Schedulers"]
    CRON[Cron Temporal Cloud scheduler]
  end

  subgraph Integrations["Adapters via MCP"]
    DMS[DMS]
    CRM[CRM]
    INV[Inventory]
    VM[Vehicle Merchandising]
    WEB[Website Comps]
    INC[OEM Incentives]
    PUB[Public Data]
  end

  subgraph Specialists["Specialist Agents"]
    A_SALES[Sales Agent]
    A_INV[Inventory Agent]
    A_VM[VM Agent]
    A_CRM[CRM Agent]
    A_WEB[Web Comps Agent]
    A_INC[Incentives Agent]
  end

  subgraph Evidence["Evidence Store Supabase"]
    PG[(Postgres facts findings)]
    AGG[(Aggregate Tables benchmarks rollups)]
    OBJ[(Object Storage snapshots)]
  end

  subgraph Orchestration["Orchestrator"]
    EVAL[Aggregator + Scoring]
    CONS[Consensus N-of-M]
    RECS[Recommendations Builder]
  end

  subgraph Delivery["Delivery Control"]
    ALERT[Alerts Notifications]
    Q[Action Queue]
    UI[Dealer Dashboard]
  end

  CRON --> A_SALES
  CRON --> A_INV
  CRON --> A_VM
  CRON --> A_CRM
  CRON --> A_WEB
  CRON --> A_INC

  DMS --> A_SALES
  CRM --> A_CRM
  INV --> A_INV
  VM --> A_VM
  WEB --> A_WEB
  INC --> A_INC
  PUB --> A_WEB

  A_SALES --> PG
  A_INV --> PG
  A_VM --> PG
  A_CRM --> PG
  A_WEB --> PG
  A_INC --> PG
  A_SALES --> OBJ
  A_INV --> OBJ
  A_VM --> OBJ
  A_CRM --> OBJ
  A_WEB --> OBJ
  A_INC --> OBJ
  AGG --> EVAL
  AGG --> CONS

  PG --> EVAL
  OBJ --> EVAL
  EVAL --> CONS
  CONS --> RECS
  RECS --> UI
  EVAL --> ALERT
  RECS --> Q
```

**Legend:**

- **Cron Temporal Cloud scheduler**: Scheduled job orchestration (Cron, Temporal, or cloud scheduler)
- **Website Comps**: Website and competitor analysis
- **Web Comps Agent**: Agent for web scraping and competitive intelligence
- **Evidence Store Supabase**: Supabase-based evidence storage
- **Postgres facts findings**: PostgreSQL database storing facts and findings
- **Aggregate Tables benchmarks rollups**: Aggregate tables for benchmarks and rollups
- **Object Storage snapshots**: Object storage for historical snapshots
- **Aggregator + Scoring**: Evidence aggregation and scoring engine
- **Consensus N-of-M**: N-of-M consensus mechanism for agent decisions
- **Alerts Notifications**: Alert and notification system
- **Action Queue**: Queue for pending actions

## Change Log

- v0.1: Initial draft defining core agentic architecture with specialist agents and orchestration flow
