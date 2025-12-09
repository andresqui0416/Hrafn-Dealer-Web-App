-- CreateTable
CREATE TABLE "Offers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "brand" TEXT NOT NULL,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "model_code" TEXT,
    "trim" TEXT,
    "offer_type" TEXT NOT NULL,
    "offer_amount" DECIMAL(12,2),
    "apr" DECIMAL(8,4),
    "term_months" INTEGER,
    "cash_back" DECIMAL(12,2),
    "due_at_signing" DECIMAL(12,2),
    "miles_per_year" INTEGER,
    "expiration_date" DATE,
    "terms" TEXT,
    "fine_print" TEXT,
    "scraped_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_offers_brand_year_model" ON "Offers"("brand", "year", "model");

-- CreateIndex
CREATE INDEX "idx_offers_offer_type" ON "Offers"("offer_type");

-- CreateIndex
CREATE INDEX "idx_offers_expiration" ON "Offers"("expiration_date");

-- CreateIndex
CREATE INDEX "idx_offers_scraped_at" ON "Offers"("scraped_at");

-- CreateIndex
CREATE UNIQUE INDEX "u_offers_unique_offer" ON "Offers"("brand", "year", "model", "offer_type", "terms");
