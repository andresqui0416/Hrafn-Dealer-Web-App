# HRAFN Documentation

Central reference for HRAFN architecture, security, and agentic flows.

---

## Table of Contents

### Security & Governance

- **[Security RLS](./security_rls.md)** — Comprehensive RLS policies, authentication flows, JWT structure, API security, and secrets management for dealer data isolation
- **[Security Risk Model](./security_risk_model.md)** — Threat model, attack vectors, security controls, risk scenarios, and incident response procedures
- **[Logging & Auditing](./logging_auditing.md)** — Audit log schema, event types, retention policies, monitoring strategy, and compliance requirements

### Data Model & ETL

- **[Data Model](./data_model.md)** — Authoritative schema reference with dealer-scoped tables, aggregate intelligence tables, RLS policies, and indexing strategy
- **[Aggregates & Benchmarks Spec](./aggregates_benchmarks_spec.md)** — Cross-dealer aggregation, k-anonymity enforcement, benchmark baselines, and refresh cadence
- **[ETL Schedule](./etl_schedule.md)** — Batch and streaming ETL jobs, orchestration flow, monitoring, and data freshness SLAs
- **[Metrics Catalog](./metrics_catalog.md)** — Canonical metric definitions for dealer-scoped, aggregate, and benchmark domains with consistent grain specifications

### Planner & Procs

- **[NLQ Planner Spec](./nlq_planner_spec.md)** — Natural language to query planning layer, parameterized stored procedures, privacy gates, and template catalog
- **[Stored Procs Catalog](./stored_procs_catalog.md)** — Canonical stored procedures for dealer-scoped queries, aggregate analytics, and benchmark comparisons

### Agentic Flows

- **[Agentic Passive](./agentic_passive.md)** — V1.0 core agentic architecture with specialist agents, evidence store, and orchestration flow
- **[Agentic Passive Benchmarks](./agentic_passive_benchmarks.md)** — V1.1 enhanced architecture with benchmarking, baseline math, suppression rules, and cohort analytics
- **[Discount Flow](./discount_flow.md)** — End-to-end NLQ co-pilot example for dealer pricing recommendations with approval and execution workflow

### Architecture

- **[Architecture Overview](./architecture_overview.md)** — Comprehensive system architecture diagrams showing AI-native platform, DRAGIN retrieval, MCP adapters, and data flows

---

## Additional Resources

- **[Database Schema](./database_schema.md)** — Detailed database schema with migrations, indexes, and RLS policies
- **[Runbooks](./runbooks.md)** — Operational runbooks for ingestion, deployment, and troubleshooting

---

## Contribution Guidelines

All changes must go through PR review with Security and Data Engineering sign-off.

### Review Requirements
- **Schema Changes**: Require Data Engineering and Security review
- **RLS Policy Changes**: Require Security team approval
- **Stored Procedure Changes**: Require Data Engineering sign-off
- **Documentation Updates**: Maintain cross-links and change logs

### Style Guide
- Use "HRAFN" in all caps consistently
- Define abbreviations on first use
- Keep prose concise and bulleted where possible
- Maintain consistent section headers (`##`, `###`)
- Add cross-links at the top of each document
- Include change log at the bottom of each document
