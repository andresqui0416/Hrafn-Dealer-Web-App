# Dealer Intelligence Database Schema — V0.0 (Alpha)

## Overview
Secure, high‑performance schema for dealer‑scoped intelligence, recommendations, and execution. Design goals:
- **Strict dealer isolation** via RLS on all dealer‑scoped tables.
- **Aggregate‑safe benchmarking** via sanitized cross‑dealer tables with no `dealer_id`.
- **Operational efficiency** for ingestion, retrieval, and agent execution logging.

## Core Dealer‑Scoped Tables

> Assumes an existing `dealers` table with `id UUID PRIMARY KEY`.

### Dealer Sites
```sql
CREATE TABLE IF NOT EXISTS dealer_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  inventory_url TEXT,
  last_crawl_ok TIMESTAMP WITH TIME ZONE,
  robots_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dealer_sites_dealer_site_url ON dealer_sites(dealer_id, site_url);
```

### Inventory Listings
```sql
CREATE TABLE IF NOT EXISTS inventory_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  vin TEXT NOT NULL CHECK (char_length(vin) IN (11,17)),
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  body_style TEXT,
  drivetrain TEXT,
  msrp DECIMAL(10,2),
  price DECIMAL(10,2),
  mileage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available','sold','pending','unavailable')),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dealer_id, vin)
);
```

### Price History (per‑listing)
```sql
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES inventory_listings(id) ON DELETE CASCADE,
  observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  price DECIMAL(10,2) NOT NULL,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(listing_id, observed_at, coalesce(source,''))
);
```

### Offers
```sql
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('cash_back','financing','lease','combo')),
  model_family TEXT,
  trim TEXT,
  apr DECIMAL(5,3),
  cashback DECIMAL(10,2),
  term_months INTEGER,
  due_at_signing DECIMAL(10,2),
  miles_per_year INTEGER,
  expiry DATE,
  fine_print_text TEXT,
  comparability_flags JSONB NOT NULL DEFAULT '{"loyalty":false,"college":false,"military":false,"conquest":false}',
  is_conditional BOOLEAN DEFAULT false,
  source_url TEXT,
  image_asset_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offers_dealer_model_expiry ON offers(dealer_id, model_family, expiry DESC);
```

### Sales Leads
```sql
CREATE TABLE IF NOT EXISTS sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  lead_source TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Sales Activity History
```sql
CREATE TABLE IF NOT EXISTS sales_activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  sales_lead_id UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  notes TEXT,
  activity_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_activity_lead_time ON sales_activity_history(sales_lead_id, activity_timestamp DESC);
```

### Recommendation Logs
```sql
CREATE TABLE IF NOT EXISTS recommendation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  execution_status TEXT NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending','queued','executed','failed','skipped')),
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reco_logs_dealer_type_time ON recommendation_logs(dealer_id, recommendation_type, coalesce(executed_at, created_at) DESC);
```

## Cross‑Dealer Aggregate Intelligence (No dealer identifiers)

### Aggregate Inventory Metrics
```sql
CREATE TABLE IF NOT EXISTS aggregate_inventory_metrics (
  model_family TEXT NOT NULL,
  day DATE NOT NULL,
  avg_price DECIMAL(10,2),
  median_price DECIMAL(10,2),
  avg_days_on_lot DECIMAL(6,2),
  total_listings INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (model_family, day)
);
```

### Aggregate Offer Performance
```sql
CREATE TABLE IF NOT EXISTS aggregate_offer_performance (
  offer_type TEXT NOT NULL,
  model_family TEXT NOT NULL,
  day DATE NOT NULL,
  avg_apr DECIMAL(6,3),
  avg_cashback DECIMAL(10,2),
  total_offers INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (offer_type, model_family, day)
);
```

## Crawl Ops & Change Detection (System‑scoped)

### Scrape Jobs
```sql
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('inventory','offers','marketplace')),
  dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  http_status INTEGER,
  bytes INTEGER,
  parser_version TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Page Snapshots
```sql
CREATE TABLE IF NOT EXISTS page_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  html_gzip BYTEA,
  text_hash TEXT NOT NULL,
  screenshot_s3 TEXT,
  ocr_json JSONB DEFAULT '{}',
  md5 TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(scrape_job_id, text_hash)
);
```

