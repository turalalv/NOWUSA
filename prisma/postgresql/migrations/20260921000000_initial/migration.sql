-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoWorkspace" (
    "shop" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lockToken" TEXT,
    "lockUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoWorkspace_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "SeoChange" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleConnection" (
    "shop" TEXT NOT NULL,
    "tokens" TEXT NOT NULL,
    "properties" TEXT NOT NULL,
    "property" TEXT,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "GoogleOAuth" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "ticketHash" TEXT,
    "stateHash" TEXT,
    "verifier" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleOAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageCompression" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "original" BYTEA NOT NULL,
    "optimized" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "beforeHash" TEXT NOT NULL,
    "afterHash" TEXT NOT NULL,
    "beforeUpdatedAt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageCompression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoChange_shop_createdAt_idx" ON "SeoChange"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuth_ticketHash_key" ON "GoogleOAuth"("ticketHash");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuth_stateHash_key" ON "GoogleOAuth"("stateHash");

-- CreateIndex
CREATE INDEX "GoogleOAuth_shop_idx" ON "GoogleOAuth"("shop");

-- CreateIndex
CREATE INDEX "ImageCompression_shop_createdAt_idx" ON "ImageCompression"("shop", "createdAt");
