import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { pluralize } from '@spieleblock/games';
import { DeviceService } from '../../core/api/device.service';
import { BackupService } from '../../core/state/backup.service';
import { Store } from '../../core/state/store.service';
import { SyncService } from '../../core/state/sync.service';
import { SheetService } from '../../core/ui/sheet.service';
import { ToastService } from '../../core/ui/toast.service';
import { inputValue } from '../../shared/dom';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

/** Speicher: Zustand der Übertragung, Backup-Datei, Gerätekennung für ein zweites Gerät. */
@Component({
  selector: 'sb-storage-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Speicher" [title]="text().title" />
    <p style="margin: 0 0 14px; line-height: 1.5; color: var(--ink-2)">{{ text().body }}</p>
    <div class="recs">
      <div class="rec"><span class="lbl">Spieler</span><b class="mono">{{ store.players().length }}</b></div>
      <div class="rec"><span class="lbl">Gespielt</span><b class="mono">{{ store.finishedGames().length }}</b></div>
      <div class="rec"><span class="lbl">Laufend</span><b class="mono">{{ store.activeGames().length }}</b></div>
    </div>

    <div class="menu" style="margin-top: 14px">
      @if (sync.state() === 'error') {
        <button class="mi" type="button" (click)="retry()"><span><span class="mi-t">Jetzt erneut versuchen</span><span class="mi-s">Übertragung sofort starten</span></span></button>
      }
      <button class="mi" type="button" (click)="backup.download(); toast.show('Backup gespeichert')"><span><span class="mi-t">Backup herunterladen</span><span class="mi-s">Alle Spieler und Spiele als Datei sichern</span></span></button>
      <button class="mi" type="button" (click)="file.click()"><span><span class="mi-t">Backup einspielen</span><span class="mi-s">Datei auswählen, vorhandene Daten bleiben erhalten</span></span></button>
    </div>
    <input type="file" accept="application/json,.json" hidden #file (change)="import($event)" />

    <h3 class="tbl-h">Gerätekennung</h3>
    <p class="note" style="margin: 0 0 8px">Damit holst du deine Spieler und Spiele auf einem zweiten Gerät. Gib die Kennung nicht weiter.</p>
    <div class="tbl-code" style="font-size: 19px; letter-spacing: 0.03em; word-break: break-all; user-select: all">{{ device.displayKey }}</div>
    <form class="addrow" autocomplete="off" style="margin-top: 10px" (submit)="adopt($event)">
      <input class="pin" type="text" placeholder="Kennung eingeben" autocomplete="off" spellcheck="false" aria-label="Gerätekennung übernehmen" [value]="key()" (input)="key.set(inputValue($event))" />
      <button class="btn" type="submit">Übernehmen</button>
    </form>
  `,
})
export class StorageSheet {
  protected readonly store = inject(Store);
  protected readonly sync = inject(SyncService);
  protected readonly device = inject(DeviceService);
  protected readonly backup = inject(BackupService);
  protected readonly toast = inject(ToastService);
  private readonly sheets = inject(SheetService);

  protected readonly key = signal('');
  protected readonly inputValue = inputValue;

  protected readonly text = computed(() => {
    const n = this.store.dirty.size;
    switch (this.sync.state()) {
      case 'ok':
        return { title: 'Alles gespeichert', body: 'Deine Spieler und Spiele liegen auf dem Server. Sie bleiben ohne Ablaufdatum erhalten. Auf einem anderen Gerät holst du sie mit der Gerätekennung unten.' };
      case 'syncing':
      case 'connect':
        return { title: 'Speichert …', body: 'Die Daten werden mit dem Server abgeglichen.' };
      case 'error':
        return { title: 'Server nicht erreichbar', body: `${pluralize(n, 'Änderung wartet', 'Änderungen warten')} auf die Übertragung. Bis dahin sind sie auf diesem Gerät gesichert. Der Block versucht es automatisch erneut.` };
      default:
        return { title: 'Nur auf diesem Gerät', body: 'Der Server ist nicht erreichbar oder verlangt einen Zugangscode. Alles liegt vorerst nur im Browser dieses Geräts.' };
    }
  });

  protected retry(): void {
    this.sheets.close();
    void this.sync.syncNow();
  }

  protected import(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 20e6) return void this.toast.show('Datei ist zu groß');
    const reader = new FileReader();
    reader.onload = () => {
      const r = this.backup.import(String(reader.result));
      if (!r.ok) this.toast.show(r.reason === 'unreadable' ? 'Datei nicht lesbar' : 'Das ist keine Spieleblock-Sicherung');
      else {
        this.sheets.close();
        this.toast.show(`Eingespielt: ${r.newPlayers} Spieler, ${r.newGames} Spiele neu`);
      }
    };
    reader.onerror = () => this.toast.show('Datei nicht lesbar');
    reader.readAsText(file);
    input.value = '';
  }

  protected adopt(e: Event): void {
    e.preventDefault();
    if (!this.device.adoptKey(this.key())) this.toast.show('Diese Kennung ist ungültig');
  }
}
