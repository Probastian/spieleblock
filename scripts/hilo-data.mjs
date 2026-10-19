#!/usr/bin/env node
/**
 * Zieht die Zahlen für „Mehr oder weniger“ aus Wikidata und schreibt sie nach
 * packages/web/src/app/games/hilo/hilo-data.json.
 *
 *   node scripts/hilo-data.mjs            alle Kategorien
 *   node scripts/hilo-data.mjs staedte    nur diese (Komma-getrennt)
 *
 * Das Skript läuft von Hand, nicht beim Bauen: Die Daten stecken im Repository, damit das Spiel ohne Netz läuft
 * und die Werte vorher durchgesehen werden können.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/web/src/app/games/hilo/hilo-data.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'spieleblock-datagen/1.0 (private Spieleabend-App; https://github.com/Probastian/spieleblock)';

/**
 * `prop`: Wikidata-Eigenschaft. `norm`: normalisierter Wert (SI-Einheit: m, m², s) statt der eingetragenen Einheit.
 * `div`: Umrechnung in die angezeigte Einheit. `country`: Land als Zusatz anzeigen.
 */
const CATEGORIES = [
  { id: 'staedte', name: 'Städte der Welt', metric: 'Einwohner', unit: 'Einwohner', classes: ['Q515', 'Q1549591'], prop: 'P1082', minLinks: 90, take: 150, country: true, min: 50_000 },
  { id: 'deutsche-staedte', name: 'Deutsche Städte', metric: 'Einwohner', unit: 'Einwohner', classes: ['Q515', 'Q1549591', 'Q253019'], prop: 'P1082', minLinks: 12, take: 110, countryIs: 'Q183', min: 30_000, exclude: ['Schwabing'] },
  { id: 'laender-einwohner', name: 'Länder: Einwohner', metric: 'Einwohner', unit: 'Einwohner', classes: ['Q3624078'], prop: 'P1082', minLinks: 40, take: 120, min: 10_000 },
  { id: 'laender-flaeche', name: 'Länder: Fläche', metric: 'Fläche', unit: 'km²', classes: ['Q3624078'], prop: 'P2046', norm: true, div: 1e6, minLinks: 40, take: 120, min: 1 },
  { id: 'berge', name: 'Berge', metric: 'Höhe', unit: 'm', classes: ['Q8502'], prop: 'P2044', norm: true, minLinks: 30, take: 130, country: true, min: 500 },
  { id: 'vulkane', name: 'Vulkane', metric: 'Höhe', unit: 'm', classes: ['Q8072'], prop: 'P2044', norm: true, minLinks: 18, take: 80, country: true, min: 100 },
  { id: 'fluesse', name: 'Flüsse', metric: 'Länge', unit: 'km', classes: ['Q4022'], prop: 'P2043', norm: true, div: 1000, minLinks: 30, take: 110, country: true, min: 100 },
  { id: 'wolkenkratzer', name: 'Wolkenkratzer', metric: 'Höhe', unit: 'm', classes: ['Q11303'], prop: 'P2048', norm: true, minLinks: 14, take: 90, country: true, min: 150 },
  { id: 'seen', name: 'Seen', metric: 'Fläche', unit: 'km²', classes: ['Q23397'], prop: 'P2046', norm: true, div: 1e6, minLinks: 30, take: 90, country: true, min: 10 },
  { id: 'inseln', name: 'Inseln', metric: 'Fläche', unit: 'km²', classes: ['Q23442'], prop: 'P2046', norm: true, div: 1e6, minLinks: 50, take: 100, country: true, min: 5 },
  { id: 'stadien', name: 'Stadien', metric: 'Zuschauerplätze', unit: 'Plätze', classes: ['Q483110'], prop: 'P1083', minLinks: 25, take: 100, country: true, min: 10_000 },
  { id: 'wasserfaelle', name: 'Wasserfälle', metric: 'Höhe', unit: 'm', classes: ['Q34038'], prop: 'P2048', norm: true, minLinks: 16, take: 70, country: true, min: 20 },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function query(c) {
  const values = c.classes.map(q => `wd:${q}`).join(' ');
  const valuePath = c.norm ? `?st psn:${c.prop} ?nv. ?nv wikibase:quantityAmount ?v.` : `?st ps:${c.prop} ?v.`;
  const country = c.countryIs
    ? `?item wdt:P17 wd:${c.countryIs}.`
    : c.country
      ? `OPTIONAL { ?item wdt:P17 ?c. ?c rdfs:label ?cl. FILTER(LANG(?cl) = "de") }`
      : '';
  return `SELECT ?item ?label ?v ?sl ?cl WHERE {
  VALUES ?cls { ${values} }
  ?item wdt:P31 ?cls; wikibase:sitelinks ?sl.
  FILTER(?sl >= ${c.minLinks})
  ?item p:${c.prop} ?st.
  ?st a wikibase:BestRank.
  ${valuePath}
  ${country}
  ?item rdfs:label ?label. FILTER(LANG(?label) = "de")
}
ORDER BY DESC(?sl)
LIMIT 800`;
}

async function run(c) {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query(c))}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
    if (res.ok) return (await res.json()).results.bindings;
    console.error(`  ${c.id}: HTTP ${res.status}, Versuch ${attempt}`);
    await sleep(3000 * attempt);
  }
  throw new Error(`${c.id}: Abfrage fehlgeschlagen`);
}

