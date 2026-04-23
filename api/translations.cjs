const ROUND_NAME_ES = {
  group_stage: 'fase_de_grupos',
  round_of_32: 'dieciseisavos_de_final',
  round_of_16: 'octavos_de_final',
  quarter_finals: 'cuartos_de_final',
  semi_finals: 'semifinales',
  final: 'final',
};

const TOURNAMENT_NAME_ES_BY_NAME = {
  'FIFA World Cup 2026': 'Copa Mundial FIFA 2026',
  'UEFA Euro Championship': 'Eurocopa UEFA',
  'AFC Asian Cup': 'Copa Asiatica AFC',
  'Africa Cup of Nations': 'Copa Africana de Naciones',
  'Copa America': 'Copa America',
};

const MODE_NAME_ES_BY_KEY = {
  classic_argentinian_prode: 'Prode Argentino Clasico',
};

const MODE_NAME_ES_BY_NAME = {
  'Classic Argentinian Prode': 'Prode Argentino Clasico',
  'Classic Argentinian Prode (Scaled)': 'Prode Argentino Clasico Escalado',
};

const TEAM_NAME_ES_BY_CODE = {
  ALB: 'Albania',
  ALG: 'Argelia',
  ANG: 'Angola',
  ARG: 'Argentina',
  AUS: 'Australia',
  AUT: 'Austria',
  BEL: 'Belgica',
  BEN: 'Benin',
  BFA: 'Burkina Faso',
  BHR: 'Barein',
  BIH: 'Bosnia y Herzegovina',
  BOL: 'Bolivia',
  BRA: 'Brasil',
  CAN: 'Canada',
  CHI: 'Chile',
  CHN: 'China',
  CIV: 'Costa de Marfil',
  CMR: 'Camerun',
  COD: 'Republica Democratica del Congo',
  COL: 'Colombia',
  CPV: 'Cabo Verde',
  CRC: 'Costa Rica',
  CRO: 'Croacia',
  CUW: 'Curazao',
  CZE: 'Chequia',
  DEN: 'Dinamarca',
  ECU: 'Ecuador',
  EGY: 'Egipto',
  ENG: 'Inglaterra',
  EQG: 'Guinea Ecuatorial',
  ESP: 'Espana',
  FRA: 'Francia',
  GAB: 'Gabon',
  GAM: 'Gambia',
  GEO: 'Georgia',
  GER: 'Alemania',
  GHA: 'Ghana',
  GUI: 'Guinea',
  HAI: 'Haiti',
  HKG: 'Hong Kong',
  HUN: 'Hungria',
  IDN: 'Indonesia',
  IND: 'India',
  IRN: 'Iran',
  IRQ: 'Irak',
  ITA: 'Italia',
  JAM: 'Jamaica',
  JOR: 'Jordania',
  JPN: 'Japon',
  KGZ: 'Kirguistan',
  KOR: 'Corea del Sur',
  KSA: 'Arabia Saudita',
  LBN: 'Libano',
  MAR: 'Marruecos',
  MAS: 'Malasia',
  MEX: 'Mexico',
  MLI: 'Mali',
  MTN: 'Mauritania',
  NED: 'Paises Bajos',
  NGA: 'Nigeria',
  NOR: 'Noruega',
  NZL: 'Nueva Zelanda',
  OMA: 'Oman',
  PAN: 'Panama',
  PAR: 'Paraguay',
  PER: 'Peru',
  PLE: 'Palestina',
  POL: 'Polonia',
  POR: 'Portugal',
  QAT: 'Qatar',
  ROU: 'Rumania',
  RSA: 'Sudafrica',
  SCO: 'Escocia',
  SEN: 'Senegal',
  SRB: 'Serbia',
  SUI: 'Suiza',
  SVK: 'Eslovaquia',
  SVN: 'Eslovenia',
  SWE: 'Suecia',
  SYR: 'Siria',
  TAN: 'Tanzania',
  THA: 'Tailandia',
  TJK: 'Tayikistan',
  TUN: 'Tunez',
  TUR: 'Turquia',
  UAE: 'Emiratos Arabes Unidos',
  UGA: 'Uganda',
  UKR: 'Ucrania',
  URU: 'Uruguay',
  USA: 'Estados Unidos',
  UZB: 'Uzbekistan',
  VEN: 'Venezuela',
  VIE: 'Vietnam',
  ZAM: 'Zambia',
};

function getTrimmedValue(value) {
  const nextValue = String(value || '').trim();
  return nextValue || null;
}

function getTournamentNameEs(tournament = {}) {
  const explicitNameEs = getTrimmedValue(tournament.nameEs);
  if (explicitNameEs) {
    return explicitNameEs;
  }

  return TOURNAMENT_NAME_ES_BY_NAME[String(tournament.name || '').trim()] || null;
}

function getModeNameEs(mode = {}) {
  const explicitNameEs = getTrimmedValue(mode.modeNameEs || mode.nameEs);
  if (explicitNameEs) {
    return explicitNameEs;
  }

  const modeKey = String(mode.modeKey || mode.key || '').trim();
  const modeName = String(mode.modeName || mode.name || '').trim();

  return MODE_NAME_ES_BY_NAME[modeName] || MODE_NAME_ES_BY_KEY[modeKey] || null;
}

function getRoundNameEs(round = {}) {
  const explicitNameEs = getTrimmedValue(round.nameEs);
  if (explicitNameEs) {
    return explicitNameEs;
  }

  return ROUND_NAME_ES[String(round.name || '').trim()] || null;
}

function getTeamNameEs(team = {}) {
  const explicitNameEs = getTrimmedValue(team.nameEs);
  if (explicitNameEs) {
    return explicitNameEs;
  }

  const code = String(team.code || '').trim().toUpperCase();
  return TEAM_NAME_ES_BY_CODE[code] || null;
}

module.exports = {
  getModeNameEs,
  getRoundNameEs,
  getTeamNameEs,
  getTournamentNameEs,
  MODE_NAME_ES_BY_KEY,
  ROUND_NAME_ES,
  TEAM_NAME_ES_BY_CODE,
  TOURNAMENT_NAME_ES_BY_NAME,
};
