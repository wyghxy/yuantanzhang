CREATE TABLE "PersonalUser" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "singleton" INTEGER NOT NULL DEFAULT 1 CHECK ("singleton" = 1),
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL
);
CREATE UNIQUE INDEX "PersonalUser_singleton_key" ON "PersonalUser"("singleton");
CREATE UNIQUE INDEX "PersonalUser_username_key" ON "PersonalUser"("username");

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "PersonalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL DEFAULT '我的工作台',
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "preferenceVersion" INTEGER NOT NULL DEFAULT 1,
  "demoInitialized" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "Workspace_ownerId_key" ON "Workspace"("ownerId");

CREATE TABLE "LoginSession" (
  "digest" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "PersonalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" DATETIME NOT NULL
);
CREATE INDEX "LoginSession_ownerId_idx" ON "LoginSession"("ownerId");

CREATE TABLE "StudioRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "sample" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "StudioRecord_workspaceId_kind_deletedAt_updatedAt_idx" ON "StudioRecord"("workspaceId","kind","deletedAt","updatedAt");

CREATE TABLE "RecordVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "recordId" TEXT NOT NULL REFERENCES "StudioRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "version" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RecordVersion_recordId_version_key" ON "RecordVersion"("recordId","version");

CREATE TABLE "StudioFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recordId" TEXT NOT NULL REFERENCES "StudioRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "StudioFile_workspaceId_recordId_idx" ON "StudioFile"("workspaceId","recordId");

CREATE TABLE "LocalTask" (
  "recordId" TEXT NOT NULL PRIMARY KEY REFERENCES "StudioRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "state" TEXT NOT NULL DEFAULT 'queued' CHECK ("state" IN ('queued','running','succeeded','failed','cancelled')),
  "leaseToken" TEXT,
  "leaseUntil" DATETIME,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("state" = 'running' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
     OR ("state" <> 'running' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL))
);
CREATE INDEX "LocalTask_state_leaseUntil_createdAt_idx" ON "LocalTask"("state","leaseUntil","createdAt");
