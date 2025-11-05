# HRAFN Stored Procedures Catalog

**See also:** [NLQ Planner](./nlq_planner_spec.md) | [Security RLS](./security_rls.md) | [Data Model](./data_model.md) | [Aggregates & Benchmarks](./aggregates_benchmarks_spec.md) | [Metrics Catalog](./metrics_catalog.md)

This document lists the canonical stored procedures available in the HRAFN data platform. All NLQ planner calls must map to one of these procedures or to allow‑listed SQL templates.

> This catalog must remain consistent with: `docs/security_rls.md`, `docs/data_model.md`, `docs/aggregates_benchmarks_spec.md`, `docs/nlq_planner_spec.md`, and `docs/metrics_catalog.md`.

---

## 1. Dealer‑Scoped Procedures (RLS enforced)

### sp_my_sales_by_model
```
CALL sp_my_sales_by_model(dealer uuid, start date, end date);
RETURNS TABLE(model text, sales int);
```
- Scope: Current dealer only (RLS).
- Purpose: Show sales counts grouped by model.
- Notes: Supports dealer dashboards.

### sp_my_gross_by_day
```
CALL sp_my_gross_by_day(dealer uuid, start date, end date);
RETURNS TABLE(day date, gross_profit numeric);
```
- Scope: Current dealer only.
- Purpose: Track daily gross profit trends.

---

## 2. Aggregate Procedures (cross‑dealer, anonymized)

### sp_aggregate_sales_trend
```
CALL sp_aggregate_sales_trend(region text, segment text, start date, end date);
RETURNS TABLE(day date, sales int);
```
- Scope: Aggregate only (no dealer_id).
- Purpose: Track segment sales over time by region.
- Notes: Enforces k‑anonymity.

### sp_inventory_turns
```
CALL sp_inventory_turns(region text, start date, end date);
RETURNS TABLE(month date, avg_turn numeric);
```
- Scope: Aggregate.
- Purpose: Benchmark inventory efficiency.

### sp_offer_lift
```
CALL sp_offer_lift(region text, incentive_type text, start date, end date);
RETURNS TABLE(day date, avg_discount_pct numeric, redemption_rate numeric);
```
- Scope: Aggregate.
- Purpose: Evaluate incentive effectiveness.

---

## 3. Benchmark Procedures

### sp_benchmark_percentiles
```
CALL sp_benchmark_percentiles(cohort_id text, metric text, start date, end date);
RETURNS TABLE(day date, p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric);
```
- Scope: Aggregate cohort baselines.
- Purpose: Provide percentile values for benchmarking.

### sp_benchmark_scores
```
CALL sp_benchmark_scores(cohort_id text, metric text, start date, end date);
RETURNS TABLE(day date, value numeric, zscore numeric, anomaly_score numeric);
```
- Scope: Aggregate cohort baselines.
- Purpose: Detect anomalies and relative performance vs peers.

---

## 4. Governance
- Versioning: Procedures are versioned (`_v1`, `_v2`) when signatures change.
- Deprecation: Deprecated procedures must be marked and retained until dashboards and agents migrate.
- Review: All procedure changes require review by Data Engineering and Security.

## Change Log
- v0.1: Initial draft defining dealer-scoped, aggregate, and benchmark stored procedures with RLS enforcement

---