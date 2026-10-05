CREATE TABLE "TrafficConnection" (
 "shop" TEXT NOT NULL PRIMARY KEY, "mode" TEXT NOT NULL, "tokens" TEXT NOT NULL,
 "properties" TEXT NOT NULL, "property" TEXT NOT NULL, "name" TEXT NOT NULL,
 "timeZone" TEXT NOT NULL, "measurementId" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "TrafficOAuth" (
 "id" TEXT NOT NULL PRIMARY KEY, "shop" TEXT NOT NULL, "ticketHash" TEXT,
 "stateHash" TEXT, "verifier" TEXT, "expiresAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TrafficOAuth_ticketHash_key" ON "TrafficOAuth"("ticketHash");
CREATE UNIQUE INDEX "TrafficOAuth_stateHash_key" ON "TrafficOAuth"("stateHash");
CREATE INDEX "TrafficOAuth_shop_idx" ON "TrafficOAuth"("shop");
