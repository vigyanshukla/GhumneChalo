import path from 'path';
import net from 'net';
import { execSync } from 'child_process';
import EmbeddedPostgres from 'embedded-postgres';

const DB_PORT = 54329;
const DB_NAME = 'ghumnechalo';
const DB_DIR = path.join(process.cwd(), '.pgdata');

export async function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

let pgInstance: InstanceType<typeof EmbeddedPostgres> | null = null;

export async function startDatabase(): Promise<void> {
  const inUse = await isPortInUse(DB_PORT);
  if (inUse) {
    console.log(`[db] PostgreSQL is already running on port ${DB_PORT}`);
    return;
  }

  console.log(`[db] Starting embedded PostgreSQL on port ${DB_PORT}...`);
  pgInstance = new EmbeddedPostgres({
    port: DB_PORT,
    databaseDir: DB_DIR,
    user: 'postgres',
    password: 'password',
    authMethod: 'password',
    persistent: true,
  });

  try {
    await pgInstance.initialise();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (!errorMsg.includes('already exists') && !errorMsg.includes('not empty')) {
      console.warn('[db] Note during init:', errorMsg);
    }
  }

  await pgInstance.start();

  try {
    await pgInstance.createDatabase(DB_NAME);
    console.log(`[db] Database '${DB_NAME}' verified.`);
  } catch {
    // Database might already exist
  }

  console.log(`[db] PostgreSQL is ready on port ${DB_PORT}`);
}

export async function stopDatabase(): Promise<void> {
  if (pgInstance) {
    console.log('[db] Stopping embedded PostgreSQL...');
    await pgInstance.stop();
    pgInstance = null;
    console.log('[db] PostgreSQL stopped.');
  }
}

// CLI entry point
if (process.argv[1]?.includes('scripts/db.ts') || process.argv[1]?.includes('scripts\\db.ts')) {
  const command = process.argv[2] || 'start';
  if (command === 'start') {
    startDatabase().catch(console.error);
  } else if (command === 'setup') {
    (async () => {
      await startDatabase();
      console.log('[db] Applying Prisma schema push...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: process.env });
      console.log('[db] Prisma schema successfully pushed to PostgreSQL.');
    })().catch(console.error);
  } else if (command === 'stop') {
    stopDatabase().catch(console.error);
  }
}
