# HRAFN ETL Schedule

**See also:** [Aggregates & Benchmarks](./aggregates_benchmarks_spec.md) | [Data Model](./data_model.md) | [Logging & Auditing](./logging_auditing.md) | [Architecture Overview](./architecture_overview.md)

This document defines the batch and streaming ETL jobs that populate dealer tables, aggregate tables, and benchmark baselines.

## 1. Goals

- Maintain fresh, consistent dealer and aggregate data.
- Support daily benchmarking and anomaly detection.
- Provide deterministic refresh times for dashboards and AI agents.

## 2. Job Categories

- **Dealer Ingest Jobs**
  - Source: CDK, CRM, Inventory feeds, OEM incentive scrapers.
  - Frequency: Near-real-time or hourly.
  - Target: Dealer-scoped fact tables (`sales_leads`, `inventory`, `fi_sales`, `sales_activity_history`).
  - Notes: Enforce RLS, audit logs.

- **Aggregate Rollup Jobs**
  - Source: Dealer fact tables.
  - Frequency: Nightly (02:00 UTC).
  - Target: `aggregate_inventory_metrics`, `aggregate_offer_performance`.
  - Notes: Enforce k-anonymity, SELECT-only role.

- **Benchmark Baseline Jobs**
  - Source: Aggregate tables.
  - Frequency: Nightly (03:00 UTC, after aggregates).
  - Target: `benchmarks_baselines`, `benchmarks_scores`.
  - Notes: Compute percentiles, z-scores, anomaly scores.

- **Snapshot Jobs**
  - Source: Dealer fact tables.
  - Frequency: Daily append-only.
  - Target: `_snapshots` schema (partitioned by day).
  - Notes: Enables historical comparisons.

- **Hot Metric Incremental Jobs**
  - Source: Dealer fact tables.
  - Frequency: Every 15 minutes.
  - Target: Materialized views (e.g., current incentive redemption rate).
  - Notes: Cached for dashboards.

## 3. Orchestration

- Scheduler: Temporal or Supabase cron.
- Ordering:
  1. Dealer ingest jobs
  2. Aggregate rollups
  3. Benchmark baselines
  4. Snapshots
- Retries: Exponential backoff, alert on >3 failures.
- Backfill: Supported for historical dates.

## 4. Monitoring

- Logs stored with dealer_id or aggregate_id.
- Metrics: job success rate, runtime, data freshness lag.
- Alerts: Slack + email on job failure or data drift.

## 5. Governance

- Ownership: Data Engineering.
- Changes to schedule require PR + sign-off.
- Aligns with `docs/aggregates_benchmarks_spec.md` and `docs/security_rls.md`.

## Change Log

- v0.1: Initial draft defining ETL job categories, orchestration, and monitoring strategy

---
