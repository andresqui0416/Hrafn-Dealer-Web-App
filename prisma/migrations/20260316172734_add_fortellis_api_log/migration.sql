-- CreateTable
CREATE TABLE "fortellis_api_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "requestHeaders" JSONB NOT NULL,
    "requestBody" TEXT,
    "responseStatus" INTEGER NOT NULL,
    "responseHeaders" JSONB NOT NULL,
    "responseBody" TEXT,

    CONSTRAINT "fortellis_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_fortellis_log_request_id" ON "fortellis_api_logs"("requestId");

-- CreateIndex
CREATE INDEX "idx_fortellis_log_created_at" ON "fortellis_api_logs"("createdAt");
