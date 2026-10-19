import type { GameUi } from '../game-ui';

export const hiloUi: GameUi = {
  id: 'hilo',
  name: 'Mehr oder weniger',
  blurb: 'Hat das nächste mehr oder weniger als das davor? Städte, Berge, Länder, Flüsse und mehr.',
  tags: ['1 bis 8 Spieler', 'Leben und Serien'],
  tile: 'var(--mint)',
  icon: 'updown',
  startLabel: 'Mehr oder weniger starten',
  experimental: true,
  reviewLabel: 'Spiel ansehen',
  setup: () => import('./hilo-setup.component').then(m => m.HiloSetup),
  board: () => import('./hilo-board.component').then(m => m.HiloBoard),
  menuExtras: () => import('./hilo-menu-extras.component').then(m => m.HiloMenuExtras),
};
