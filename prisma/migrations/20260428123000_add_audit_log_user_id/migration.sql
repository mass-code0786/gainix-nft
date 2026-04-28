ALTER TABLE "audit_logs" ADD COLUMN "userId" TEXT;

CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
