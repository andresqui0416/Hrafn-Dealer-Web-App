/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Dealer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `address` to the `Dealer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `User` table without a default value. This is not possible if the table is not empty.

*/

-- Add address column to Dealer (nullable first, then update existing rows, then make NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Dealer' AND column_name = 'address'
  ) THEN
    ALTER TABLE "Dealer" ADD COLUMN "address" TEXT;
    
    -- Update existing rows with empty string if null
    UPDATE "Dealer" SET "address" = '' WHERE "address" IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE "Dealer" ALTER COLUMN "address" SET NOT NULL;
  END IF;
END $$;

-- Remove phone column from Dealer if it exists (moving to User table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Dealer' AND column_name = 'phone'
  ) THEN
    ALTER TABLE "Dealer" DROP COLUMN "phone";
  END IF;
END $$;

-- Add phone column to User (nullable first, then update existing rows, then make NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User' AND column_name = 'phone'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "phone" TEXT;
    
    -- Update existing rows with empty string if null
    UPDATE "User" SET "phone" = '' WHERE "phone" IS NULL;
    
    -- Make it NOT NULL
    ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;
  END IF;
END $$;

-- Remove address column from User if it exists (not in schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'User' AND column_name = 'address'
  ) THEN
    ALTER TABLE "User" DROP COLUMN "address";
  END IF;
END $$;

-- CreateIndex: Make Dealer.name unique
CREATE UNIQUE INDEX IF NOT EXISTS "Dealer_name_key" ON "Dealer"("name");
