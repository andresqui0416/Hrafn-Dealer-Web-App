# HRAFN Operational Runbooks

_This runbook is for alpha V0.0; older CDK/OEM steps have been removed._

This document provides step-by-step procedures for common operational tasks, troubleshooting, and maintenance activities.

## Database Operations

### Reset Database to Clean State

```bash
# Navigate to supabase directory
cd supabase

# Reset database (applies all migrations)
supabase db reset

# Verify migrations applied
supabase db diff --schema public
```

**When to use**: Fresh development setup, after schema changes, or to resolve migration conflicts.

### Apply New Migrations

```bash
# Create new migration
supabase migration new your_migration_name

# Edit the generated SQL file in supabase/migrations/

# Apply migration
supabase db push

# Verify in production
supabase db diff --linked
```

### Seed Test Data

```bash
# Run seed scripts for dealers, inventory, offers, and leads
# Example seed files located in supabase/seed/
# Run database reset with seed
supabase db reset --seed

# Alternatively, seed specific data sets individually using appropriate SQL or scripts
```

### Backup Database

```bash
# Local backup
pg_dump -h localhost -p 54322 -U postgres postgres > backup_$(date +%Y%m%d).sql

# Production backup (via Supabase dashboard)
# Go to Settings > Database > Backups
# Download latest backup or create new one
```

### Restore Database

```bash
# From backup file
psql -h localhost -p 54322 -U postgres -d postgres < backup_20240115.sql

# Reset to specific migration
supabase db reset --to 20250811000005
```

## Edge Functions Deployment

### Deploy All Functions

```bash
# CI namespace - ingestion
supabase functions deploy ci_ingest_snapshot
supabase functions deploy ci_ingest_offers
supabase functions deploy ci_ingest_inventory

# CI namespace - queries
supabase functions deploy ci_get_offers
supabase functions deploy ci_get_competitor_overview

# Dealer adapters (placeholders)
supabase functions deploy dealer_ingest_inventory
supabase functions deploy dealer_ingest_offers
supabase functions deploy dealer_ingest_leads

# Recommendation logging functions (placeholders)
supabase functions deploy recommendation_log
```

### Deploy Single Function

```bash
# Deploy specific function
supabase functions deploy ci_get_offers

# Deploy with environment variables
supabase functions deploy ci_get_offers --env-file .env.local

# Deploy and test immediately
supabase functions deploy ci_get_offers && curl -X GET "$(supabase status | grep 'Functions URL' | cut -d' ' -f3)/ci_get_offers?dealer_id=test"
```

### Test Functions Locally

```bash
# Start all functions locally
supabase functions serve

# Start specific function
supabase functions serve ci_get_offers --no-verify-jwt

# Test with curl
curl -X POST "http://localhost:54321/functions/v1/ci_ingest_offers" \
  -H "x-ingest-signature: test-secret" \
  -H "Content-Type: application/json" \
  -d '{"offers":[{"dealer_id":"test_dealer","model":"Test Model","year":2024}]}'
```

## Environment Management

### Update Environment Variables

```bash
# Development (.env.local)
cp .env.template .env.local
# Edit .env.local with your values

# Production (Supabase Dashboard)
# Go to Settings > Edge Functions > Environment Variables
# Add/update variables as needed

# Verify environment variables
supabase functions deploy --dry-run ci_get_offers
```

### Rotate API Keys

```bash
# 1. Generate new API key from provider (OpenAI or future integrations)
# 2. Update environment variables
# 3. Deploy functions with new keys
supabase functions deploy ci_ingest_inventory

# 4. Test with new keys
curl -X POST "$(supabase status | grep 'Functions URL' | cut -d' ' -f3)/ci_ingest_inventory" \
  -H "x-api-key: NEW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"dealer_id":"TEST123","make":"Test","model":"Test","year":2024}]'

# 5. Update client applications with new keys
```

### Rotate Secrets

