import { describe, expect, it } from 'vitest';
import { sanitizeGame } from '../core/sanitize';
import { engineOf } from '../registry';
import { hitsterEngine } from './engine';
import * as H from './game';

const duo = [
  { pid: 'a', name: 'Anna', color: 0 },
  { pid: 'b', name: 'Ben', color: 1 },
];

const card = (id: string, year: number): H.HitsterCard => ({ id, title: `Song ${id}`, artist: 'Band', year });

/** Stapel mit klar festgelegter Reihenfolge: die Startkarten sind die letzten der Liste (pop). */
function game(deck: H.HitsterCard[], options: Partial<H.HitsterOptions> = {}): H.HitsterGame {
  const g = H.create(duo, options);
  // ohne Mischen: random() = 0.999… lässt jede Karte an ihrer Stelle
  expect(H.start(g, deck, () => 0.999)).toBeNull();
  return g;
}

const fill = (n: number, from = 1980) => Array.from({ length: n }, (_, i) => card('t' + i, from + i));

describe('Hitster: Start', () => {
  it('verteilt je eine Startkarte und gibt Token', () => {
    const g = game(fill(10), { startTokens: 3 });
    expect(g.players.map(p => p.line.length)).toEqual([1, 1]);
    expect(g.players.map(p => p.tokens)).toEqual([3, 3]);
    expect(g.deck).toHaveLength(8);
    expect(g.started).toBe(true);
  });

  it('lehnt zu kleine Stapel ab und entfernt doppelte Songs', () => {
    const g = H.create(duo);
    expect(H.start(g, fill(3))).toMatch(/Zu wenige Songs/);
    expect(g.started).toBe(false);
    const dupes = [...fill(8), ...fill(8)];
    expect(H.start(g, dupes)).toBeNull();
    expect(g.deck.length + g.players.length).toBe(8);
  });

  it('startet nur einmal', () => {
    const g = game(fill(10));
    expect(H.start(g, fill(10))).toBe('Das Spiel läuft schon');
  });
});

describe('Hitster: Legen und Auflösen', () => {
  it('prüft den Platz zwischen den Nachbarn, gleiche Jahre zählen als richtig', () => {
    const line = [card('a', 1980), card('b', 1990), card('c', 1990), card('d', 2000)];
    expect(H.fits(line, 0, 1975)).toBe(true);
    expect(H.fits(line, 0, 1985)).toBe(false);
    expect(H.fits(line, 1, 1985)).toBe(true);
    expect(H.fits(line, 1, 1990)).toBe(true);
    expect(H.fits(line, 2, 1990)).toBe(true);
    expect(H.fits(line, 3, 1990)).toBe(true);
    expect(H.fits(line, 4, 2005)).toBe(true);
    expect(H.fits(line, 4, 1995)).toBe(false);
    expect(H.fits(line, 9, 1995)).toBe(false);
  });

  it('legt eine richtige Karte in den Zeitstrahl und gibt den Zug weiter', () => {
    const g = game(fill(10));
    g.players[0]!.line = [card('first', 2000)];
    g.deck = [card('new', 2010), ...g.deck];
    H.draw(g);
    expect(H.place(g, 1)).toBe(true);
    expect(g.current!.phase).toBe('placed');
    expect(H.reveal(g)!.ok).toBe(true);
    expect(g.players[0]!.line.map(x => x.id)).toEqual(['first', 'new']);
    const end = H.endTurn(g)!;
    expect(end.next).toBe(1);
    expect(g.current).toBeNull();
  });

  it('wirft eine falsche Karte auf den Ablagestapel', () => {
    const g = game(fill(10));
    g.players[0]!.line = [card('first', 2000)];
    g.deck = [card('old', 1970), ...g.deck];
    H.draw(g);
    H.place(g, 1); // 1970 hinter 2000 ist falsch
    expect(H.reveal(g)!.ok).toBe(false);
    expect(g.discard.map(c => c.id)).toEqual(['old']);
    expect(H.active(g).line).toHaveLength(1);
  });

  it('erlaubt Platzwechsel bis zur Auflösung, danach nicht mehr', () => {
    const g = game(fill(10));
    H.draw(g);
    expect(H.place(g, 0)).toBe(true);
    expect(H.place(g, 1)).toBe(true);
    expect(H.place(g, 5)).toBe(false);
    H.reveal(g);
    expect(H.place(g, 0)).toBe(false);
    expect(H.reveal(g)).toBeNull();
  });

  it('zieht nicht doppelt und nicht ohne Karte', () => {
    const g = game(fill(7));
    expect(H.draw(g)).not.toBeNull();
    expect(H.draw(g)).toBeNull();
    const done = game(fill(7));
    done.deck = [];
    expect(H.draw(done)).toBeNull();
  });
});

