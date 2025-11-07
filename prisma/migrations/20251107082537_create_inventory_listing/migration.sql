-- CreateTable
CREATE TABLE IF NOT EXISTS "inventory_listings" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "dealerId" uuid NOT NULL,
    "vin" text NOT NULL,
    "year" integer NOT NULL,
    "make" text NOT NULL,
    "model" text NOT NULL,
    "trim" text,
    "body_style" text,
    "drivetrain" text,
    "msrp" decimal(10,2),
    "price" decimal(10,2),
    "mileage" integer NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'available',
    "scraped_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "u_inv_dealer_vin" UNIQUE ("dealerId", "vin")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_inv_dealer" ON "inventory_listings"("dealerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_inv_make_model" ON "inventory_listings"("make", "model");

-- AddForeignKey
ALTER TABLE "inventory_listings" ADD CONSTRAINT "fk_inv_dealer" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS trg_inventory_listings_updated_at ON "inventory_listings";
CREATE TRIGGER trg_inventory_listings_updated_at BEFORE UPDATE ON "inventory_listings"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Enable RLS
ALTER TABLE "inventory_listings" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: allow access only for matching dealer_id
DROP POLICY IF EXISTS "inventory_listings_select" ON "inventory_listings";
CREATE POLICY "inventory_listings_select" ON "inventory_listings"
  FOR SELECT USING ("dealerId" = auth_dealer_id());
