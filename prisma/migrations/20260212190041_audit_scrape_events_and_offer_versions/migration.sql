-- CreateTable
CREATE TABLE "scrape_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "source" TEXT,
    "brand" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'running',
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "records_replaced" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "scrape_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scrape_event_id" UUID NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_versions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scrape_event_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "model_code" TEXT,
    "trim" TEXT,
    "offer_type" TEXT NOT NULL,
    "offer_amount" DECIMAL(12,2),
    "apr_rate" DECIMAL(8,4),
    "lease_term_months" INTEGER,
    "apr_term_months" INTEGER,
    "cash_value" DECIMAL(12,2),
    "trade_discount" DECIMAL(12,2),
    "lease_due_at_signing" DECIMAL(12,2),
    "lease_monthly_payment" DECIMAL(12,2),
    "miles_per_year" INTEGER,
    "expiration_date" DATE,
    "terms" TEXT,
    "fine_print" TEXT,
    "scraped_at" TIMESTAMPTZ(6) NOT NULL,
    "source_url" TEXT,
    "loyalty_bonus" DECIMAL(12,2),
    "conquest_bonus" DECIMAL(12,2),
    "military_discount" DECIMAL(12,2),
    "college_grad" DECIMAL(12,2),
    "first_responder" DECIMAL(12,2),
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),

    CONSTRAINT "offer_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_scrape_event_started_at" ON "scrape_events"("started_at");

-- CreateIndex
CREATE INDEX "idx_scrape_event_brand_started" ON "scrape_events"("brand", "started_at");

-- CreateIndex
CREATE INDEX "idx_scrape_event_status" ON "scrape_events"("status");

-- CreateIndex
CREATE INDEX "idx_scrape_snapshot_event" ON "scrape_snapshots"("scrape_event_id");

-- CreateIndex
CREATE INDEX "idx_offer_version_event" ON "offer_versions"("scrape_event_id");

-- CreateIndex
CREATE INDEX "idx_offer_version_history" ON "offer_versions"("brand", "model", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "idx_offer_version_brand" ON "offer_versions"("brand");

-- CreateIndex
CREATE INDEX "idx_offer_version_effective" ON "offer_versions"("effective_from", "effective_to");

-- AddForeignKey
ALTER TABLE "scrape_snapshots" ADD CONSTRAINT "fk_snapshot_event" FOREIGN KEY ("scrape_event_id") REFERENCES "scrape_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offer_versions" ADD CONSTRAINT "fk_offer_version_event" FOREIGN KEY ("scrape_event_id") REFERENCES "scrape_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
