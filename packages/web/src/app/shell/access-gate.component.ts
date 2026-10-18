import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AccessService } from '../core/api/access.service';

/** Abfrage des Zugangscodes, wenn der Server einen verlangt. */
@Component({
  selector: 'sb-access-gate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .wrap { position: fixed; inset: 0; z-index: 99999; background: rgba(30, 25, 15, 0.55); display: flex; align-items: center; justify-content: center; padding: 20px; font-family: system-ui, sans-serif; }
    form { background: #fffdf6; color: #2b2a33; border-radius: 14px; padding: 22px; max-width: 340px; width: 100%; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35); }
    h2 { font-size: 19px; margin: 0 0 6px; }
    p { font-size: 14px; color: #4b4958; margin: 0 0 12px; }
    input { width: 100%; box-sizing: border-box; font-size: 18px; padding: 12px; border: 2px solid #b5ac95; border-radius: 10px; background: #fff; color: #2b2a33; }
    .e { color: #c0392b; font-size: 13px; min-height: 18px; margin-top: 6px; }
    button { width: 100%; font-size: 17px; padding: 12px; border: 0; border-radius: 10px; background: #d6453d; color: #fff; font-weight: 700; }
  `,
  template: `
    <div class="wrap">
      <form (submit)="submit($event)">
        <h2>Zugangscode</h2>
        <p>Dieser Spieleblock ist geschützt. Den Code hat dir der Betreiber gegeben.</p>
        <input type="password" autocomplete="off" aria-label="Zugangscode" #field (input)="value.set(field.value)" autofocus />
        <div class="e" role="alert">{{ error() }}</div>
        <button type="submit">Weiter</button>
      </form>
    </div>
  `,
})
export class AccessGateComponent {
  private readonly access = inject(AccessService);
  protected readonly value = signal('');
  protected readonly error = signal('');

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    const result = await this.access.submit(this.value().trim());
    if (result === 'wrong') this.error.set('Der Code stimmt nicht.');
    else if (result === 'unreachable') this.error.set('Server nicht erreichbar.');
  }
}