const round = (v, digits) => Number(v.toFixed(digits));

function build(c, rows) {
  const items = new Map();
  for (const r of rows) {
    const id = r.item.value.split('/').pop();
    const label = r.label.value.trim();
    if (!label || /^Q\d+$/.test(label) || c.exclude?.includes(label)) continue;
    let value = Number(r.v.value);
    if (!Number.isFinite(value)) continue;
    if (c.div) value /= c.div;
    if (value < (c.min ?? 0)) continue;
    // Wikidata liefert nur die beste Angabe (bevorzugt, sonst normal); gibt es mehrere, zählt die größte
    const prev = items.get(id);
    if (prev && prev.value >= value) continue;
    items.set(id, { id, name: label, value, links: Number(r.sl.value), note: r.cl?.value });
  }
  // Gleiche Namen (z. B. zwei „Springfield“) würden verwirren
  const byName = new Map();
  for (const it of items.values()) byName.set(it.name, (byName.get(it.name) ?? 0) + 1);
  const picked = [...items.values()]
    .filter(it => byName.get(it.name) === 1)
    .sort((a, b) => b.links - a.links)
    .slice(0, c.take)
    .map(it => {
      const digits = it.value < 100 ? 1 : 0;
      const out = { n: it.name, v: round(it.value, digits) };
      if (it.note && it.note !== it.name) out.c = it.note;
      return out;
    });
  return picked;
}

const only = process.argv[2]?.split(',');
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { categories: [] };
const done = new Map(existing.categories.map(c => [c.id, c]));

for (const c of CATEGORIES) {
  if (only && !only.includes(c.id)) continue;
  console.log(`${c.id} …`);
  let rows;
  try {
    rows = await run(c);
  } catch (e) {
    console.error(`  übersprungen: ${e.message}`);
    continue;
  }
  const items = build(c, rows);
  console.log(`  ${rows.length} Zeilen → ${items.length} Einträge`);
  done.set(c.id, { id: c.id, name: c.name, metric: c.metric, unit: c.unit, items });
  save();
  await sleep(1500);
}

function save() {
  const categories = CATEGORIES.map(c => done.get(c.id)).filter(Boolean);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ source: 'Wikidata (CC0)', fetched: new Date().toISOString().slice(0, 10), categories }) + '\n');
}
save();
console.log(`geschrieben: ${OUT}`);
