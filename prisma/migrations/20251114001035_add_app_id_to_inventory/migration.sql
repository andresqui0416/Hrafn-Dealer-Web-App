-- Step 1: Add appId column as nullable first
ALTER TABLE "inventory_listings" ADD COLUMN "appId" UUID;

-- Step 2: For each user, create a default app if they don't have one, or use the first app
-- First, create a default app for users who have inventory but no apps
INSERT INTO "user_apps" ("id", "userId", "name", "description", "fortellis_client_id", "fortellis_client_secret", "createdAt", "updatedAt")
SELECT 
  uuid_generate_v4(),
  il."userId",
  'Default App',
  'Default app created for existing inventory',
  'default-client-id',
  NULL,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "userId" 
  FROM "inventory_listings"
  WHERE "userId" NOT IN (SELECT DISTINCT "userId" FROM "user_apps")
) il;

-- Step 3: Update all inventory listings to use the first app for each user
UPDATE "inventory_listings" il
SET "appId" = (
  SELECT "id" 
  FROM "user_apps" ua 
  WHERE ua."userId" = il."userId" 
  ORDER BY ua."createdAt" ASC 
  LIMIT 1
)
WHERE "appId" IS NULL;

-- Step 4: Make appId NOT NULL
ALTER TABLE "inventory_listings" ALTER COLUMN "appId" SET NOT NULL;

-- Step 5: Create index
CREATE INDEX "idx_inv_app" ON "inventory_listings"("appId");

-- Step 6: Add foreign key constraint
ALTER TABLE "inventory_listings" ADD CONSTRAINT "fk_inv_app" FOREIGN KEY ("appId") REFERENCES "user_apps"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
