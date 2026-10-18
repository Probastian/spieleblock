import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AppInfo } from '../../core/api/app-info.service';
import { UpdateService, type UpdatePhase } from '../../core/api/update.service';
import { timeAgo } from '../../core/util/format';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

const MESSAGES: Record<UpdatePhase, string> = {
  idle: '',
  waiting: 'Suche läuft, das dauert ein paar Sekunden …',
  current: 'Du hast die neueste Version.',
  updated: 'Neue Version installiert. Die App lädt gleich neu, laufende Spiele bleiben erhalten.',
  failed: 'Die Prüfung ist fehlgeschlagen. Auf dem Server zeigt „journalctl -u spieleblock-update“ den Grund.',
  timeout: 'Keine Antwort vom Update-Dienst. Auf dem Server prüfen: „systemctl status spieleblock-update.path“.',
  busy: 'Es wurde gerade erst eine Prüfung angefordert. Gleich nochmal versuchen.',
  disabled: 'Auf diesem Server ist das nicht eingerichtet (UPDATE_FROM_UI, siehe docs/betrieb.md).',
  error: 'Der Server ist gerade nicht erreichbar.',
};

/** Verstecktes Wartungs-Sheet: nach einem Update suchen. Erreichbar durch mehrfaches Tippen auf die Version im Hauptmenü. */
@Component({
  selector: 'sb-update-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Wartung" title="Updates" />
    <p class="note" style="margin: 0 0 10px">Installiert: <b>{{ info.version() || 'unbekannt' }}</b></p>

    @if (update.data(); as d) {
      @if (!d.enabled) {
        <p class="note" style="margin: 0">Das Suchen aus der Oberfläche ist auf diesem Server nicht eingerichtet. Der Server prüft trotzdem selbst regelmäßig, wie in docs/betrieb.md beschrieben.</p>
      } @else {
        @if (lastCheck(); as line) {
          <p class="note" style="margin: 0 0 10px">{{ line }}</p>
        } @else {
          <p class="note" style="margin: 0 0 10px">Noch keine Prüfung seit dem Start dieses Servers.</p>
        }
        <button class="btn primary big" type="button" [disabled]="update.phase() === 'waiting'" (click)="update.check()">
          {{ update.phase() === 'waiting' ? 'Suche läuft …' : 'Jetzt nach Update suchen' }}
        </button>
      }
    }
    @if (message(); as m) {
      <p class="note" role="status" style="margin: 12px 0 0">{{ m }}</p>
    }
  `,
})
export class UpdateSheet {
  protected readonly info = inject(AppInfo);
  protected readonly update = inject(UpdateService);

  protected readonly message = computed(() => MESSAGES[this.update.phase()]);
  protected readonly lastCheck = computed(() => {
    const d = this.update.data();
    const s = d?.status;
    if (!d || !s) return '';
    const detail = s.state === 'failed' ? 'fehlgeschlagen' : s.latest ? `neueste Version ${s.latest}` : '';
    return `Zuletzt geprüft ${timeAgo(s.checkedAt, d.now)}${detail ? ' · ' + detail : ''}.`;
  });

  constructor() {
    void this.update.load();
  }
}
