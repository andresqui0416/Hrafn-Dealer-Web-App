-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT;

-- AlterTable
ALTER TABLE "user_apps" RENAME CONSTRAINT "dealer_apps_pkey" TO "user_apps_pkey";

-- CreateIndex
CREATE INDEX "idx_app_user" ON "user_apps"("userId");
