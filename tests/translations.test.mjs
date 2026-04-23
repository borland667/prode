import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { getLocalizedName } from '../src/utils/tournament.js';

const require = createRequire(import.meta.url);
const {
  getModeNameEs,
  getRoundNameEs,
  getTeamNameEs,
  getTournamentNameEs,
} = require('../api/translations.cjs');

test('translation helpers derive spanish values for known seeded entities', () => {
  assert.equal(getTournamentNameEs({ name: 'FIFA World Cup 2026' }), 'Copa Mundial FIFA 2026');
  assert.equal(
    getModeNameEs({ modeKey: 'classic_argentinian_prode', modeName: 'Classic Argentinian Prode (Scaled)' }),
    'Prode Argentino Clasico Escalado'
  );
  assert.equal(getRoundNameEs({ name: 'quarter_finals' }), 'cuartos_de_final');
  assert.equal(getTeamNameEs({ code: 'USA' }), 'Estados Unidos');
});

test('getLocalizedName prefers spanish names when spanish is active', () => {
  assert.equal(
    getLocalizedName({ name: 'Germany', nameEs: 'Alemania' }, 'es', 'Germany'),
    'Alemania'
  );
  assert.equal(
    getLocalizedName({ name: 'Germany', nameEs: 'Alemania' }, 'en', 'Germany'),
    'Germany'
  );
});
