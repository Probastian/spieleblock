import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { engineOf, pluralize } from '@spieleblock/games';
import { seatPlayers } from '../../core/state/seating';
import { Store } from '../../core/state/store.service';
import { ToastService } from '../../core/ui/toast.service';
import { uiOf } from '../../games/registry';
import { inputValue } from '../../shared/dom';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { GameTileComponent } from '../../shared/ui/game-tile.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LazyComponent } from '../../shared/ui/lazy.component';

/** Neues Spiel einrichten: Spiel-Einstellungen, Spieler in Reihenfolge wählen, starten. */
@Component({
  selector: 'sb-setup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, GameTileComponent, IconComponent, LazyComponent],
  template: `
    @if (ui(); as ui) {
      <header class="top">
        <div class="wrap topbar">
          <button class="iconbtn" type="button" (click)="back()" aria-label="Zurück zum Hauptmenü"><svg sb-icon name="chevL"></svg></button>
          <div class="brand"><div class="t">Neues Spiel</div><div class="sub">{{ ui.name }}</div></div>
        </div>
      </header>

      <main class="wrap setup">
        <div class="shead">
          <span [sbGameTile]="ui"></span>
          <div><div class="gname">{{ ui.name }}</div><span class="gblurb">{{ ui.blurb }}</span></div>
        </div>

        <sb-lazy [loader]="ui.setup" [inputs]="{ playerCount: selected().length }" />

        <section class="card" aria-labelledby="hP">
          <div class="card-h">
            <h2 class="lbl" id="hP">Spieler <span class="count">{{ selected().length }}/{{ max() }}</span></h2>
            @if (selected().length > 1) {
              <button class="link" type="button" (click)="shuffle()">Reihenfolge mischen</button>
            }
          </div>

          @if (roster().length) {
            <ul class="plist2">
              @for (r of roster(); track r.player.id) {
                <li>
                  <button class="prow2 selrow" type="button" [attr.aria-pressed]="r.index >= 0" [style.--pc]="'var(--p' + r.player.color + ')'" (click)="toggle(r.player.id)">
                    <span [sbAvatar]="r.player"></span>
                    <span><b>{{ r.player.name }}</b><small>{{ r.sub }}</small></span>
                    <span class="selbadge">{{ r.index >= 0 ? r.index + 1 : '' }}</span>
                  </button>
                </li>
              }
            </ul>
          } @else {
            <div class="blank"><b>Noch keine Spieler</b>Leg unten den ersten Mitspieler an. Er bleibt für alle Spiele gespeichert.</div>
          }

          <form class="addrow" autocomplete="off" (submit)="addPlayer($event)">
            <input class="pin" type="text" placeholder="Neuer Spieler" maxlength="16" autocapitalize="words" enterkeyhint="done" aria-label="Name des neuen Spielers" [value]="newName()" (input)="newName.set(inputValue($event))" />
            <button class="btn" type="submit">Hinzufügen</button>
          </form>
          <p class="note" style="margin: 0">Tippe die Spieler in Spielreihenfolge an. Neue Spieler werden dauerhaft gespeichert.</p>
        </section>
      </main>

      <div class="startbar">
        <div class="wrap">
          <button class="btn primary big" type="button" [disabled]="selected().length < min()" (click)="start()">{{ startLabel() }}</button>
        </div>
      </div>
    }
  `,
})
export class SetupPage {
  /** Aus der Adresse: /neu/:type */
  readonly type = input.required<string>();

  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly inputValue = inputValue;
  protected readonly newName = signal('');
  protected readonly selected = signal<string[]>([]);

  protected readonly ui = computed(() => uiOf(this.type()));
  private readonly engine = computed(() => engineOf(this.type()));
  protected readonly max = computed(() => this.engine()?.maxPlayers ?? 8);
  protected readonly min = computed(() => this.engine()?.minPlayers ?? 1);

  protected readonly roster = computed(() => {
    const stats = this.store.stats();
    const sel = this.selected();
    return this.store.roster().map(player => {
      const s = stats[player.id];
      return { player, index: sel.indexOf(player.id), sub: s?.games ? `${pluralize(s.games, 'Spiel', 'Spiele')} · ${pluralize(s.wins, 'Sieg', 'Siege')}` : 'Noch kein Spiel' };
    });
  });

  protected readonly startLabel = computed(() => {
    const n = this.selected().length;
    const min = this.min();
    const ui = this.ui();
    if (n >= min) return `${ui?.startLabel} · ${pluralize(n, 'Spieler', 'Spieler')}`;
    if (n) return `Noch ${min - n} Spieler wählen (mind. ${min})`;
    return min > 1 ? `Spieler auswählen (${min} bis ${this.max()})` : 'Spieler auswählen';
  });

  constructor() {
    // Zuletzt gewählte Spieler vorbelegen
    effect(() => {
      const type = this.type();
      const engine = engineOf(type);
      if (!engine) return void this.router.navigate(['/spiele'], { replaceUrl: true });
      untracked(() => {
        const last = (this.store.meta().settings.last[type] ?? []).filter(id => this.store.playerById(id) && !this.store.playerById(id)!.arch);
        this.selected.set(last.slice(0, engine.maxPlayers));
      });
    });
  }

  protected back(): void {
    void this.router.navigate(['/spiele']);
  }

  protected toggle(id: string): void {
    const sel = [...this.selected()];
    const k = sel.indexOf(id);
    if (k >= 0) sel.splice(k, 1);
    else if (sel.length >= this.max()) return void this.toast.show(`Maximal ${this.max()} Spieler`);
    else sel.push(id);
    this.selected.set(sel);
  }

  protected shuffle(): void {
    const sel = [...this.selected()];
    for (let k = sel.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [sel[k], sel[j]] = [sel[j]!, sel[k]!];
    }
    this.selected.set(sel);
    const first = this.store.playerById(sel[0]);
    if (first) this.toast.show(`${first.name} beginnt`);
  }

  protected addPlayer(e: Event): void {
    e.preventDefault();
    const r = this.store.addPlayer(this.newName());
    if (!r) return void this.toast.show('Bitte einen Namen eingeben');
    this.newName.set('');
    if (!this.selected().includes(r.player.id) && this.selected().length < this.max()) this.selected.update(s => [...s, r.player.id]);
    this.toast.show(r.isNew ? `${r.player.name} hinzugefügt` : r.restored ? `${r.player.name} zurückgeholt` : `${r.player.name} gibt es schon`);
  }

  protected start(): void {
    const engine = this.engine();
    const players = this.selected().map(id => this.store.playerById(id)).filter((p): p is NonNullable<typeof p> => !!p);
    if (!engine || players.length < this.min()) return;
    const game = engine.create(seatPlayers(players), this.store.options(engine.id));
    this.store.setLineup(engine.id, players.map(p => p.id));
    this.store.addGame(game);
    void this.router.navigate(['/spiel', game.id]);
  }
}
