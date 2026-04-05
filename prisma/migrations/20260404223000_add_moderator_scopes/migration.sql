-- CreateTable
CREATE TABLE "ModeratorZoneScope" (
    "id" TEXT NOT NULL,
    "moderatorId" INTEGER NOT NULL,
    "zoneId" TEXT NOT NULL,
    "canEditSettings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ModeratorZoneScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeratorBoardScope" (
    "id" TEXT NOT NULL,
    "moderatorId" INTEGER NOT NULL,
    "boardId" TEXT NOT NULL,
    "canEditSettings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ModeratorBoardScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorZoneScope_moderatorId_zoneId_key" ON "ModeratorZoneScope"("moderatorId", "zoneId");

-- CreateIndex
CREATE INDEX "ModeratorZoneScope_zoneId_idx" ON "ModeratorZoneScope"("zoneId");

-- CreateIndex
CREATE INDEX "ModeratorZoneScope_moderatorId_createdAt_idx" ON "ModeratorZoneScope"("moderatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorBoardScope_moderatorId_boardId_key" ON "ModeratorBoardScope"("moderatorId", "boardId");

-- CreateIndex
CREATE INDEX "ModeratorBoardScope_boardId_idx" ON "ModeratorBoardScope"("boardId");

-- CreateIndex
CREATE INDEX "ModeratorBoardScope_moderatorId_createdAt_idx" ON "ModeratorBoardScope"("moderatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ModeratorZoneScope" ADD CONSTRAINT "ModeratorZoneScope_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorZoneScope" ADD CONSTRAINT "ModeratorZoneScope_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorBoardScope" ADD CONSTRAINT "ModeratorBoardScope_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorBoardScope" ADD CONSTRAINT "ModeratorBoardScope_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
