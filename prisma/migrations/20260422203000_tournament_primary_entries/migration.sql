CREATE TABLE "TournamentPrimaryEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL DEFAULT 'tournament',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TournamentPrimaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentPrimaryEntry_userId_tournamentId_key"
ON "TournamentPrimaryEntry"("userId", "tournamentId");

ALTER TABLE "TournamentPrimaryEntry"
ADD CONSTRAINT "TournamentPrimaryEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TournamentPrimaryEntry"
ADD CONSTRAINT "TournamentPrimaryEntry_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
