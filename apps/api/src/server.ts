import { buildApp } from './app.js';
import { env } from './config/env.js';
import { ensureBucket } from './lib/storage.js';

/**
 * Process entrypoint. Boots the app, ensures the storage bucket exists, starts
 * listening, and wires graceful shutdown (drain connections, close Prisma +
 * storage) on SIGINT/SIGTERM.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await ensureBucket();
  } catch (err) {
    app.log.warn({ err }, 'could not ensure storage bucket at boot (continuing)');
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down gracefully');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => void shutdown(signal));
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
