// Bündelt den Server zu einer einzigen Datei (dist/server.mjs) und legt die gebaute Web-App
// daneben (dist/public). Der Ordner dist/ ist alles, was auf den Zielrechner muss.
import { build, context } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [here('./src/main.ts')],
  outfile: here('./dist/server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  tsconfig: here('./tsconfig.json'),
};

if (watch) {
  mkdirSync(here('./dist'), { recursive: true });
  const ctx = await context(options);
  await ctx.watch();
} else {
  rmSync(here('./dist'), { recursive: true, force: true });
  await build(options);
  const web = here('../web/dist/web/browser');
  if (existsSync(web)) {
    cpSync(web, here('./dist/public'), { recursive: true });
    console.log('Web-App kopiert nach dist/public');
  } else {
    console.warn('Hinweis: Web-App noch nicht gebaut (npm run build -w @spieleblock/web).');
  }
}
