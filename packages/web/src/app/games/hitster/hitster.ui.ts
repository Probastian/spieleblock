import type { GameUi } from '../game-ui';

export const hitsterUi: GameUi = {
  id: 'hitster',
  name: 'Hitster',
  blurb: 'Songs aus deiner Spotify-Playlist in die richtige Reihenfolge bringen.',
  tags: ['Musik', 'Spotify nötig'],
  tile: 'var(--accent-soft)',
  icon: 'music',
  startLabel: 'Hitster starten',
  reviewLabel: 'Zeitstrahl ansehen',
  setup: () => import('./hitster-setup.component').then(m => m.HitsterSetup),
  board: () => import('./hitster-board.component').then(m => m.HitsterBoard),
  menuExtras: () => import('./hitster-menu-extras.component').then(m => m.HitsterMenuExtras),
  endExtras: () => import('./hitster-end.component').then(m => m.HitsterEnd),
};
