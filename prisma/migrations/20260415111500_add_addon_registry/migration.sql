CREATE TYPE "AddonRegistryState" AS ENUM ('ENABLED', 'DISABLED', 'UNINSTALLED', 'ERROR');

CREATE TABLE "addon_registry" (
  "id" TEXT NOT NULL,
  "addonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "description" TEXT,
  "sourceDir" TEXT,
  "state" "AddonRegistryState" NOT NULL DEFAULT 'ENABLED',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "manifestJson" JSONB,
  "permissionsJson" JSONB,
  "installedAt" TIMESTAMPTZ(3),
  "disabledAt" TIMESTAMPTZ(3),
  "uninstalledAt" TIMESTAMPTZ(3),
  "lastErrorAt" TIMESTAMPTZ(3),
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "addon_registry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "addon_lifecycle_log" (
  "id" TEXT NOT NULL,
  "addonId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "addon_lifecycle_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "addon_lifecycle_log_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "addon_registry"("addonId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "addon_registry_addonId_key" ON "addon_registry"("addonId");
CREATE INDEX "addon_registry_state_updatedAt_idx" ON "addon_registry"("state", "updatedAt");
CREATE INDEX "addon_lifecycle_log_addonId_createdAt_idx" ON "addon_lifecycle_log"("addonId", "createdAt");
CREATE INDEX "addon_lifecycle_log_action_createdAt_idx" ON "addon_lifecycle_log"("action", "createdAt");
