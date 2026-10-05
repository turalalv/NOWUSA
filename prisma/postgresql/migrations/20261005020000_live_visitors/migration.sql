CREATE TABLE "VisitorTracker" (
 "shop" TEXT NOT NULL PRIMARY KEY,
 "publicKey" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "VisitorTracker_publicKey_key" ON "VisitorTracker"("publicKey");
CREATE TABLE "VisitorEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "shop" TEXT NOT NULL,
 "visit" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "path" TEXT NOT NULL,
 "source" TEXT NOT NULL,
 "medium" TEXT NOT NULL,
 "campaign" TEXT NOT NULL,
 "country" TEXT NOT NULL,
 "device" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "VisitorEvent_shop_occurredAt_idx" ON "VisitorEvent"("shop", "occurredAt");
CREATE INDEX "VisitorEvent_shop_visit_occurredAt_idx" ON "VisitorEvent"("shop", "visit", "occurredAt");
CREATE INDEX "VisitorEvent_receivedAt_idx" ON "VisitorEvent"("receivedAt");
