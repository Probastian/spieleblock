import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type IconName = 'grid' | 'dots' | 'info' | 'back' | 'close' | 'chevL' | 'chevR' | 'chevU' | 'chevD' | 'tabGames' | 'tabPeople' | 'tabHist' | 'board' | 'wizard' | 'music' | 'play' | 'pause' | 'replay' | 'mask' | 'person' | 'dial' | 'film' | 'updown';

const DEFAULT_SIZE: Record<IconName, number> = { grid: 20, dots: 20, info: 21, back: 22, close: 20, chevL: 22, chevR: 20, chevU: 20, chevD: 20, tabGames: 24, tabPeople: 24, tabHist: 24, board: 32, wizard: 32, music: 32, play: 24, pause: 24, replay: 22, mask: 32, person: 32, dial: 32, film: 32, updown: 32 };

/** Symbole des Blocks. Verwendung: `<svg sb-icon name="chevL"></svg>` */
@Component({
  selector: 'svg[sb-icon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    '[attr.width]': 'px()',
    '[attr.height]': 'px()',
    '[attr.fill]': "name() === 'dots' ? 'currentColor' : 'none'",
    '[attr.stroke]': "name() === 'dots' ? null : 'currentColor'",
    '[attr.stroke-width]': "name() === 'info' ? 1.8 : 2",
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  },
  template: `
    @switch (name()) {
      @case ('grid') {
        <svg:rect x="3.5" y="3.5" width="17" height="17" rx="3" />
        <svg:path d="M3.5 9.5h17M3.5 15h17M10 3.5v17" />
      }
      @case ('dots') {
        <svg:circle cx="5" cy="12" r="2" />
        <svg:circle cx="12" cy="12" r="2" />
        <svg:circle cx="19" cy="12" r="2" />
      }
      @case ('info') {
        <svg:circle cx="12" cy="12" r="9" />
        <svg:path d="M12 11v5.5" />
        <svg:circle cx="12" cy="7.8" r="1.15" fill="currentColor" stroke="none" />
      }
      @case ('back') {
        <svg:path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z" />
        <svg:path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
      }
      @case ('close') {
        <svg:path d="M6 6l12 12M18 6L6 18" />
      }
      @case ('chevL') {
        <svg:path d="M15 5l-7 7 7 7" />
      }
      @case ('chevU') {
        <svg:path d="M5 15l7-7 7 7" />
      }
      @case ('chevD') {
        <svg:path d="M5 9l7 7 7-7" />
      }
      @case ('chevR') {
        <svg:path d="M9 5l7 7-7 7" />
      }
      @case ('tabGames') {
        <svg:rect x="4" y="4" width="16" height="16" rx="4" />
        <svg:circle cx="9" cy="9" r="1.2" fill="currentColor" />
        <svg:circle cx="15" cy="15" r="1.2" fill="currentColor" />
        <svg:circle cx="12" cy="12" r="1.2" fill="currentColor" />
      }
      @case ('tabPeople') {
        <svg:circle cx="9" cy="8" r="3.2" />
        <svg:path d="M3.5 19c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5" />
        <svg:circle cx="17" cy="9" r="2.4" />
        <svg:path d="M16.5 14.2c2.4.2 4 1.7 4.5 4.3" />
      }
      @case ('tabHist') {
        <svg:circle cx="12" cy="12" r="8.5" />
        <svg:path d="M12 7.5V12l3 2" />
      }
      @case ('board') {
        <svg:rect x="3.5" y="4.5" width="17" height="15" rx="3" />
        <svg:path d="M3.5 9.5h17M9.5 9.5v10M13 13.5h4M13 16.5h2.5" />
      }
      @case ('music') {
        <svg:path d="M9 18V6.5l10-2V16" />
        <svg:circle cx="6.5" cy="18" r="2.6" />
        <svg:circle cx="16.5" cy="16" r="2.6" />
        <svg:path d="M9 10.5l10-2" />
      }
      @case ('play') {
        <svg:path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1l-11-6.8a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none" />
      }
      @case ('pause') {
        <svg:rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
        <svg:rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
      }
      @case ('replay') {
        <svg:path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
        <svg:path d="M4.2 3.8v4.4h4.4" />
      }
      @case ('mask') {
        <svg:path d="M4.5 5.5h15v6.5a7.5 7.5 0 0 1-15 0z" />
        <svg:path d="M7.8 10.2l2.7 1.2M16.2 10.2l-2.7 1.2" />
        <svg:path d="M9.4 15.6c1.5 1.1 3.7 1.1 5.2 0" />
      }
      @case ('person') {
        <svg:circle cx="10" cy="9" r="3.5" />
        <svg:path d="M3.5 20.5c.5-4 3.2-6 6.5-6s6 2 6.5 6" />
        <svg:path d="M17.6 3.8a1.7 1.7 0 1 1 2 1.7c-.6.2-.9.6-.9 1.3M18.8 9.2h.01" />
      }
      @case ('dial') {
        <svg:path d="M3.5 17.5a8.5 8.5 0 0 1 17 0" />
        <svg:path d="M12 17.5l4.2-7.2" />
        <svg:circle cx="12" cy="17.5" r="1.4" />
        <svg:path d="M3.5 20.5h17" />
      }
      @case ('film') {
        <svg:rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <svg:path d="M8 5v14M16 5v14M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" />
      }
      @case ('updown') {
        <svg:path d="M8 20V5M4.5 8.5L8 5l3.5 3.5" />
        <svg:path d="M16 4v15M12.5 15.5L16 19l3.5-3.5" />
      }
      @case ('wizard') {
        <svg:path d="M12.2 3.2c-.7 3.6-2.6 8.6-5 13.3h10.6c-.6-4.7-2.8-10.6-5.6-13.3z" />
        <svg:path d="M3.5 18.2c3.6 2.2 13.4 2.2 17 0" />
        <svg:path d="M10.2 11.3l1.4-1 1.4 1M15.6 5.2l.9-.9M17.2 7.2h1.3" />
      }
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number | null>(null);
  protected readonly px = computed(() => this.size() ?? DEFAULT_SIZE[this.name()]);
}
