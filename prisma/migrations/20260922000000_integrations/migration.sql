CREATE TABLE "GoogleConnection" ("shop" TEXT NOT NULL PRIMARY KEY, "tokens" TEXT NOT NULL, "properties" TEXT NOT NULL, "property" TEXT, "autoSync" BOOLEAN NOT NULL DEFAULT false, "syncedAt" DATETIME, "updatedAt" DATETIME NOT NULL);
CREATE TABLE "GoogleOAuth" ("id" TEXT NOT NULL PRIMARY KEY, "shop" TEXT NOT NULL, "ticketHash" TEXT, "stateHash" TEXT, "verifier" TEXT, "expiresAt" DATETIME NOT NULL);
CREATE UNIQUE INDEX "GoogleOAuth_ticketHash_key" ON "GoogleOAuth"("ticketHash");
CREATE UNIQUE INDEX "GoogleOAuth_stateHash_key" ON "GoogleOAuth"("stateHash");
CREATE INDEX "GoogleOAuth_shop_idx" ON "GoogleOAuth"("shop");
CREATE TABLE "ImageCompression" ("id" TEXT NOT NULL PRIMARY KEY, "shop" TEXT NOT NULL, "imageId" TEXT NOT NULL, "original" BLOB NOT NULL, "optimized" BLOB NOT NULL, "mime" TEXT NOT NULL, "beforeHash" TEXT NOT NULL, "afterHash" TEXT NOT NULL, "beforeUpdatedAt" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "ImageCompression_shop_createdAt_idx" ON "ImageCompression"("shop", "createdAt");
