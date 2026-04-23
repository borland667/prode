ALTER TABLE "GroupPrediction"
ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'tournament';

ALTER TABLE "KnockoutPrediction"
ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'tournament';

ALTER TABLE "Score"
ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'tournament';

DROP INDEX IF EXISTS "GroupPrediction_userId_tournamentId_groupId_key";

ALTER TABLE "GroupPrediction"
ADD CONSTRAINT "GroupPrediction_userId_tournamentId_groupId_scopeKey_key"
UNIQUE ("userId", "tournamentId", "groupId", "scopeKey");

DROP INDEX IF EXISTS "KnockoutPrediction_userId_matchId_key";

ALTER TABLE "KnockoutPrediction"
ADD CONSTRAINT "KnockoutPrediction_userId_matchId_scopeKey_key"
UNIQUE ("userId", "matchId", "scopeKey");

DROP INDEX IF EXISTS "Score_userId_tournamentId_key";

ALTER TABLE "Score"
ADD CONSTRAINT "Score_userId_tournamentId_scopeKey_key"
UNIQUE ("userId", "tournamentId", "scopeKey");
