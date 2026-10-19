import type { GameUi } from '../game-ui';

export const filmUi: GameUi = {
  id: 'film',
  name: 'Film-Zeitstrahl',
  blurb: 'Filme nach Erscheinungsjahr in den Zeitstrahl einsortieren, wie bei Hitster, nur ohne Musik.',
  tags: ['Kein Spotify nötig', 'Mit Einspruch'],
  tile: 'var(--gold-soft)',
  icon: 'film',
  startLabel: 'Film-Zeitstrahl starten',
  experimental: true,
  reviewLabel: 'Zeitstrahl ansehen',
  setup: () => import('./film-setup.component').then(m => m.FilmSetup),
  board: () => import('../hitster/hitster-board.component').then(m => m.HitsterBoard),
  menuExtras: () => import('./film-menu-extras.component').then(m => m.FilmMenuExtras),
  endExtras: () => import('../hitster/hitster-end.component').then(m => m.HitsterEnd),
};
