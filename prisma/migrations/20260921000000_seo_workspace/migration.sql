CREATE TABLE "SeoWorkspace" (
  "shop" TEXT NOT NULL PRIMARY KEY,
  "data" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "lockToken" TEXT,
  "lockUntil" DATETIME,
  "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "SeoChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "pageTitle" TEXT NOT NULL,
  "before" TEXT NOT NULL,
  "after" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "SeoChange_shop_createdAt_idx" ON "SeoChange"("shop", "createdAt");