```bash
# Generate new secure secret
openssl rand -base64 32

# Update SERVICE_INGEST_SECRET in environment
# Deploy affected functions
supabase functions deploy ci_ingest_snapshot
supabase functions deploy ci_ingest_offers
supabase functions deploy ci_ingest_inventory

# Update crawler/ingestion services with new secret
```

## User Management

### Create Admin User

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Set user as admin (user must exist first)
SELECT public.set_user_admin('admin@hrafn.ai');

# Verify admin role
SELECT id, email, role FROM profiles
JOIN auth.users ON profiles.id = auth.users.id
WHERE role = 'admin';
```

### Reset User Password

```bash
# Via Supabase dashboard:
# Go to Authentication > Users
# Find user and click "Reset Password"
# User will receive email with reset link

# Or via SQL (emergency only)
psql -h localhost -p 54322 -U postgres -d postgres
UPDATE auth.users SET encrypted_password = crypt('newpassword', gen_salt('bf'))
WHERE email = 'user@example.com';
```

### Unlock User Account

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Clear failed login attempts
SELECT public.clear_failed_logins((
  SELECT id FROM auth.users WHERE email = 'user@example.com'
));

# Verify unlock
SELECT failed_signins, locked_until FROM auth_security
JOIN auth.users ON auth_security.user_id = auth.users.id
WHERE email = 'user@example.com';
```

### Deactivate User

```bash
# Via Supabase dashboard:
# Go to Authentication > Users
# Find user and click "Delete User"

# Or via SQL
UPDATE auth.users SET banned_until = NOW() + INTERVAL '1 year'
WHERE email = 'user@example.com';
```

## Data Maintenance

### Clean Old Snapshots

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Delete snapshots older than 90 days
DELETE FROM page_snapshots
WHERE created_at < NOW() - INTERVAL '90 days';

# Clean up orphaned S3 files (manual process)
# List files in S3 bucket older than 90 days
# Delete files not referenced in page_snapshots table
```

### Archive Historical Data

```bash
# Archive old change events (keep 1 year)
CREATE TABLE change_events_archive AS
SELECT * FROM change_events
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM change_events
WHERE created_at < NOW() - INTERVAL '1 year';

# Archive old price history (aggregate to weekly/monthly)
# Implementation depends on specific requirements
```

### Rebuild Indexes

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Rebuild specific index
REINDEX INDEX idx_offers_lookup;

# Rebuild all indexes on table
REINDEX TABLE inventory_listings;

# Rebuild all indexes (maintenance window required)
REINDEX DATABASE postgres;
```

### Update Statistics

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Analyze specific table
ANALYZE inventory_listings;

# Analyze all tables
ANALYZE;

# Vacuum and analyze (reclaim space)
VACUUM ANALYZE;
```

## Monitoring & Troubleshooting

### Check Function Logs

```bash
# View recent function logs
supabase functions logs ci_get_offers

# Follow logs in real-time
supabase functions logs ci_get_offers --follow

# Filter logs by level
supabase functions logs ci_get_offers --level error
```

### Monitor Database Performance

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Check table sizes
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check RLS Policies

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

# Test RLS policy for specific user
SET request.jwt.claims = '{"dealer_id": "test-dealer-uuid"}';
SELECT * FROM inventory_listings LIMIT 5;
```

### Troubleshoot Authentication Issues

```bash
# Check user status
psql -h localhost -p 54322 -U postgres -d postgres

SELECT id, email, email_confirmed_at, banned_until, deleted_at
FROM auth.users
WHERE email = 'user@example.com';

# Check failed login attempts
SELECT u.email, s.failed_signins, s.last_failed_at, s.locked_until
FROM auth_security s
JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'user@example.com';

# Check user profile
SELECT u.email, p.role, p.login_count, p.last_login
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'user@example.com';
```

## Deployment Procedures

### Frontend Deployment (Vercel)

```bash
# Build and test locally
npm run build
npm run preview

# Deploy to staging
git push origin staging

# Deploy to production
git push origin main

# Verify deployment
curl -I https://next.hrafn.ai
```

### Database Migration in Production

