CREATE TABLE "addon_config" (
  "id" TEXT NOT NULL,
  "addonId" TEXT NOT NULL,
  "configKey" TEXT NOT NULL,
  "valueJson" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "addon_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "addon_config_addonId_configKey_key" ON "addon_config"("addonId", "configKey");
CREATE INDEX "addon_config_addonId_updatedAt_idx" ON "addon_config"("addonId", "updatedAt");
