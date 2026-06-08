# World Cup 2026 Bracket Structure

## Problem Description

The original bracket structure for World Cup 2026 was missing:
1. A proper third-place match
2. Correct match labels for knockout rounds

### Original Structure (Incorrect)
- Group Stage → Round of 32 (16 matches) → Round of 16 (8 matches) → Quarter Finals (4 matches) → Semi Finals (2 matches) → Final (1 match)

### Issues
1. No third-place match was included
2. The Round of 16 section had labels showing "12 matches" but the title said "octavos" (eighths)
3. Not all teams had complete bracket progression

## Corrected Structure

The corrected World Cup 2026 bracket now follows:

### Tournament Format
World Cup 2026 uses a 48-team format:

**Group Stage (48 teams → 24 teams)**
- 12 groups of 4 teams each
- Top 2 teams from each group (24 teams)
- Plus 8 best third-place finishers (8 teams)
- Total: 32 teams advance to Round of 32

**Round of 32 (32 teams → 16 teams)**
- 16 matches
- 16 teams advance

**Round of 16 (16 teams → 8 teams)**
- 8 matches
- 8 teams advance

**Quarter Finals (8 teams → 4 teams)**
- 4 matches
- 4 teams advance

**Semi Finals (4 teams → 2 teams)**
- 2 matches
- 2 teams advance to Final
- 2 teams advance to Third Place Match

**Final (2 teams → 1 champion)**
- 1 match for 1st place

**Third Place Match (2 teams → 1 third-place)**
- 1 match for 3rd place
- *This was missing in the original structure*

## Changes Made

### Backend (api/seed.cjs)
1. Added `third_place_match` to the rounds array
2. Added third place match configuration:
   - Home: Winner of Quarter Final 1
   - Away: Winner of Quarter Final 2
   - 12 points for correct prediction

### Backend (api/translations.cjs)
1. Added Spanish translation: `third_place_match: 'partido_por_el_tercer_puesto'`

### Frontend (src/utils/tournament.js)
1. Added `ROUND_LABEL_KEYS`: `third_place_match: 'predict.stepThirdPlace'`
2. Added `ROUND_CODE_MAP`: `third_place_match: '3RD'`

### Frontend (i18n messages)
Added translations for "Third Place Match" in all 5 languages:
- **English**: `stepThirdPlace: 'Third Place Match'`
- **Spanish**: `stepThirdPlace: 'Partido por el Tercer Puesto'`
- **Portuguese**: `stepThirdPlace: 'Jogo pelo 3º lugar'`
- **Italian**: `stepThirdPlace: 'Partita per il 3º posto'`
- **Dutch**: `stepThirdPlace: 'Wedstrijd om de 3e plaats'`

## Bracket Logic

### Round of 32 (16 matches)
- 8 matches: 2nd place vs 2nd place from different groups
- 8 matches: 1st place vs Best 3rd place (special format: `3[A/B/C/D]`)
- Best 3rd place teams are distributed to avoid same-group matchups

### Round of 16 (8 matches)
- Winners from Round of 32 matches pair up
- Standard bracket progression

### Quarter Finals (4 matches)
- Winners from Round of 16 match up
- Standard bracket progression

### Semi Finals (2 matches)
- Winners from Quarter Finals match up
- Standard bracket progression

### Final (1 match)
- Winners from Semi Finals compete for championship
- Standard single match

### Third Place Match (1 match)
- Losers from Semi Finals compete for 3rd place
- Losers from Quarter Final 1 vs losers from Quarter Final 2
- This ensures all teams have a complete bracket path

## Match Numbering

### Round of 32 (Matches 1-16)
- Matches 1-16: All first round knockout matches

### Round of 16 (Matches 1-8)
- Winners from R32-1 through R32-8
- Winners from R32-9 through R32-16

### Quarter Finals (Matches 1-4)
- Winners from R16-1 through R16-4
- Winners from R16-5 through R16-8

### Semi Finals (Matches 1-2)
- Winners from QF-1 and QF-2
- Winners from QF-3 and QF-4

### Final (Match 1)
- Winners from SF-1 and SF-2

### Third Place Match (Match 1)
- Winners from QF-1 and QF-2 (losers of semifinals)
- *Note: Uses QF labels, not SF, to match the correct teams*

## Point Allocation (World Cup 2026)

- Group Stage: 0 points per match (scoring via group predictions)
- Round of 32: 2 points per correct prediction
- Round of 16: 4 points per correct prediction
- Quarter Finals: 6 points per correct prediction
- Semi Finals: 8 points per correct prediction
- Final: 10 points per correct prediction
- **Third Place Match: 12 points per correct prediction** (new)

Maximum possible score: 48 points (group stage) + 2+4+6+8+10+12 = 90 points total

## Testing

To verify the third place match is working:

1. Run seed: `npm run db:seed`
2. Check World Cup 2026 rounds: should include `third_place_match`
3. Check match count: should be 1 match in third_place_match
4. Check point value: should be 12 points per correct

## Future Improvements

1. Consider adding group stage points to maximum score
2. Consider medal ceremony UI for top 3 finishers
3. Consider separate scoring for 3rd place prediction
4. Add best third-place team selection tracking