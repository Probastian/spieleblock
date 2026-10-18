import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { loadConfig } from './config';
import { createLogger } from './logger';

const config = loadConfig(process.env, path.dirname(fileURLToPath(import.meta.url)));
const log = createLogger(config.log);
const app = createApp(config, log);

function shutdown(signal: string): void {
  log.info(`${signal}: speichere und beende`);
  try {
    app.shutdown();
  } catch (e) {
    log.error(e);
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.server.listen(config.port, config.host, () => {
  log.info(`Spieleblock läuft auf http://${config.host}:${config.port}  (Daten: ${config.dataDir}${config.accessKey ? ', Zugangscode aktiv' : ''})`);
});