### Change Events
```sql
CREATE TABLE IF NOT EXISTS change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('inventory_listing','offer','price')),
  entity_id UUID NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created','updated','deleted','price_change','status_change')),
  before_json JSONB DEFAULT '{}',
  after_json JSONB DEFAULT '{}',
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Indexes
```sql
-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_listings_dealer_id ON inventory_listings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_listings_vin ON inventory_listings(vin);
CREATE INDEX IF NOT EXISTS idx_inventory_listings_make_model ON inventory_listings(make, model);
CREATE INDEX IF NOT EXISTS idx_inventory_listings_scraped_at ON inventory_listings(scraped_at);

-- Price history
CREATE INDEX IF NOT EXISTS idx_price_history_listing_id ON price_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_price_history_observed_at ON price_history(observed_at);

-- Offers
CREATE INDEX IF NOT EXISTS idx_offers_dealer_id ON offers(dealer_id);
CREATE INDEX IF NOT EXISTS idx_offers_model_family ON offers(model_family);
CREATE INDEX IF NOT EXISTS idx_offers_expiry ON offers(expiry);

-- Leads & activities
CREATE INDEX IF NOT EXISTS idx_sales_leads_dealer_id ON sales_leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_sales_activity_dealer_time ON sales_activity_history(dealer_id, activity_timestamp DESC);

-- Recommendation logs
CREATE INDEX IF NOT EXISTS idx_reco_logs_status ON recommendation_logs(execution_status);

-- Change events and snapshots
CREATE INDEX IF NOT EXISTS idx_change_events_entity ON change_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_events_detected_at ON change_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_page_snapshots_text_hash ON page_snapshots(text_hash);

-- Aggregates
CREATE UNIQUE INDEX IF NOT EXISTS ux_agg_inventory_model_day ON aggregate_inventory_metrics(model_family, day);
CREATE UNIQUE INDEX IF NOT EXISTS ux_agg_offer_type_model_day ON aggregate_offer_performance(offer_type, model_family, day);
```

## `updated_at` Trigger
```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END
$$;

DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'dealer_sites','inventory_listings','offers','price_history','scrape_jobs','page_snapshots','change_events','sales_leads','sales_activity_history','recommendation_logs','aggregate_inventory_metrics','aggregate_offer_performance'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_on_%I ON %I;', t.tablename, t.tablename);
    EXECUTE format('CREATE TRIGGER set_updated_at_on_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t.tablename, t.tablename);
  END LOOP;
END $$;
```

## Row Level Security (RLS)
> Enable RLS only on dealer‑scoped tables. Aggregates and crawl ops remain without RLS.
```sql
-- Enable
ALTER TABLE dealer_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_activity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_logs ENABLE ROW LEVEL SECURITY;

-- Policies (dealer_id from JWT: request.jwt.claims->>'dealer_id')
CREATE POLICY dealer_read_dealer_sites ON dealer_sites FOR SELECT USING (
  dealer_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'dealer_id','')
);

CREATE POLICY dealer_read_inventory ON inventory_listings FOR SELECT USING (
  dealer_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'dealer_id','')
);

-- Price history inherits via listing -> inventory_listings
CREATE POLICY dealer_read_price_history ON price_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM inventory_listings il
    WHERE il.id = price_history.listing_id
      AND il.dealer_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'dealer_id','')
  )
);

CREATE POLICY dealer_read_offers ON offers FOR SELECT USING (
  dealer_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'dealer_id','')
);

CREATE POLICY dealer_read_sales_leads ON sales_leads FOR SELECT USING (
  dealer_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'dealer_id','')
);

CREATE POLICY dealer_read_sales_activity ON sales_activity_history FOR SELECT USING (
  dealer_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'dealer_id','')
);

CREATE POLICY dealer_read_recommendation_logs ON recommendation_logs FOR SELECT USING (
  dealer_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'dealer_id','')
);

-- Service role bypasses RLS.
```

## Views
```sql
CREATE OR REPLACE VIEW offers_active AS
SELECT * FROM offers WHERE expiry IS NULL OR expiry >= CURRENT_DATE;
```

## Migration Notes
- All PKs are UUID for distributed ingestion.
- JSONB used where structure may evolve (`comparability_flags`, `parameters`, `ocr_json`).
- Aggregates contain no dealer identifiers and are safe for benchmarking.
- Add write policies later if you expose inserts from the UI; for now rely on service role in Edge Functions.

## Next Steps
1. Apply migrations to Supabase.
2. Configure JWT to include `dealer_id` claim.
3. Ingest dealer data via Edge Functions, then backfill aggregates.
4. Wire agents to write to `recommendation_logs` and query aggregates for benchmarks.
