# HRAFN Security & Risk Model

**See also:** [Security RLS](./security_rls.md) | [Logging & Auditing](./logging_auditing.md) | [Data Model](./data_model.md) | [Aggregates & Benchmarks](./aggregates_benchmarks_spec.md)

This document defines the security posture, threat model, and privacy controls for the HRAFN platform. It complements `docs/security_rls.md`, `docs/data_model.md`, and `docs/aggregates_benchmarks_spec.md`.

---

## 1. Security Objectives
- Protect dealer data from cross-dealer leakage.
- Enforce least privilege access across users, agents, and systems.
- Provide auditable access and actions.
- Ensure resilience and recovery against failures or attacks.

---

## 2. Threat Model

### Adversaries
- **Curious dealer**: attempts to access competitor data.
- **Compromised user account**: stolen credentials.
- **Compromised agent**: rogue or misconfigured agent code.
- **External attacker**: probing API or DB endpoints.
- **Insider threat**: malicious employee with elevated access.

### Attack Vectors
- SQL injection or template injection.
- RLS bypass via misconfigured policies.
- Cross-tenant joins in queries.
- Data exfiltration from storage buckets.
- Leakage through overly granular aggregates (N < 5).
- Privilege escalation in API gateway or Supabase roles.

---

## 3. Controls

### Authentication & Authorization
- JWT-based auth with dealer_id claim.
- Row Level Security (RLS) on all dealer-scoped tables.
- Role separation: `authenticated` vs `analytics`.
- Stored procedures and parameterized SQL templates only.

### Data Privacy
- K-anonymity enforced in aggregate tables (suppress N < 5).
- SELECT-only roles for aggregate tables.
- Snapshots are append-only and immutable.

### Storage & Secrets
- Secrets stored in environment variables, rotated regularly.
- Supabase object storage ACLs tied to dealer_id.
- No public buckets; signed URLs only.

### Logging & Auditing
- Logs include dealer_id or aggregate_id for traceability.
- Audit events for logins, query executions, policy changes.
- Retention policy: 1 year for audit logs.

---

## 4. Risk Scenarios & Mitigations

- **Cross-dealer leakage**: Prevented via RLS and aggregate-only queries.
- **SQL injection**: Prevented via parameterized templates and stored procs.
- **Re-identification through aggregates**: Mitigated by k-anonymity and cohorting.
- **Compromised agent**: Limited by least-privilege roles and audit alerts.
- **Insider misuse**: Controlled with role separation, access reviews, and logging.
- **Data exfiltration**: Prevented by strict ACLs and signed URLs.

---

## 5. Incident Response

- **Detection**: Monitor logs, anomaly alerts, and job failures.
- **Containment**: Revoke credentials, disable affected roles, block compromised agents.
- **Eradication**: Patch misconfigurations, rotate secrets, audit affected systems.
- **Recovery**: Restore from backups or snapshots, re-enable services.
- **Postmortem**: Document incident, root cause, mitigations, and prevention steps.

---

## 6. Governance

- Security reviews required for schema, RLS, and stored procedure changes.
- PR review process enforced for all code touching data flows.
- Quarterly access reviews of roles and permissions.
- Annual penetration testing.
- Alignment with SOC2 Type II controls over time.

## Change Log
- v0.1: Initial draft defining threat model, controls, and governance framework

---