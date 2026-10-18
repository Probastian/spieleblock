import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { initialsOf } from '../../core/util/format';

export interface Avatarable {
  name: string;
  color: number;
}

/** Runder Spieler-Marker mit Initialen. Verwendung: `<span [sbAvatar]="player"></span>` */
@Component({
  selector: 'span[sbAvatar]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'av', '[class.sm]': 'small()', '[style.--pc]': "'var(--p' + player().color + ')'", 'aria-hidden': 'true' },
  template: '{{ initials() }}',
})
export class AvatarComponent {
  readonly player = input.required<Avatarable>({ alias: 'sbAvatar' });
  readonly small = input(false, { transform: booleanAttribute });
  protected readonly initials = computed(() => initialsOf(this.player().name));
}
