import type { GameUi } from '../game-ui';

export const imposterUi: GameUi = {
  id: 'imposter',
  name: 'Imposter',
  blurb: 'Alle kennen das Wort, nur einer nicht. Hinweise geben, abstimmen, den Imposter enttarnen.',
  tags: ['3 bis 8 Spieler', 'Live-Tisch ideal'],
  tile: 'var(--lilac)',
  icon: 'mask',
  startLabel: 'Imposter starten',
  experimental: true,
  reviewLabel: 'Runden ansehen',
  setup: () => import('./imposter-setup.component').then(m => m.ImposterSetup),
  board: () => import('./imposter-board.component').then(m => m.ImposterBoard),
  menuExtras: () => import('./imposter-menu-extras.component').then(m => m.ImposterMenuExtras),
  endExtras: () => import('./imposter-end.component').then(m => m.ImposterEnd),
};
