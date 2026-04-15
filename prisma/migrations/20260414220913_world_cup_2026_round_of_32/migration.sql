-- AlterTable
ALTER TABLE "GroupPrediction"
ADD COLUMN "third" TEXT;

-- AlterTable
ALTER TABLE "GroupResult"
ADD COLUMN "third" TEXT;

-- AlterTable
ALTER TABLE "KnockoutPrediction"
ADD COLUMN "selectedHomeTeamId" TEXT,
ADD COLUMN "selectedAwayTeamId" TEXT;

-- AlterTable
ALTER TABLE "Match"
ADD COLUMN "selectedHomeTeamId" TEXT,
ADD COLUMN "selectedAwayTeamId" TEXT;
