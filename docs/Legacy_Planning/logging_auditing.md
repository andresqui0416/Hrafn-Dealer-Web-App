# HRAFN Logging & Auditing

**See also:** [Security RLS](./security_rls.md) | [Security Risk Model](./security_risk_model.md) | [ETL Schedule](./etl_schedule.md) | [Data Model](./data_model.md)

This document defines the logging and auditing strategy for the HRAFN platform. It complements `docs/security_rls.md`, `docs/security_risk_model.md`, and `docs/etl_schedule.md`.

---

## 1. Objectives

- Provide complete traceability of user and agent actions.
- Detect anomalies, breaches, and misuse in real time.
- Support compliance (SOC2, GDPR) and incident response.
- Retain logs for forensic analysis.

---

## 2. Log Schema

### Core Fields

- `timestamp` (ISO8601, UTC)
- `event_id` (ulid/uuid)
- `actor_id` (user_id, agent_id, or system component)
- `actor_role` (dealer_user, oem_user, agent, admin, system)
- `dealer_id` (nullable, uuid)
- `aggregate_id` (nullable, cohort/region identifier)
- `action` (login, query_exec, job_start, job_end, policy_change, data_export)
- `status` (success, failure, warning)
- `latency_ms` (optional, numeric)
- `metadata` (JSONB: parameters, query plan_id, error codes)

### Sensitive Data Handling

- No PII or raw query text stored.
- Parameterized queries only; log plan_id not SQL string.
- Redact tokens, passwords, or secrets.

---

## 3. Audit Events

- **Authentication**
  - login_success / login_failure
  - token_refresh
- **Data Access**
  - query_exec (dealer vs aggregate domain)
  - RLS_policy_violation (blocked attempt)
- **System**
  - job_start / job_end (ETL, scrapers)
  - job_failure
- **Admin**
  - policy_change
  - role_grant / role_revoke
  - schema_change

---

## 4. Storage & Retention

- Logs written to Supabase Postgres `audit_log` table (append-only).
- ETL exports logs to object storage daily.
- Retention:
  - Hot storage: 90 days
  - Cold archive: 1 year
- Immutable once written; deletion only via retention policy.

---

## 5. Monitoring & Alerting

- Metrics derived from logs:
  - login failures > threshold
  - anomalous query volumes
  - ETL job failures
- Alerts sent via Slack + PagerDuty.
- Anomaly detection jobs scan logs nightly.

---

## 6. Access Control

- Read access:
  - Security team, admins only.
- Write access:
  - Append-only from application and ETL services.
- No deletes/updates allowed.

---

## 7. Governance

- Schema and retention reviewed quarterly.
- Access audits conducted monthly.
- Log integrity checksums verified nightly.
- Incident reports must include relevant audit log extracts.

## Change Log

- v0.1: Initial draft defining logging schema, audit events, and monitoring strategy

---
