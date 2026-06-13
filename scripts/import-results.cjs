// CLI wrapper around the POST /api/tournaments/:id/import-results endpoint.
//
// Reads its config from environment variables so the same script can be
// invoked from a local shell or from a GitHub Actions cron job. When the
// importer secret is not configured the script exits 0 with a clear log
// message, which lets the cron job stay scheduled while the secret is
// absent (for example in PR forks).
//
// Required env:
//   RESULTS_IMPORT_API_BASE_URL   public origin of the Prode API (no trailing slash)
//   RESULTS_IMPORT_ADMIN_EMAIL    admin user that can call admin endpoints
//   RESULTS_IMPORT_ADMIN_PASSWORD password for that admin user
//
// Optional env:
//   RESULTS_IMPORT_TOURNAMENT_ID    explicit tournament id to import into
//   RESULTS_IMPORT_TOURNAMENT_NAME  fallback lookup if no id is provided
//   RESULTS_IMPORT_COMPETITION_CODE football-data.org code, defaults to WC
//
// The football-data.org API key itself lives only on the server as
// RESULTS_IMPORT_API_KEY and is never sent from this script.

require('dotenv').config();

const DEFAULT_TOURNAMENT_NAME = 'FIFA World Cup 2026';

function readConfig() {
  const apiBaseUrl = (process.env.RESULTS_IMPORT_API_BASE_URL || '').replace(/\/+$/, '');
  const adminEmail = process.env.RESULTS_IMPORT_ADMIN_EMAIL || '';
  const adminPassword = process.env.RESULTS_IMPORT_ADMIN_PASSWORD || '';
  const tournamentId = process.env.RESULTS_IMPORT_TOURNAMENT_ID || '';
  const tournamentName = process.env.RESULTS_IMPORT_TOURNAMENT_NAME || DEFAULT_TOURNAMENT_NAME;
  const competitionCode = process.env.RESULTS_IMPORT_COMPETITION_CODE || '';

  return {
    apiBaseUrl,
    adminEmail,
    adminPassword,
    tournamentId,
    tournamentName,
    competitionCode,
  };
}

function requireConfig(config) {
  const missing = [];
  if (!config.apiBaseUrl) {
    missing.push('RESULTS_IMPORT_API_BASE_URL');
  }
  if (!config.adminEmail) {
    missing.push('RESULTS_IMPORT_ADMIN_EMAIL');
  }
  if (!config.adminPassword) {
    missing.push('RESULTS_IMPORT_ADMIN_PASSWORD');
  }
  return missing;
}

async function apiCall(baseUrl, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { response, payload };
}

async function loginAsAdmin(baseUrl, email, password) {
  const { response, payload } = await apiCall(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (!response.ok || !payload.token) {
    throw new Error(
      `Admin login failed (${response.status}): ${payload?.error || payload?.message || 'no token returned'}`
    );
  }

  return payload.token;
}

async function resolveTournamentId(baseUrl, token, configuredId, tournamentName) {
  if (configuredId) {
    return configuredId;
  }

  const { response, payload } = await apiCall(baseUrl, '/api/tournaments', { token });
  if (!response.ok) {
    throw new Error(
      `Could not list tournaments (${response.status}): ${payload?.error || 'unknown error'}`
    );
  }

  const tournaments = Array.isArray(payload) ? payload : payload?.tournaments || [];
  const match = tournaments.find((tournament) => tournament?.name === tournamentName);
  if (!match) {
    throw new Error(`Tournament "${tournamentName}" not found via /api/tournaments`);
  }
  return match.id;
}

async function importResults(baseUrl, token, tournamentId, competitionCode) {
  const { response, payload } = await apiCall(
    baseUrl,
    `/api/tournaments/${tournamentId}/import-results`,
    {
      method: 'POST',
      token,
      body: competitionCode ? { competitionCode } : {},
    }
  );

  return { response, payload };
}

async function main() {
  const config = readConfig();
  const missing = requireConfig(config);

  if (missing.length > 0) {
    console.log(
      `[import-results] Skipping run: missing env vars (${missing.join(', ')}). Configure them to enable the importer.`
    );
    return 0;
  }

  const token = await loginAsAdmin(config.apiBaseUrl, config.adminEmail, config.adminPassword);
  const tournamentId = await resolveTournamentId(
    config.apiBaseUrl,
    token,
    config.tournamentId,
    config.tournamentName
  );

  console.log(`[import-results] Importing results for tournament ${tournamentId}`);
  const { response, payload } = await importResults(
    config.apiBaseUrl,
    token,
    tournamentId,
    config.competitionCode
  );

  if (response.status === 503) {
    console.log(
      `[import-results] Server reported importer is not configured: ${payload?.error || 'no message'}`
    );
    return 0;
  }

  if (!response.ok) {
    throw new Error(
      `Import request failed (${response.status}): ${payload?.error || JSON.stringify(payload)}`
    );
  }

  console.log('[import-results] Import complete.');
  console.log(JSON.stringify(payload, null, 2));
  return 0;
}

main()
  .then((code) => {
    process.exit(code || 0);
  })
  .catch((error) => {
    console.error('[import-results]', error.message);
    process.exit(1);
  });
