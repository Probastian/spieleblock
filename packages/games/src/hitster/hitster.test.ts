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

/** Platz bestätigen und, falls eine Einspruchsrunde läuft, ohne Widerspruch beenden. Gibt das Ergebnis zurück, `null`, wenn nichts zu bestätigen war. */
function reveal(g: H.HitsterGame): { ok: boolean; by: number | null; message: string } | null {
  if (!H.confirm(g)) return null;
  if (g.current?.phase === 'veto') H.closeVeto(g);
  const c = g.current!;
  return { ok: !!c.ok, by: c.stolenBy ?? null, message: H.revealMessage(g) };
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
    expect(reveal(g)!.ok).toBe(true);
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
    expect(reveal(g)!.ok).toBe(false);
    expect(g.discard.map(c => c.id)).toEqual(['old']);
    expect(H.active(g).line).toHaveLength(1);
  });

  it('erlaubt Platzwechsel bis zur Auflösung, danach nicht mehr', () => {
    const g = game(fill(10));
    H.draw(g);
    expect(H.place(g, 0)).toBe(true);
    expect(H.place(g, 1)).toBe(true);
    expect(H.place(g, 5)).toBe(false);
    reveal(g);
    expect(H.place(g, 0)).toBe(false);
    expect(reveal(g)).toBeNull();
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

  it('belohnt Titel und Interpret erst nach dem Auflösen und nur einmal je Karte', () => {
    const g = game(fill(10));
    H.draw(g);
    expect(H.rewardGuess(g)).toBeNull(); // vor dem Auflösen lässt es sich nicht prüfen
    H.place(g, 0);
    expect(H.rewardGuess(g)).toBeNull();
    reveal(g);
    expect(H.rewardGuess(g)).toBe('Anna: +1 Token');
    expect(H.active(g).tokens).toBe(3);
    expect(H.rewardGuess(g)).toBeNull();
    expect(H.active(g).tokens).toBe(3);

    const none = game(fill(10), { guessReward: 0 });
    H.draw(none);
    H.place(none, 0);
    reveal(none);
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
    expect(reveal(g)!.ok).toBe(false); // laut Quelle 1970, also vor 2000

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
  it('nimmt Ziehen, Legen, Bestätigen, Verzicht und Zugende schrittweise zurück', () => {
    const g = game(fill(10));
    const deckBefore = g.deck.map(c => c.id);
    H.draw(g);
    H.place(g, 1);
    expect(H.confirm(g)).toEqual({ resolved: false }); // Ben kann widersprechen
    expect(g.current!.phase).toBe('veto');
    expect(H.pass(g, 1)).toBeNull(); // Ben verzichtet: alle haben entschieden, es wird von selbst aufgelöst
    expect(g.current!.phase).toBe('revealed');
    H.endTurn(g);
    expect(g.turn).toBe(1);

    expect(hitsterEngine.describeUndo(g)).toBe('Zug zurücknehmen');
    hitsterEngine.undo(g);
    expect(g.turn).toBe(0);
    expect(g.current!.phase).toBe('revealed');

    // Aktion und automatische Auflösung sind ein Schritt
    expect(hitsterEngine.describeUndo(g)).toBe('Verzicht zurücknehmen');
    hitsterEngine.undo(g);
    expect(g.current!.phase).toBe('veto');
    expect(g.current!.passed).toBeUndefined();
    expect(H.active(g).line).toHaveLength(1);
    expect(g.discard).toHaveLength(0);

    hitsterEngine.undo(g); // Bestätigung
    expect(g.current!.phase).toBe('placed');
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

    H.place(g, 0);
    H.confirm(g);
    H.closeVeto(g);
    H.rewardGuess(g);
    expect(H.active(g).tokens).toBe(5);
    expect(g.current!.guessed).toBe(true);
    hitsterEngine.undo(g);
    expect(H.active(g).tokens).toBe(4);
    expect(g.current!.guessed).toBeUndefined();
    hitsterEngine.undo(g); // Einspruchsrunde beendet
    hitsterEngine.undo(g); // Bestätigung
    hitsterEngine.undo(g); // Platz
    hitsterEngine.undo(g); // Ziehen
    expect(g.current).toBeNull();
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
    expect(clean.rules).toEqual({ goal: 30, startTokens: 0, skipCost: 0, guessReward: 1, buyCost: 10, vetoCost: 1 });
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
    H.confirm(g);
    same(); // bestätigt, Einspruchsrunde läuft
    H.closeVeto(g);
    same(); // aufgelöst
    H.endTurn(g);
    same(); // nächster Spieler
  });

  it('lässt auch ein Spiel vor dem Start unverändert', () => {
    const g = H.create(duo, { goal: 7, source: { id: 'abc123', name: 'Mix' } });
    expect(roundtrip(g)).toEqual({ ...JSON.parse(JSON.stringify(g)), del: false, legacy: false });
  });
});


describe('Hitster: Einspruch', () => {
  /** Anna hat 2000 liegen, Ben 1970 und Cleo 1990. Gezogen wird ein Song von 2010 (gehört hinter die 2000). */
  function round(options: Partial<H.HitsterOptions> = {}) {
    const trio = [
      { pid: 'a', name: 'Anna', color: 0 },
      { pid: 'b', name: 'Ben', color: 1 },
      { pid: 'c', name: 'Cleo', color: 2 },
    ];
    const g = H.create(trio, options);
    H.start(g, fill(12), () => 0.999);
    g.players[0]!.line = [card('first', 2000)];
    g.current = { card: card('new', 2010), phase: 'listen', slot: null };
    return g;
  }

  /** Legt und bestätigt: danach läuft die Einspruchsrunde. */
  function confirmed(slot: number, options: Partial<H.HitsterOptions> = {}) {
    const g = round(options);
    H.place(g, slot);
    H.confirm(g);
    return g;
  }

  it('lässt den Platz bis zur Bestätigung ändern und sperrt ihn danach', () => {
    const g = round();
    H.place(g, 0);
    expect(H.place(g, 1)).toBe(true);
    expect(g.current!.phase).toBe('placed');
    expect(H.veto(g, 1, 0)).toMatch(/erst, wenn der Platz bestätigt/);
    expect(H.confirm(g)).toEqual({ resolved: false });
    expect(g.current!.phase).toBe('veto');
    expect(H.place(g, 0)).toBe(false);
    expect(g.current!.slot).toBe(1);
  });

  it('wartet, bis jeder einen Einspruch gelegt oder verzichtet hat, und löst dann von selbst auf', () => {
    const g = confirmed(1);
    expect(H.pendingVeto(g)).toEqual([1, 2]);
    expect(H.pass(g, 1)).toBeNull();
    expect(g.current!.phase).toBe('veto'); // Cleo fehlt noch
    expect(H.pendingVeto(g)).toEqual([2]);
    expect(H.veto(g, 2, 0)).toBeNull(); // Cleo widerspricht: damit haben alle entschieden
    expect(g.current!.phase).toBe('revealed');
    expect(g.current).toMatchObject({ ok: true }); // Anna lag richtig
    expect(g.players[0]!.line.map(c => c.id)).toEqual(['first', 'new']);
  });

  it('überspringt die Einspruchsrunde, wenn niemand sich einen Einspruch leisten kann oder er aus ist', () => {
    const poor = round();
    poor.players[1]!.tokens = 0;
    poor.players[2]!.tokens = 0;
    H.place(poor, 1);
    expect(H.confirm(poor)).toEqual({ resolved: true });
    expect(poor.current!.phase).toBe('revealed');

    const off = round({ vetoCost: 0 });
    H.place(off, 1);
    expect(H.confirm(off)).toEqual({ resolved: true });
    expect(H.veto(off, 1, 0)).toMatch(/ausgeschaltet/);
  });

  it('wartet nicht auf Spieler, die sich keinen Einspruch leisten können', () => {
    const g = round();
    g.players[2]!.tokens = 0; // Cleo hat nichts
    H.place(g, 1);
    H.confirm(g);
    expect(H.pendingVeto(g)).toEqual([1]);
    H.pass(g, 1);
    expect(g.current!.phase).toBe('revealed'); // Cleo musste nicht entscheiden
  });

  it('gibt eine falsch gelegte Karte dem, der per Einspruch richtig liegt', () => {
    const g = confirmed(0); // falsch: 2010 liegt nicht vor 2000
    expect(H.veto(g, 1, 1)).toBeNull(); // Ben nennt hinter der 2000
    expect(g.players[1]!.tokens).toBe(1);
    expect(g.current!.phase).toBe('veto'); // Cleo fehlt noch
    H.pass(g, 2);

    expect(g.current).toMatchObject({ phase: 'revealed', ok: false, stolenBy: 1 });
    expect(H.revealMessage(g)).toMatch(/Ben gewinnt die Karte per Einspruch/);
    expect(g.players[1]!.line.map(c => c.id)).toContain('new');
    expect(g.players[0]!.line.map(c => c.id)).toEqual(['first']);
    expect(g.discard).toHaveLength(0);

    hitsterEngine.undo(g); // Verzicht von Cleo samt Auflösung
    expect(g.current!.phase).toBe('veto');
    expect(g.players[1]!.line.map(c => c.id)).not.toContain('new');
    expect(g.players[1]!.tokens).toBe(1);
    hitsterEngine.undo(g); // Einspruch von Ben
    expect(g.players[1]!.tokens).toBe(2);
    expect(g.current!.vetoes).toBeUndefined();
    expect(H.pendingVeto(g)).toEqual([1, 2]);
  });

  it('lässt das Token verfallen, wenn der Spieler am Zug richtig lag', () => {
    const g = confirmed(1);
    H.veto(g, 2, 0);
    H.pass(g, 1);
    expect(g.current).toMatchObject({ ok: true });
    expect(g.players[2]!.tokens).toBe(1);
    expect(g.players[2]!.line).toHaveLength(1);
  });

  it('wirft die Karte weg, wenn auch der Einspruch falsch liegt', () => {
    const g = round();
    g.players[0]!.line = [card('f1', 1980), card('f2', 2000)];
    H.place(g, 0); // falsch: 2010 gehört ans Ende
    H.confirm(g);
    H.veto(g, 1, 1); // Ben legt zwischen 1980 und 2000: auch falsch
    H.pass(g, 2);
    expect(g.current).toMatchObject({ ok: false });
    expect(g.current!.stolenBy).toBeUndefined();
    expect(g.discard.map(c => c.id)).toEqual(['new']);
    expect(g.players[1]!.tokens).toBe(1); // das Token ist trotzdem weg
  });

  it('gibt die Karte bei mehreren richtigen Einsprüchen dem, der reihum zuerst dran ist', () => {
    const g = round();
    // 2000 passt zwischen 1990 und 2010 an drei Plätzen (vor, zwischen und hinter den beiden 2000ern)
    g.players[0]!.line = [card('f1', 1990), card('f2', 2000), card('f3', 2000), card('f4', 2010)];
    g.current = { card: card('mid', 2000), phase: 'listen', slot: null };
    H.place(g, 0); // falsch: 2000 liegt nicht vor der 1990
    H.confirm(g);
    H.veto(g, 2, 2); // Cleo zuerst, richtig
    H.veto(g, 1, 1); // dann Ben, auch richtig: im Uhrzeigersinn nach Anna kommt aber Ben vor Cleo
    expect(g.current).toMatchObject({ ok: false, stolenBy: 1 });
    expect(g.players[1]!.line.map(c => c.id)).toContain('mid');
    expect(g.players[2]!.line.map(c => c.id)).not.toContain('mid');
  });

  it('prüft die Voraussetzungen', () => {
    const g = confirmed(0);
    expect(H.veto(g, 0, 1)).toMatch(/Spieler am Zug/);
    expect(H.veto(g, 1, 0)).toMatch(/schon belegt/);
    expect(H.veto(g, 1, 9)).toMatch(/Ungültiger Platz/);
    expect(H.veto(g, 1, 1)).toBeNull();
    expect(g.current!.phase).toBe('veto'); // Cleo hat noch nicht entschieden
    expect(H.pass(g, 1)).toMatch(/schon entschieden/);
    expect(H.veto(g, 2, 1)).toMatch(/schon belegt/); // Platz 1 hat Ben
    expect(H.pass(g, 0)).toMatch(/Spieler am Zug/);
    expect(H.pass(round(), 1)).toMatch(/keine Einspruchsrunde/);

    const poor = round();
    poor.players[2]!.tokens = 0;
    H.place(poor, 0);
    H.confirm(poor);
    expect(H.veto(poor, 2, 1)).toBe('Zu wenige Token');
  });

  it('kostet nach den Regeln', () => {
    const g = confirmed(0, { vetoCost: 2 });
    expect(H.veto(g, 1, 1)).toBeNull();
    expect(g.players[1]!.tokens).toBe(0);
  });

  it('lässt die Runde beenden, ohne auf Säumige zu warten', () => {
    const g = confirmed(0);
    H.veto(g, 1, 1);
    expect(g.current!.phase).toBe('veto'); // Cleo hat noch nicht entschieden
    expect(H.closeVeto(g)).toBeNull();
    expect(g.current).toMatchObject({ phase: 'revealed', stolenBy: 1 });
    expect(g.current!.passed).toEqual({ 2: true });

    hitsterEngine.undo(g);
    expect(g.current!.phase).toBe('veto');
    expect(g.current!.passed).toBeUndefined();
    expect(H.pendingVeto(g)).toEqual([2]);
    expect(H.closeVeto(round())).toMatch(/keine Einspruchsrunde/);
  });

  it('bewertet beim Jahr-Korrigieren auch den Einspruch neu', () => {
    const g = confirmed(0);
    H.veto(g, 1, 1);
    H.pass(g, 2); // 2010: Ben bekommt sie
    expect(g.current!.stolenBy).toBe(1);

    H.fixYear(g, 'new', 1990); // eigentlich vor der 2000: Anna lag mit Platz 0 richtig
    expect(g.current).toMatchObject({ ok: true });
    expect(g.current!.stolenBy).toBeUndefined();
    expect(g.players[1]!.line.map(c => c.id)).not.toContain('new');
    expect(g.players[0]!.line.map(c => c.id)).toEqual(['new', 'first']);

    H.fixYear(g, 'new', 2020); // jetzt wieder falsch, Ben liegt richtig
    expect(g.current!.stolenBy).toBe(1);
    expect(g.players[1]!.line.map(c => c.id)).toContain('new');
  });

  it('bleibt beim Bereinigen für den Live-Tisch unverändert', () => {
    const g = confirmed(0);
    const same = () => expect(sanitizeGame(JSON.parse(JSON.stringify(g)), engineOf)).toEqual({ ...JSON.parse(JSON.stringify(g)), undo: [], del: false, legacy: false });
    same(); // Einspruchsrunde, noch keine Entscheidung
    H.veto(g, 1, 1);
    same(); // ein Einspruch
    H.pass(g, 2);
    same(); // aufgelöst, Karte gestohlen
    H.rewardGuess(g);
    same(); // Token vergeben
  });

  it('entfernt unmögliche Einsprüche und Verzichte aus fremden Daten', () => {
    const g = confirmed(0);
    const raw = JSON.parse(JSON.stringify(g));
    raw.current.vetoes = { 0: 1, 1: 0, 2: 1, 99: 3, x: 1 }; // 0 = Spieler am Zug, 1 = gewählter Platz, 2 gültig, Rest außerhalb
    raw.current.passed = { 0: true, 2: true, 1: true, 99: true };
    const clean = sanitizeGame(raw, engineOf) as H.HitsterGame;
    expect(clean.current!.vetoes).toEqual({ 2: 1 });
    expect(clean.current!.passed).toEqual({ 1: true }); // 0 ist der Spieler am Zug, 2 hat Einspruch gelegt
  });

  it('versteht Einsprüche aus der Fassung mit Liste und stellt eine laufende Runde wieder her', () => {
    const g = confirmed(0);
    const raw = JSON.parse(JSON.stringify(g));
    raw.current.phase = 'placed'; // früher liefen Einsprüche noch im Zustand „gelegt“
    raw.current.vetoes = [{ pi: 1, slot: 1 }];
    const clean = sanitizeGame(raw, engineOf) as H.HitsterGame;
    expect(clean.current).toMatchObject({ phase: 'veto', vetoes: { 1: 1 } });
  });
});

describe('Film-Zeitstrahl', () => {
  const films = Array.from({ length: 12 }, (_, i) => ({ id: 'm' + (100 + i), title: 'Film ' + i, artist: i % 2 ? 'Original ' + i : '', year: 1950 + i * 5, cover: i % 3 ? undefined : `abcdefgh${i}.jpg` }));

  it('legt Spiele vom Typ film an, ohne Titel-Bonus, und akzeptiert Plakate', async () => {
    const { filmEngine } = await import('./engine');
    const { sanitizeGame } = await import('../core/sanitize');
    const { engineOf } = await import('../registry');
    const g = filmEngine.create([{ pid: null, name: 'A', color: 0 }, { pid: null, name: 'B', color: 1 }], { ...filmEngine.defaultOptions, guessReward: 2 });
    expect(g.type).toBe('film');
    expect(g.rules.guessReward).toBe(0);
    expect(H.start(g, films)).toBeNull();
    expect(g.deck.some(c => c.cover?.endsWith('.jpg'))).toBe(true);
    expect(H.coverUrl({ cover: 'abcdefgh0.jpg' })).toBe('https://image.tmdb.org/t/p/w342/abcdefgh0.jpg');
    const clean = sanitizeGame(JSON.parse(JSON.stringify(g)), engineOf) as H.HitsterGame;
    expect(clean.type).toBe('film');
    expect(clean.deck).toHaveLength(g.deck.length);
    expect(filmEngine.label(g)).toBe('Film-Zeitstrahl');
    expect(filmEngine.statsKey(g)).toBe('film-10');
    expect(H.start(filmEngine.create([{ pid: null, name: 'A', color: 0 }], filmEngine.defaultOptions), films.slice(0, 3))).toMatch(/Zu wenige Filme/);
  });
});
