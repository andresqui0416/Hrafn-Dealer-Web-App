-- Add version column to Offers and increment it on any update

ALTER TABLE "Offers"
ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;

-- Function to increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW."version" := COALESCE(OLD."version", 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to bump version on every update to Offers
DROP TRIGGER IF EXISTS set_offers_version ON "Offers";
CREATE TRIGGER set_offers_version
BEFORE UPDATE ON "Offers"
FOR EACH ROW
EXECUTE PROCEDURE increment_version();
