import './env.js';

import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

try {
  const parsedUrl = new URL(databaseUrl);

  if (['localhost', '127.0.0.1', 'neon-local'].includes(parsedUrl.hostname)) {
    neonConfig.fetchEndpoint = `http://${parsedUrl.hostname}:5432/sql`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.poolQueryViaFetch = true;
  }
} catch {
  // Keep the cloud/default Neon configuration when DATABASE_URL is not a parseable URL.
}

const sql = neon(databaseUrl);

const db = drizzle(sql);

export { db, sql };
