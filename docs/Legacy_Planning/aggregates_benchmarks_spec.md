# HRAFN Aggregates & Benchmarks Specification

**See also:** [Data Model](./data_model.md) | [Security RLS](./security_rls.md) | [ETL Schedule](./etl_schedule.md) | [Metrics Catalog](./metrics_catalog.md)

This document defines how dealer data is aggregated, anonymized, and benchmarked for cross-dealer and regional intelligence.

## 1. Purpose

- Enable safe cross-dealer comparisons without leaking individual dealer performance.
- Support region, cohort, and industry-level metrics.
- Provide stable baselines for AI agents and dashboards.

## 2. Aggregate Tables

- **aggregate_inventory_metrics**
  - Keys: `day`, `region`, `vehicle_segment`
  - Metrics: `avg_days_on_lot`, `median_price`, `inventory_turn`
  - Notes: Partition by `day`, enforce k-anonymity (suppress N<5).

- **aggregate_offer_performance**
  - Keys: `day`, `region`, `incentive_type`
  - Metrics: `avg_discount_pct`, `redemption_rate`, `effective_lift`
  - Notes: SELECT-only role, refreshed nightly.

- **benchmarks_baselines**
  - Keys: `day`, `cohort_id`, `metric`
  - Metrics: `p10`, `p25`, `p50`, `p75`, `p90`
  - Notes: Used for percentile-based benchmarking.

- **benchmarks_scores**
  - Keys: `day`, `cohort_id`, `metric`
  - Metrics: `value`, `zscore`, `anomaly_score`
  - Notes: Enables drift detection and anomaly alerts.

## 3. Snapshot Policy

- Daily snapshots of dealer data feed aggregate tables.
- Stored in append-only form for historical comparisons.
- ETL jobs handle refresh and backfill.

## 4. Access & Security

- Aggregate tables drop `dealer_id`.
- Queries restricted to analytics roles.
- Policies enforce SELECT-only access.
- All aggregates must pass k-anonymity rules.

## 5. Integration with Agents

- NLQ → Planner → Parameterized stored procedure → Aggregate table.
- No direct dealer-level joins in aggregate queries.
- Agents can query baselines (e.g., "How is my SUV sales vs peers last month?").

## 6. Refresh Cadence

- Nightly full refresh via ETL.
- Incremental updates allowed for hot metrics (inventory turns, incentive redemptions).
- Materialized views may be used for speed.

## 7. Governance

- Metrics defined in `docs/metrics_catalog.md`.
- RLS for dealer tables defined in `docs/security_rls.md`.
- Stored procedures catalogued in `docs/stored_procs_catalog.md`.

## Change Log

- v0.1: Initial draft defining aggregate tables, security policies, and refresh cadence

---
