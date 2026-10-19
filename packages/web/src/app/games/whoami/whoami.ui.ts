import type { GameUi } from '../game-ui';

export const whoamiUi: GameUi = {
  id: 'whoami',
  name: 'Wer bin ich?',
  blurb: 'Figuren auf der Stirn erraten, oder Handy an die Stirn und Begriffe erklären lassen.',
  tags: ['2 bis 8 Spieler', 'Auch als Stirnraten'],
  tile: 'var(--gold-soft)',
  icon: 'person',
  startLabel: 'Wer bin ich starten',
  experimental: true,
  reviewLabel: 'Runden ansehen',
  setup: () => import('./whoami-setup.component').then(m => m.WhoamiSetup),
  board: () => import('./whoami-board.component').then(m => m.WhoamiBoard),
  menuExtras: () => import('./whoami-menu-extras.component').then(m => m.WhoamiMenuExtras),
};
