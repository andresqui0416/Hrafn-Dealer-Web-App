# HRAFN Metrics Catalog

**See also:** [Data Model](./data_model.md) | [Aggregates & Benchmarks](./aggregates_benchmarks_spec.md) | [Stored Procedures](./stored_procs_catalog.md) | [NLQ Planner](./nlq_planner_spec.md)

This document defines the canonical metrics available across dealer and aggregate domains. All metric definitions must be consistent and reused in aggregates, benchmarks, and dashboards.

## 1. Principles

- **Single Source of Truth**: Every metric defined here is authoritative.
- **Consistency**: Metrics used in dealer dashboards and aggregate benchmarks must match.
- **Grain**: Metrics specify grain (dealer/day/region).
- **Governance**: Changes require PR review.

## 2. Dealer-Scoped Metrics

- **sales_volume**
  - Definition: Count of vehicles sold.
  - Grain: dealer_id + day
  - Source: `fi_sales`

- **gross_profit**
  - Definition: Sale price minus dealer cost (excludes incentives).
  - Grain: dealer_id + day
  - Source: `fi_sales`

- **inventory_turn**
  - Definition: Vehicles sold ÷ average inventory on lot.
  - Grain: dealer_id + month
  - Source: `inventory`, `fi_sales`

- **lead_conversion_rate**
  - Definition: Converted leads ÷ total leads.
  - Grain: dealer_id + week
  - Source: `sales_leads`, `sales_activity_history`

## 3. Aggregate Metrics

- **avg_days_on_lot**
  - Definition: Average time a vehicle spends in inventory before sale.
  - Grain: region + day
  - Source: `aggregate_inventory_metrics`

- **median_price**
  - Definition: Median transaction price for vehicles sold.
  - Grain: region + day
  - Source: `aggregate_inventory_metrics`

- **avg_discount_pct**
  - Definition: Average percentage discount from MSRP to transaction price.
  - Grain: region + day
  - Source: `aggregate_offer_performance`

- **redemption_rate**
  - Definition: Incentive redemptions ÷ offers available.
  - Grain: region + day
  - Source: `aggregate_offer_performance`

## 4. Benchmark Metrics

- **percentiles (p10, p25, p50, p75, p90)**
  - Definition: Distributional values for key metrics (e.g., sales_volume, gross_profit).
  - Grain: cohort_id + day
  - Source: `benchmarks_baselines`

- **zscore**
  - Definition: Standardized score vs baseline mean/std.
  - Grain: cohort_id + day
  - Source: `benchmarks_scores`

- **anomaly_score**
  - Definition: Drift score based on deviation from expected pattern.
  - Grain: cohort_id + day
  - Source: `benchmarks_scores`

## 5. Future Metrics (Planned)

- Service/parts gross
- F&I penetration rate
- Digital lead response time

## Change Log

- v0.1: Initial draft defining dealer-scoped, aggregate, and benchmark metrics with consistent grain specifications

---