```bash
# 1. Create migration locally
supabase migration new production_update_name

# 2. Test migration on staging
supabase db push --linked --project-ref staging-project-id

# 3. Verify migration works
supabase db diff --linked --project-ref staging-project-id

# 4. Apply to production (during maintenance window)
supabase db push --linked --project-ref production-project-id

# 5. Verify production migration
supabase db diff --linked --project-ref production-project-id
```

### Rollback Procedures

```bash
# Rollback database migration
supabase db reset --to 20250811000004

# Rollback function deployment
supabase functions deploy ci_get_offers --project-ref production-id

# Rollback frontend deployment (Vercel)
# Go to Vercel dashboard > Deployments
# Find previous successful deployment and "Promote to Production"
```

## Performance Optimization

### Optimize Slow Queries

```bash
# Connect to database
psql -h localhost -p 54322 -U postgres -d postgres

# Enable query timing
\timing on

# Analyze query plan
EXPLAIN ANALYZE SELECT * FROM inventory_listings
WHERE dealer_id = 'test-uuid' AND status = 'available';

# Create covering index if needed
CREATE INDEX CONCURRENTLY idx_inventory_dealer_status
ON inventory_listings(dealer_id, status)
INCLUDE (year, make, model, price);
```

### Monitor Function Performance

```bash
# Check function execution times
supabase functions logs ci_get_offers | grep "Duration:"

# Profile function locally
supabase functions serve ci_get_offers --inspect

# Optimize function code based on bottlenecks
```

### Scale Database Resources

```bash
# Via Supabase dashboard:
# Go to Settings > Database
# Upgrade to higher tier if needed
# Monitor CPU/Memory usage after upgrade

# Optimize connection pooling
# Go to Settings > Database > Connection Pooling
# Adjust pool size based on usage patterns
```

## Backup & Recovery

### Create Full Backup

```bash
# Database backup
pg_dump -h production-host -U postgres -d postgres > full_backup_$(date +%Y%m%d_%H%M).sql

# Environment variables backup
cp .env.production .env.backup.$(date +%Y%m%d)

# Function code backup (already in git)
git tag backup-$(date +%Y%m%d)
git push origin --tags
```

### Disaster Recovery

```bash
# 1. Create new Supabase project
supabase projects create hrafn-recovery

# 2. Restore database from backup
psql -h new-host -U postgres -d postgres < full_backup_20240115_1430.sql

# 3. Deploy functions to new project
supabase functions deploy --project-ref new-project-id

# 4. Update DNS/environment variables to point to new project
# 5. Verify all functionality works

# 6. Update monitoring and alerting for new project
```

### Point-in-Time Recovery

```bash
# Via Supabase dashboard:
# Go to Settings > Database > Backups
# Select "Point in Time Recovery"
# Choose specific timestamp to restore to
# Create new project from backup

# Update application configuration to use recovered database
```

## Security Maintenance

### Security Audit Checklist

```bash
# 1. Check for exposed secrets
git log --all -p | grep -i "password\|secret\|key" | head -20

# 2. Review user permissions
psql -c "SELECT u.email, p.role FROM profiles p JOIN auth.users u ON p.id = u.id;"

# 3. Check RLS policies are enabled
psql -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;"

# 4. Review function permissions
supabase functions list

# 5. Check for SQL injection vulnerabilities
# Review all dynamic SQL in functions

# 6. Verify HTTPS/TLS configuration
curl -I https://next.hrafn.ai | grep -i security
```

### Update Dependencies

```bash
# Frontend dependencies
npm audit
npm update

# Check for critical vulnerabilities
npm audit --audit-level critical

# Update specific vulnerable packages
npm install package-name@latest
```

### Rotate All Secrets (Quarterly)

```bash
# 1. Generate new secrets
openssl rand -base64 32  # SERVICE_INGEST_SECRET
openssl rand -base64 32  # APP_ACCESS_PASSWORD

# 2. Update environment variables in all environments
# 3. Deploy updated functions
# 4. Update client applications
# 5. Test all integrations
# 6. Document rotation in security log
```

This runbook should be updated as new procedures are developed and existing ones are refined based on operational experience.
