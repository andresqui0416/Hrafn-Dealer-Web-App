-- CreateTable
CREATE TABLE "scrape_failure_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scrape_event_id" UUID,
    "brand" TEXT,
    "source" TEXT,
    "failure_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_failure_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_scrape_failure_log_created_at" ON "scrape_failure_log"("created_at");

-- CreateIndex
CREATE INDEX "idx_scrape_failure_log_brand_created" ON "scrape_failure_log"("brand", "created_at");

-- CreateIndex
CREATE INDEX "idx_scrape_failure_log_event" ON "scrape_failure_log"("scrape_event_id");

-- AddForeignKey
ALTER TABLE "scrape_failure_log" ADD CONSTRAINT "fk_failure_log_event" FOREIGN KEY ("scrape_event_id") REFERENCES "scrape_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
