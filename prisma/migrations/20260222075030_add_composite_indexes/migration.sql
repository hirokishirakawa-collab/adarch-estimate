-- CreateIndex
CREATE INDEX "group_collaboration_requests_branchId_createdAt_idx" ON "group_collaboration_requests"("branchId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "invoice_requests_createdById_createdAt_idx" ON "invoice_requests"("createdById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "projects_branchId_createdAt_idx" ON "projects"("branchId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "projects_branchId_status_idx" ON "projects"("branchId", "status");
