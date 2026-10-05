CREATE TABLE "SeoReportDelivery" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoReportDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SeoReportDelivery_shop_createdAt_idx" ON "SeoReportDelivery"("shop", "createdAt");
