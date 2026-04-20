import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const ROOT_DIR = new URL('../../', import.meta.url);
const DEFAULT_LOCAL_TEST_DATABASE_URL = 'postgresql://prode:prode123@127.0.0.1:5432/postgres';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

function isLocalDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    return false;
  }

  const url = new URL(databaseUrl);
  return ['127.0.0.1', 'localhost'].includes(url.hostname);
}

function withDatabase(databaseUrl, databaseName) {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function runPrismaMigrate(databaseUrl) {
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  execFileSync(npxCommand, ['prisma', 'migrate', 'deploy'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  });
}

export async function createApiTestEnvironment() {
  const adminDatabaseUrl = process.env.TEST_DATABASE_URL
    || (isLocalDatabaseUrl(process.env.DATABASE_URL) ? process.env.DATABASE_URL : null)
    || DEFAULT_LOCAL_TEST_DATABASE_URL;

  if (!adminDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set to run API integration tests');
  }

  const databaseName = `prode_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const testDatabaseUrl = withDatabase(adminDatabaseUrl, databaseName);
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });

  await adminPool.query(`CREATE DATABASE "${databaseName}"`);

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

  runPrismaMigrate(testDatabaseUrl);

  const app = require('../../api/app.cjs');
  const prisma = require('../../api/db.cjs');

  const server = app.listen(0);
  await once(server, 'listening');

  const port = server.address().port;

  return {
    prisma,
    databaseName,
    baseUrl: `http://127.0.0.1:${port}`,
    async dispose() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });

      await prisma.$disconnect();
      if (prisma.__pool?.end) {
        await prisma.__pool.end();
      }
      await adminPool.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
      `, [databaseName]);
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await adminPool.end();
    },
  };
}

export async function apiRequest(baseUrl, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(body
        ? {
            'Content-Type': 'application/json',
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { response, payload };
}
