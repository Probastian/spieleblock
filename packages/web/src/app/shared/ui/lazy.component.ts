import { ChangeDetectionStrategy, Component, Type, effect, input, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

/** Lädt eine Komponente erst bei Bedarf (`() => import(...)`) und zeigt sie an. */
@Component({
  selector: 'sb-lazy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet],
  host: { style: 'display: contents' },
  template: `@if (component(); as c) { <ng-container *ngComponentOutlet="c; inputs: inputs()" /> }`,
})
export class LazyComponent {
  readonly loader = input.required<() => Promise<Type<unknown>>>();
  readonly inputs = input<Record<string, unknown>>({});
  protected readonly component = signal<Type<unknown> | null>(null);

  constructor() {
    effect(() => {
      const load = this.loader();
      void load().then(c => this.component.set(c));
    });
  }
}
