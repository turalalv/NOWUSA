CREATE TABLE "SeoReportDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "SeoReportDelivery_shop_createdAt_idx" ON "SeoReportDelivery"("shop", "createdAt");
