ALTER TABLE "VisitorEvent" ADD COLUMN "clickType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "VisitorEvent" ADD COLUMN "clickTarget" TEXT NOT NULL DEFAULT '';
CREATE TABLE "VisitorBotEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "shop" TEXT NOT NULL,
 "source" TEXT NOT NULL,
 "family" TEXT NOT NULL,
 "path" TEXT NOT NULL,
 "country" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "VisitorBotEvent_shop_occurredAt_idx" ON "VisitorBotEvent"("shop", "occurredAt");
CREATE INDEX "VisitorBotEvent_receivedAt_idx" ON "VisitorBotEvent"("receivedAt");
