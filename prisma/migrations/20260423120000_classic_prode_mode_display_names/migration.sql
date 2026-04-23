-- Default display names for the classic Prode scoring mode
ALTER TABLE "Tournament" ALTER COLUMN "modeName" SET DEFAULT 'Classic Prode';
ALTER TABLE "Tournament" ALTER COLUMN "modeNameEs" SET DEFAULT 'Prode Clasico';

-- Align existing tournaments on the classic mode key
UPDATE "Tournament"
SET
  "modeName" = 'Classic Prode',
  "modeNameEs" = 'Prode Clasico'
WHERE "modeKey" = 'classic_argentinian_prode';
