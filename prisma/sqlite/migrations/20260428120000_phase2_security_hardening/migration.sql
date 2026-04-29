CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "audit_logs_walletAddress_createdAt_idx" ON "audit_logs"("walletAddress", "createdAt");
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