describe('Hitster: Token', () => {
  it('überspringt für Token und holt eine neue Karte', () => {
    const g = game(fill(10));
    H.draw(g);
    const old = g.current!.card;
    expect(H.skip(g)).toBeNull();
    expect(H.active(g).tokens).toBe(1);
    expect(g.discard).toEqual([old]);
    expect(g.current!.card.id).not.toBe(old.id);
    expect(g.current!.phase).toBe('listen');
  });

  it('überspringt nicht ohne Token oder nach dem Legen', () => {
    const g = game(fill(10), { startTokens: 0 });
    H.draw(g);
    expect(H.skip(g)).toBe('Zu wenige Token');
    g.players[0]!.tokens = 2;
    H.place(g, 0);
    expect(H.skip(g)).toMatch(/bevor die Karte gelegt/);
  });

  it('belohnt Titel und Interpret', () => {
    const g = game(fill(10));
    expect(H.rewardGuess(g)).toBe('Anna: +1 Token');
    expect(H.active(g).tokens).toBe(3);
    const none = game(fill(10), { guessReward: 0 });
    expect(H.rewardGuess(none)).toBeNull();
  });

  it('kauft eine Karte an die passende Stelle, wenn aktiviert', () => {
    const g = game(fill(10), { startTokens: 3, buyCost: 3 });
    expect(H.buyCard(g)).toMatch(/gekauft/);
    expect(H.active(g).tokens).toBe(0);
    expect(H.active(g).line).toHaveLength(2);
    const years = H.active(g).line.map(c => c.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(H.buyCard(g)).toBe('Zu wenige Token');
    const off = game(fill(10), { buyCost: 0 });
    expect(H.buyCard(off)).toBeNull();
  });
});

describe('Hitster: Jahr korrigieren', () => {
  it('bewertet eine aufgelöste Karte neu', () => {
    const g = game(fill(10));
    g.players[0]!.line = [card('first', 2000)];
    g.deck = [card('x', 1970), ...g.deck];
    H.draw(g);
    H.place(g, 1);
    expect(H.reveal(g)!.ok).toBe(false); // laut Quelle 1970, also vor 2000

    expect(H.fixYear(g, 'x', 2010)).toMatch(/Song x/); // Original ist doch später erschienen
    expect(g.current!.ok).toBe(true);
    expect(H.active(g).line.map(c => c.id)).toEqual(['first', 'x']);
    expect(g.discard).toHaveLength(0);

    hitsterEngine.undo(g);
    expect(g.current!.ok).toBe(false);
    expect(g.discard).toHaveLength(1);
    expect(H.active(g).line).toHaveLength(1);
  });

  it('sortiert den Zeitstrahl neu und ignoriert unmögliche Jahre', () => {
    const g = game(fill(10));
    const c = H.active(g).line[0]!;
    expect(H.fixYear(g, c.id, 1800)).toBeNull();
    expect(H.fixYear(g, c.id, c.year)).toBeNull();
    expect(H.fixYear(g, 'nix', 2000)).toBeNull();
  });
});

describe('Hitster: Ziel und Ergebnis', () => {
  it('meldet, wer das Ziel erreicht hat', () => {
    const g = game(fill(12), { goal: 3 });
    expect(H.reached(g)).toBeNull();
    g.players[1]!.line.push(card('x', 2000), card('y', 2001));
    expect(H.reached(g)).toEqual(['Ben']);
  });

  it('rankt nach Karten und zeigt Token', () => {
    const g = game(fill(12));
    g.players[1]!.line.push(card('x', 2000));
    const r = hitsterEngine.result(g);
    expect(r.map(x => x.name)).toEqual(['Ben', 'Anna']);
    expect(r[0]!.total).toBe(2);
    expect(r[0]!.sub).toBe('2 Token');
  });

  it('kann erst nach dem Start ausgewertet werden', () => {
    const g = H.create(duo);
    expect(hitsterEngine.cannotFinish(g)).toMatch(/noch nicht begonnen/);
    expect(hitsterEngine.isEmpty(g)).toBe(true);
    start(g);
    expect(hitsterEngine.cannotFinish(g)).toBeNull();
    expect(hitsterEngine.isEmpty(g)).toBe(true);
    H.draw(g);
    expect(hitsterEngine.isEmpty(g)).toBe(false);
  });
});

function start(g: H.HitsterGame) {
  H.start(g, fill(12));
}

describe('Hitster: Rückgängig', () => {
  it('nimmt Ziehen, Legen, Auflösen und Zugende schrittweise zurück', () => {
    const g = game(fill(10));
    const deckBefore = g.deck.map(c => c.id);
    H.draw(g);
    H.place(g, 1);
    H.reveal(g);
    H.endTurn(g);
    expect(g.turn).toBe(1);

    expect(hitsterEngine.describeUndo(g)).toBe('Zug zurücknehmen');
    hitsterEngine.undo(g);
    expect(g.turn).toBe(0);
    expect(g.current!.phase).toBe('revealed');

    hitsterEngine.undo(g); // Auflösung
    expect(g.current!.phase).toBe('placed');
    expect(H.active(g).line).toHaveLength(1);
    expect(g.discard).toHaveLength(0);

    hitsterEngine.undo(g); // Platz
    expect(g.current!.phase).toBe('listen');
    hitsterEngine.undo(g); // Ziehen
    expect(g.current).toBeNull();
    expect(g.deck.map(c => c.id)).toEqual(deckBefore);
    expect(hitsterEngine.undo(g)).toBeNull();
  });

  it('macht Überspringen, Token und Kauf rückgängig', () => {
    const g = game(fill(10), { startTokens: 4, buyCost: 3 });
    H.draw(g);
    const first = g.current!.card.id;
    H.skip(g);
    hitsterEngine.undo(g);
    expect(g.current!.card.id).toBe(first);
    expect(H.active(g).tokens).toBe(4);
    expect(g.discard).toHaveLength(0);

    H.rewardGuess(g);
    hitsterEngine.undo(g);
    expect(H.active(g).tokens).toBe(4);

    H.endTurn(g); // ohne aufgelöste Karte passiert nichts
    g.current = null;
    H.buyCard(g);
    hitsterEngine.undo(g);
    expect(H.active(g).line).toHaveLength(1);
    expect(H.active(g).tokens).toBe(4);
  });

  it('öffnet ein beendetes Spiel wieder', () => {
    const g = game(fill(10));
    g.status = 'finished';
    H.draw(g);
    hitsterEngine.undo(g);
    expect(g.status).toBe('active');
  });
});

describe('Hitster: fremde Daten', () => {
  it('bereinigt Müll aus Server, Backup und Live-Tisch', () => {
    const g = game(fill(10));
    H.draw(g);
    const raw = JSON.parse(JSON.stringify(g));
    raw.rules = { goal: 999, startTokens: -4, skipCost: 'x', buyCost: 50 };
    raw.deck.push({ id: 'bad id!', year: 2000 }, { id: 'ok', title: 'T', artist: 'A', year: 1500 }, 42, null);
    raw.players[0].tokens = 100000;
    raw.players[0].line.push({ id: 'z', title: 'Z', artist: 'Z', year: 1985 });
    raw.current.slot = 99;
    raw.current.phase = 'revealed';
    raw.current.card.title = 'x'.repeat(500);

    const clean = sanitizeGame(raw, engineOf) as H.HitsterGame;
    expect(clean.rules).toEqual({ goal: 30, startTokens: 0, skipCost: 0, guessReward: 1, buyCost: 10 });
    expect(clean.deck.every(c => c.year >= H.MIN_YEAR)).toBe(true);
    expect(clean.deck.find(c => c.id === 'ok')).toBeUndefined();
    expect(clean.players[0]!.tokens).toBe(H.MAX_TOKENS);
    const years = clean.players[0]!.line.map(c => c.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(clean.current!.slot).toBeLessThanOrEqual(clean.players[0]!.line.length);
    expect(clean.current!.card.title.length).toBe(80);
    expect(clean.undo).toEqual([]);
  });

  it('verwirft eine aufgelöste Karte ohne Platz', () => {
    const g = game(fill(10));
    H.draw(g);
    const raw = JSON.parse(JSON.stringify(g));
    raw.current.phase = 'revealed';
    raw.current.slot = null;
    const clean = sanitizeGame(raw, engineOf) as H.HitsterGame;
    expect(clean.current!.phase).toBe('listen');
  });

  it('übernimmt Revanche mit denselben Regeln und Playlist', () => {
    const g = H.create(duo, { goal: 7, source: { id: 'abc123', name: 'Meine Playlist' } });
    const next = hitsterEngine.rematch(g, p => p.name);
    expect(next.rules.goal).toBe(7);
    expect(next.source).toEqual({ id: 'abc123', name: 'Meine Playlist' });
    expect(next.players.map(p => p.name)).toEqual(['Ben', 'Anna']);
    expect(next.started).toBe(false);
  });
});

describe('Hitster: Hilfen', () => {
  it('mischt reproduzierbar und baut die Spotify-Adresse', () => {
    const list = [1, 2, 3, 4, 5];
    expect(H.shuffle(list, () => 0)).toEqual([2, 3, 4, 5, 1]);
    expect(list).toEqual([1, 2, 3, 4, 5]);
    expect(H.trackUri({ id: 'abc' })).toBe('spotify:track:abc');
  });

  it('findet die Einfügestelle hinter gleichen Jahren', () => {
    const line = [card('a', 1980), card('b', 1990), card('c', 1990)];
    expect(H.insertionIndex(line, 1990)).toBe(3);
    expect(H.insertionIndex(line, 1985)).toBe(1);
    expect(H.insertionIndex(line, 1970)).toBe(0);
  });
});

describe('Hitster: Einstellungen und Bibliothek', () => {
  const opts = (o: Record<string, unknown>) => hitsterEngine.normalizeOptions(o);

  it('begrenzt und bereinigt Playlists und Jahre', () => {
    const o = opts({
      decks: [{ id: 'a1', name: 'Eins', count: 5, at: 1 }, { id: 'a1', name: 'Doppelt' }, { id: 'bad id', name: 'x' }, 'müll'],
      years: { t1: { y: 1999, src: 'mb', unsure: true }, 'bad id': { y: 2000, src: 'mb' }, t2: { y: 1800, src: 'mb' }, t3: { y: 2001, src: 'user', unsure: true }, t4: 'müll' },
    });
    expect(o.decks).toEqual([{ id: 'a1', name: 'Eins', count: 5, at: 1 }]);
    expect(o.years).toEqual({ t3: { y: 2001, src: 'user' }, t1: { y: 1999, src: 'mb', unsure: true } });
  });

  it('behält bei zu vielen Jahren die eigenen Korrekturen', () => {
    const years: Record<string, unknown> = {};
    for (let i = 0; i < H.MAX_YEARS + 50; i++) years['s' + i] = { y: 2000, src: 'spotify' };
    years['mine'] = { y: 1980, src: 'user' };
    const o = opts({ years });
    expect(Object.keys(o.years)).toHaveLength(H.MAX_YEARS);
    expect(o.years['mine']).toEqual({ y: 1980, src: 'user' });
  });

  it('führt Playlists und Jahre zweier Geräte zusammen, eigene Korrekturen gewinnen', () => {
    const older = opts({ decks: [{ id: 'a1', name: 'Alt', count: 1, at: 1 }], years: { t1: { y: 1990, src: 'user' }, t2: { y: 1970, src: 'mb' } } });
    const newer = opts({ decks: [{ id: 'b2', name: 'Neu', count: 2, at: 5 }, { id: 'a1', name: 'Alt umbenannt', count: 3, at: 9 }], years: { t1: { y: 1995, src: 'mb' }, t3: { y: 1960, src: 'mb' } }, goal: 7 });
    const merged = hitsterEngine.mergeOptions!(newer, older);
    expect(merged.goal).toBe(7);
    expect(merged.decks.map(d => d.id).sort()).toEqual(['a1', 'b2']);
    expect(merged.decks.find(d => d.id === 'a1')!.name).toBe('Alt umbenannt');
    expect(merged.years['t1']).toEqual({ y: 1990, src: 'user' });
    expect(Object.keys(merged.years).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('nimmt aus einer langen Playlist zufällige Songs statt nur den Anfang', () => {
    const g = H.create(duo);
    const many = fill(H.MAX_CARDS + 100, 1950).map((c, i) => ({ ...c, year: 1950 + (i % 70) }));
    expect(H.start(g, many, () => 0.5)).toBeNull();
    expect(g.deck.length + g.players.length).toBe(H.MAX_CARDS);
    const ids = new Set([...g.deck, ...g.players.flatMap(p => p.line)].map(c => c.id));
    expect([...ids].some(id => +id.slice(1) >= H.MAX_CARDS)).toBe(true);
  });
});

describe('Hitster: Live-Tisch', () => {
  /** Der Tisch bereinigt jedes Spiel vor dem Hochladen. Ein gültiges Spiel darf dabei nicht verändert werden, sonst gleichen sich die Handys nie an. */
  const roundtrip = (g: H.HitsterGame) => {
    return sanitizeGame(JSON.parse(JSON.stringify(g)), engineOf) as H.HitsterGame & Record<string, unknown>;
  };

  it('lässt ein gültiges Spiel in jeder Phase unverändert', () => {
    const g = game(fill(12, 1970));
    g.undo = [];
    const same = () => expect(roundtrip(g)).toEqual({ ...JSON.parse(JSON.stringify(g)), undo: [], del: false, legacy: false });

    same(); // gestartet, noch keine Karte
    H.draw(g);
    same(); // Karte gezogen
    H.place(g, 1);
    same(); // Platz gewählt
    H.reveal(g);
    same(); // aufgelöst
    H.endTurn(g);
    same(); // nächster Spieler
  });

  it('lässt auch ein Spiel vor dem Start unverändert', () => {
    const g = H.create(duo, { goal: 7, source: { id: 'abc123', name: 'Mix' } });
    expect(roundtrip(g)).toEqual({ ...JSON.parse(JSON.stringify(g)), del: false, legacy: false });
  });
});
