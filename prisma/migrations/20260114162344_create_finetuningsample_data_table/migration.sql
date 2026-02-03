-- CreateEnum
CREATE TYPE "FineTuningSampleType" AS ENUM ('NLQ', 'FAQ');

-- CreateTable
CREATE TABLE "FineTuningSample" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" "FineTuningSampleType" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineTuningSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_fts_type" ON "FineTuningSample"("type");
