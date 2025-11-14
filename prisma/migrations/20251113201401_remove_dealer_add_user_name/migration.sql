-- Step 0: Drop triggers that might interfere with column changes
DROP TRIGGER IF EXISTS trg_dealer_updated_at ON "Dealer";
DROP TRIGGER IF EXISTS trg_user_updated_at ON "User";
DROP TRIGGER IF EXISTS trg_inventory_listings_updated_at ON "inventory_listings";

-- Step 1: Add name column to User (nullable first)
ALTER TABLE "User" ADD COLUMN     "name" TEXT;
UPDATE "User" SET "name" = COALESCE("email", 'User') WHERE "name" IS NULL;
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;

-- Step 2: Add userId column to inventory_listings and migrate data
-- First, add the column as nullable
ALTER TABLE "inventory_listings" ADD COLUMN     "userId" UUID;
-- Map dealerId to userId using UserDealerRole (before we drop it)
UPDATE "inventory_listings" SET "userId" = (
  SELECT "UserDealerRole"."userId" 
  FROM "UserDealerRole" 
  WHERE "UserDealerRole"."dealerId" = "inventory_listings"."dealerId" 
  LIMIT 1
) WHERE "userId" IS NULL;
-- Delete orphaned inventory listings that couldn't be mapped
DELETE FROM "inventory_listings" WHERE "userId" IS NULL;
-- Now make userId NOT NULL
ALTER TABLE "inventory_listings" ALTER COLUMN "userId" SET NOT NULL;

-- Step 3: Migrate dealer_apps to user_apps
-- Add userId to dealer_apps
ALTER TABLE "dealer_apps" ADD COLUMN "userId" UUID;
UPDATE "dealer_apps" SET "userId" = (
  SELECT "UserDealerRole"."userId" 
  FROM "UserDealerRole" 
  WHERE "UserDealerRole"."dealerId" = "dealer_apps"."dealerId" 
  LIMIT 1
) WHERE "userId" IS NULL;
DELETE FROM "dealer_apps" WHERE "userId" IS NULL;
ALTER TABLE "dealer_apps" ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Migrate Session - map dealerId to userId
-- Note: Sessions will be recreated on next login, so we can delete old ones or map them
-- For simplicity, we'll delete sessions and let users re-login
DELETE FROM "Session";

-- Step 5: Drop RLS policies that depend on dealerId
DROP POLICY IF EXISTS "session_select" ON "Session";
DROP POLICY IF EXISTS "userdealer_select" ON "UserDealerRole";
DROP POLICY IF EXISTS "dealer_select" ON "Dealer";
DROP POLICY IF EXISTS "inventory_listings_select" ON "inventory_listings";

-- Step 6: Drop foreign keys and constraints
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "fk_sess_dealer";
ALTER TABLE "UserDealerRole" DROP CONSTRAINT IF EXISTS "fk_udr_dealer";
ALTER TABLE "UserDealerRole" DROP CONSTRAINT IF EXISTS "fk_udr_user";
ALTER TABLE "dealer_apps" DROP CONSTRAINT IF EXISTS "fk_app_dealer";
ALTER TABLE "inventory_listings" DROP CONSTRAINT IF EXISTS "fk_inv_dealer";
ALTER TABLE "inventory_listings" DROP CONSTRAINT IF EXISTS "u_inv_dealer_vin";

-- Step 7: Drop indexes
DROP INDEX IF EXISTS "idx_sess_dealer";
DROP INDEX IF EXISTS "idx_inv_dealer";

-- Step 8: Drop columns
ALTER TABLE "Session" DROP COLUMN IF EXISTS "dealerId";
ALTER TABLE "inventory_listings" DROP COLUMN IF EXISTS "dealerId";
ALTER TABLE "dealer_apps" DROP COLUMN IF EXISTS "dealerId";

-- Step 9: Rename dealer_apps to user_apps
ALTER TABLE "dealer_apps" RENAME TO "user_apps";
ALTER INDEX IF EXISTS "idx_app_dealer" RENAME TO "idx_app_user";

-- Step 10: Create new indexes and constraints
CREATE INDEX IF NOT EXISTS "idx_inv_user" ON "inventory_listings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "u_inv_user_vin" ON "inventory_listings"("userId", "vin");

-- Step 11: Add foreign keys
ALTER TABLE "inventory_listings" ADD CONSTRAINT "fk_inv_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "user_apps" ADD CONSTRAINT "fk_app_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Step 12: Drop old tables
DROP TABLE IF EXISTS "Dealer";
DROP TABLE IF EXISTS "UserDealerRole";
DROP TYPE IF EXISTS "Role";

-- Step 13: Update trigger function to handle both updatedAt and updated_at column names
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- inventory_listings uses updated_at (snake_case), others use updatedAt (camelCase)
  IF TG_TABLE_NAME = 'inventory_listings' THEN
    NEW."updated_at" := now();
  ELSE
    NEW."updatedAt" := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Recreate triggers for remaining tables
CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_listings_updated_at BEFORE UPDATE ON "inventory_listings"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
